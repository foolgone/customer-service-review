import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import ActionBar from './components/ActionBar';
import AnalysisPanel from './components/AnalysisPanel';
import ConversationList from './components/ConversationList';
import ConversationPanel from './components/ConversationPanel';
import LabelSelector from './components/LabelSelector';
import ScoreSelector from './components/ScoreSelector';
import DashboardSkeleton from './components/common/DashboardSkeleton';
import ShortcutsDialog from './components/common/ShortcutsDialog';
import AppShell from './ui/AppShell';
import { analyzeConversation } from './lib/ai';
import { buildAnalytics, formatDurationLabel, isHumanReviewed } from './lib/analytics';
import { DEFAULT_ANNOTATION, LABELS, REVIEWER_PROFILE, SCORE_SHORTCUT_VALUE_MAP } from './lib/constants';
import { exportConversationsToCsv } from './lib/exporters/csv';
import { loadSettings, saveSettings } from './lib/settings';
import {
  addImportHistory,
  loadAnnotations,
  normalizeAnnotation,
  readStoredTheme,
  saveAnnotations,
} from './lib/storage';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTheme } from './hooks/useTheme';

// 导入向导按需加载：xlsx / papaparse 体积较大，不打开导入时不影响首屏
const ImportWizard = lazy(() => import('./components/import/ImportWizard'));
// 导出面板按需加载：html2canvas / jspdf / xlsx 体积较大，只在导出时加载
const ExportReportPanel = lazy(() => import('./components/export/ExportReportPanel'));
// 设置面板按需加载
const SettingsPanel = lazy(() => import('./components/settings/SettingsPanel'));
// 数据管理面板按需加载
const DataManagerPanel = lazy(() => import('./components/data/DataManagerPanel'));
// 批量分析面板按需加载
const BatchAnalysisPanel = lazy(() => import('./components/ai/BatchAnalysisPanel'));
// 分析看板按需加载：内含 recharts（体积最大的第三方依赖），不参与工作台首屏
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));

function getConversationText(conversation, role) {
  return conversation?.turns?.find((turn) => turn.role === role)?.content || '';
}

function getProgressLabel(currentIndex, total) {
  if (!total) {
    return '0 / 0';
  }

  return `${currentIndex + 1} / ${total}`;
}

// 兼容子路径部署（如 GitHub Pages 的 /customer-service-review/）；本地与根路径部署时仍为 /data/...
const CONVERSATIONS_URL = `${import.meta.env.BASE_URL}data/conversations.json`;

const LABEL_DISPLAY_MAP = new Map(LABELS.map((item) => [item.value, item.label]));
const LABEL_SHORTCUT_MAP = new Map(LABELS.map((item) => [item.shortcut, item.value]));

function getLabelDisplayName(value) {
  return LABEL_DISPLAY_MAP.get(value) || value;
}

function getNowIso() {
  return new Date().toISOString();
}

function getDurationMs(startedAt) {
  const start = new Date(startedAt).getTime();
  return Number.isNaN(start) ? 0 : Math.max(Date.now() - start, 0);
}

// 把网络层异常统一转成中文提示（BUG-09）：浏览器真实网络错误是 TypeError('Failed to fetch')
function getLoadErrorMessage(loadError) {
  if (loadError instanceof TypeError) {
    return '读取对话数据失败：网络异常，请检查网络连接后重试';
  }

  if (loadError instanceof Error && loadError.message) {
    return loadError.message;
  }

  return '读取对话数据失败';
}

function AppContent() {
  const navigate = useNavigate();
  const { isDark, setTheme, toggleTheme } = useTheme();
  const [conversations, setConversations] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [annotations, setAnnotations] = useState({});
  const [draft, setDraft] = useState(DEFAULT_ANNOTATION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('');
  const [analysisState, setAnalysisState] = useState({ status: 'idle', reason: '', labels: [], error: '' });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [apiKey, setApiKey] = useState(() => loadSettings().apiKey);
  const [aiModel, setAiModel] = useState(() => loadSettings().model);
  const [batchConcurrency, setBatchConcurrency] = useState(() => loadSettings().concurrency);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDataManagerOpen, setIsDataManagerOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [dataSource, setDataSource] = useState({ label: '示例数据', imported: false, fileName: '' });
  const annotationsRef = useRef({});
  const reviewStartedAtRef = useRef(Date.now());
  // 标记「AI 建议已保存」刚设置过，避免被同一轮自动保存提示立刻覆盖（BUG-10）
  const aiNoticeRef = useRef(false);
  const currentConversation = conversations[currentIndex];

  useEffect(() => {
    let ignore = false;

    async function loadConversations() {
      try {
        const response = await fetch(CONVERSATIONS_URL);
        if (!response.ok) {
          throw new Error(`读取对话数据失败：${response.status}`);
        }

        const data = await response.json();
        const list = Array.isArray(data) ? data : [];
        if (!ignore) {
          setConversations(list);
          setDataSource({ label: '示例数据', imported: false, fileName: '' });
          setLoading(false);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(getLoadErrorMessage(loadError));
          setLoading(false);
        }
      }
    }

    loadConversations();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const storedAnnotations = loadAnnotations();
    setAnnotations(storedAnnotations);
    annotationsRef.current = storedAnnotations;
  }, []);

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  useEffect(() => {
    if (!conversations.length) {
      return;
    }

    reviewStartedAtRef.current = Date.now();
  }, [conversations.length, currentIndex]);

  useEffect(() => {
    if (!currentConversation) {
      return;
    }

    const currentAnnotation = annotations[currentConversation.id] || DEFAULT_ANNOTATION;
    setDraft(normalizeAnnotation(currentAnnotation));

    if (Array.isArray(currentAnnotation.aiLabels) && currentAnnotation.aiLabels.length) {
      setAnalysisState({
        status: 'success',
        reason: currentAnnotation.aiReason || '',
        labels: currentAnnotation.aiLabels,
        error: '',
      });
    } else {
      setAnalysisState({ status: 'idle', reason: '', labels: [], error: '' });
    }
  }, [annotations, currentConversation]);

  useEffect(() => {
    if (!conversations.length) {
      return;
    }

    if (Object.keys(annotations).length === 0) {
      return;
    }

    saveAnnotations(annotations);

    if (aiNoticeRef.current) {
      // 保留「AI 建议已保存」提示，不覆盖
      aiNoticeRef.current = false;
      return;
    }

    setSaveState(`已自动保存 · ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
  }, [annotations, conversations.length]);

  const totalCount = conversations.length;
  const currentId = currentConversation?.id || '-';
  const userContent = useMemo(() => getConversationText(currentConversation, 'user'), [currentConversation]);
  const assistantContent = useMemo(() => getConversationText(currentConversation, 'assistant'), [currentConversation]);
  const conversationIds = useMemo(() => new Set(conversations.map((conversation) => conversation.id)), [conversations]);
  const reviewedCount = useMemo(
    () => Object.keys(annotations).filter((id) => conversationIds.has(id) && isHumanReviewed(annotations[id])).length,
    [annotations, conversationIds],
  );
  const completionRate = totalCount ? Math.min(Math.round((reviewedCount / totalCount) * 100), 100) : 0;
  const progressLabel = getProgressLabel(currentIndex, totalCount);
  const hasApiKey = Boolean(apiKey);
  const analytics = useMemo(() => buildAnalytics(conversations, annotations), [annotations, conversations]);

  const persistDraft = (nextDraft) => {
    if (!currentConversation) {
      return;
    }

    setDraft(nextDraft);
    setAnnotations((previous) => {
      const existing = normalizeAnnotation(previous[currentConversation.id] || DEFAULT_ANNOTATION);
      const nextAnnotation = normalizeAnnotation({
        ...existing,
        ...nextDraft,
        startedAt: existing.startedAt || new Date(reviewStartedAtRef.current).toISOString(),
        updatedAt: getNowIso(),
      });

      return {
        ...previous,
        [currentConversation.id]: nextAnnotation,
      };
    });
  };

  const handleToggleLabel = (labelValue) => {
    const labels = draft.labels.includes(labelValue)
      ? draft.labels.filter((item) => item !== labelValue)
      : [...draft.labels, labelValue];

    persistDraft({ ...draft, labels });
  };

  const handleShortcutLabel = (shortcutKey) => {
    const matchedLabel = LABEL_SHORTCUT_MAP.get(shortcutKey);

    if (matchedLabel) {
      handleToggleLabel(matchedLabel);
    }
  };

  const handleScoreChange = (score) => {
    persistDraft({ ...draft, score });
  };

  // 快捷键 Alt+1~5 传入的是数字 1~5，需要按「Alt+1 = 5 分」映射后才是真实分值
  const handleScoreShortcut = (shortcutKey) => {
    const score = SCORE_SHORTCUT_VALUE_MAP.get(Number(shortcutKey));
    if (score) {
      handleScoreChange(score);
    }
  };

  const handleCommentChange = (event) => {
    persistDraft({ ...draft, comment: event.target.value });
  };

  const handleSave = () => {
    if (!currentConversation) {
      return;
    }

    setIsSaving(true);
    const nowIso = getNowIso();
    const currentAnnotations = annotationsRef.current;
    const startedAt =
      currentAnnotations[currentConversation.id]?.startedAt || new Date(reviewStartedAtRef.current).toISOString();
    const nextAnnotations = {
      ...currentAnnotations,
      [currentConversation.id]: normalizeAnnotation({
        ...(currentAnnotations[currentConversation.id] || DEFAULT_ANNOTATION),
        ...draft,
        startedAt,
        reviewedAt: nowIso,
        updatedAt: nowIso,
        durationMs: getDurationMs(startedAt),
      }),
    };

    setAnnotations(nextAnnotations);
    annotationsRef.current = nextAnnotations;
    saveAnnotations(nextAnnotations);

    setTimeout(() => {
      setIsSaving(false);
      setSaveState(`已保存 · ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
    }, 180);
  };

  const handleExport = () => {
    exportConversationsToCsv(conversations, annotationsRef.current);
    setSaveState('CSV 已导出');
  };

  const handleAnalyze = async () => {
    if (!currentConversation) {
      return;
    }

    try {
      setIsAnalyzing(true);
      setAnalysisState({ status: 'analyzing', reason: '', labels: [], error: '' });

      const result = await analyzeConversation({
        apiKey,
        userContent,
        assistantContent,
        model: aiModel,
      });

      const nowIso = getNowIso();
      aiNoticeRef.current = true;
      setAnnotations((previous) => {
        const existing = normalizeAnnotation(previous[currentConversation.id] || DEFAULT_ANNOTATION);
        const nextAnnotation = normalizeAnnotation({
          ...existing,
          aiLabels: result.labels,
          aiReason: result.reason,
          aiAt: nowIso,
          startedAt: existing.startedAt || new Date(reviewStartedAtRef.current).toISOString(),
          updatedAt: nowIso,
        });

        return {
          ...previous,
          [currentConversation.id]: nextAnnotation,
        };
      });

      annotationsRef.current = {
        ...annotationsRef.current,
        [currentConversation.id]: normalizeAnnotation({
          ...(annotationsRef.current[currentConversation.id] || DEFAULT_ANNOTATION),
          aiLabels: result.labels,
          aiReason: result.reason,
          aiAt: nowIso,
          startedAt:
            annotationsRef.current[currentConversation.id]?.startedAt ||
            new Date(reviewStartedAtRef.current).toISOString(),
          updatedAt: nowIso,
        }),
      };

      setAnalysisState({
        status: 'success',
        reason: result.reason,
        labels: result.labels,
        error: '',
      });
      setSaveState('AI 建议已保存');
    } catch (analyzeError) {
      setAnalysisState({
        status: 'error',
        reason: '',
        labels: [],
        error: analyzeError instanceof Error ? analyzeError.message : 'AI 分析失败',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImportApiKey = () => {
    const nextApiKey = window.prompt('请输入 DeepSeek API Key');

    if (nextApiKey === null) {
      return;
    }

    const trimmedApiKey = nextApiKey.trim();

    if (!trimmedApiKey) {
      setApiKey('');
      saveSettings({ ...loadSettings(), apiKey: '' });
      setSaveState('已清除会话内 DeepSeek API Key');
      return;
    }

    setApiKey(trimmedApiKey);
    saveSettings({ ...loadSettings(), apiKey: trimmedApiKey });
    setSaveState('DeepSeek API Key 已导入到当前会话');
  };

  const handleClearApiKey = () => {
    setApiKey('');
    saveSettings({ ...loadSettings(), apiKey: '' });
    setSaveState('已清除会话内 DeepSeek API Key');
  };

  // 设置页保存：同步运行时配置并落盘
  const handleSaveSettings = (nextSettings) => {
    const saved = saveSettings(nextSettings);
    setApiKey(saved.apiKey);
    setAiModel(saved.model);
    setBatchConcurrency(saved.concurrency);
    setSaveState('设置已保存');
  };

  // 设置页恢复/清空数据后重新加载：标注 + 运行时配置 + 主题（BUG-25）
  const handleDataRestored = () => {
    const stored = loadAnnotations();
    setAnnotations(stored);
    annotationsRef.current = stored;

    const restoredSettings = loadSettings();
    setApiKey(restoredSettings.apiKey);
    setAiModel(restoredSettings.model);
    setBatchConcurrency(restoredSettings.concurrency);
    setTheme(readStoredTheme());

    // 避免恢复成功提示被随后的自动保存覆盖（BUG-28）
    aiNoticeRef.current = true;
    setSaveState('本地数据已更新');
  };

  // 数据管理：跳转到指定对话（关闭面板并定位）
  const handleJumpToConversation = (conversationId) => {
    const index = conversations.findIndex((conversation) => conversation.id === conversationId);
    if (index >= 0) {
      setCurrentIndex(index);
    }
    setIsDataManagerOpen(false);
  };

  // 数据管理：导出当前筛选结果
  const handleExportFiltered = (filteredConversations) => {
    exportConversationsToCsv(filteredConversations, annotationsRef.current);
    setSaveState(`已导出筛选结果 ${filteredConversations.length} 条`);
  };

  const goPrev = () => setCurrentIndex((index) => Math.max(index - 1, 0));
  const goNext = () => setCurrentIndex((index) => Math.min(index + 1, conversations.length - 1));

  const handleImportConversations = ({ conversations: importedConversations, meta }) => {
    setConversations(importedConversations);
    setCurrentIndex(0);
    setAnalysisState({ status: 'idle', reason: '', labels: [], error: '' });
    setDataSource({ label: `${meta.format} · ${meta.fileName}`, imported: true, fileName: meta.fileName });
    addImportHistory({
      fileName: meta.fileName,
      format: meta.format,
      total: meta.total,
      valid: meta.valid,
      invalid: meta.invalid,
    });
    setSaveState(`已导入 ${meta.valid} 条对话`);
    setIsImportOpen(false);
  };

  // 批量分析结果：只写入 AI 建议字段，绝不覆盖人工标签/备注/评分
  const handleApplyBatchResults = (records) => {
    if (!records?.length) {
      return;
    }

    const nowIso = getNowIso();
    // BUG-15：让紧随其后的自动保存 effect 跳过提示覆盖，保留批量完成反馈
    aiNoticeRef.current = true;

    setAnnotations((previous) => {
      const next = { ...previous };

      records.forEach(({ id, labels, reason }) => {
        const existing = normalizeAnnotation(next[id] || DEFAULT_ANNOTATION);
        next[id] = normalizeAnnotation({
          ...existing,
          aiLabels: labels,
          aiReason: reason,
          aiAt: nowIso,
          startedAt: existing.startedAt || new Date(reviewStartedAtRef.current).toISOString(),
          updatedAt: nowIso,
        });
      });

      return next;
    });

    setSaveState(`批量分析完成：${records.length} 条 AI 建议已保存`);
  };

  const handleRestoreSample = async () => {
    try {
      const response = await fetch(CONVERSATIONS_URL);
      if (!response.ok) {
        throw new Error(`读取示例数据失败：${response.status}`);
      }

      const data = await response.json();
      setConversations(Array.isArray(data) ? data : []);
      setCurrentIndex(0);
      setDataSource({ label: '示例数据', imported: false, fileName: '' });
      setSaveState('已恢复示例数据');
    } catch (restoreError) {
      setSaveState(restoreError instanceof Error ? restoreError.message : '恢复示例数据失败');
    }
  };

  const themeLabel = isDark ? '切换浅色模式' : '切换深色模式';

  // 分析看板「去处理」：跳到工作台并定位到对应对话
  const handleOpenConversationFromAnalytics = (index) => {
    setCurrentIndex(Math.min(Math.max(index, 0), Math.max(conversations.length - 1, 0)));
    navigate('/workbench');
  };

  useKeyboardShortcuts({
    onNext: goNext,
    onSave: handleSave,
    onAnalyze: handleAnalyze,
    onToggleTheme: toggleTheme,
    onToggleLabelShortcut: handleShortcutLabel,
    onSetScoreShortcut: handleScoreShortcut,
    // BUG-20：任一模态面板打开时暂停全局快捷键
    enabled:
      !isImportOpen && !isBatchOpen && !isExportOpen && !isSettingsOpen && !isDataManagerOpen && !isShortcutsOpen,
  });

  // ? 呼出快捷键面板（与业务快捷键同一套「弹窗打开即暂停」规则）
  useEffect(() => {
    function handleHelpKey(event) {
      if (event.key !== '?' || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const target = event.target;
      const editable =
        target instanceof HTMLElement &&
        (target.isContentEditable || ['input', 'textarea', 'select'].includes(target.tagName.toLowerCase()));
      if (editable) {
        return;
      }

      event.preventDefault();
      setIsShortcutsOpen((open) => !open);
    }

    window.addEventListener('keydown', handleHelpKey);
    return () => window.removeEventListener('keydown', handleHelpKey);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="glass-card rounded-xl px-8 py-6 text-sm text-slate-600 dark:text-slate-300">
          正在加载对话数据...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="glass-card max-w-xl rounded-xl px-8 py-6 text-sm text-rose-600 dark:text-rose-300">{error}</div>
      </div>
    );
  }

  if (!currentConversation) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="glass-card rounded-xl px-8 py-6 text-sm text-slate-600 dark:text-slate-300">暂无对话数据</div>
      </div>
    );
  }

  const statCards = [
    { label: '当前对话 ID', value: currentId },
    { label: '当前进度', value: progressLabel },
    { label: '已标注', value: `${reviewedCount} / ${totalCount}` },
    { label: '已审核数量', value: analytics.reviewedCount },
    { label: '回复准确率', value: `${analytics.accuracyRate}%` },
    { label: 'AI 建议采纳率', value: `${analytics.aiAdoptionRate}%` },
    { label: '平均审核耗时', value: formatDurationLabel(analytics.avgDurationMs) },
  ];

  const workbench = (
    <div className="flex min-h-0 flex-col xl:h-[calc(100vh-3.5rem)]">
      <h1 className="sr-only">质检工作台</h1>
      {/* 高频操作条：从页面底部上移到顶部 */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
        <ActionBar
          onPrev={goPrev}
          onNext={goNext}
          onSave={handleSave}
          onExport={handleExport}
          onAnalyze={handleAnalyze}
          onImport={() => setIsImportOpen(true)}
          onOpenDataManager={() => setIsDataManagerOpen(true)}
          onExportReport={() => setIsExportOpen(true)}
          onBatchAnalyze={() => setIsBatchOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          canPrev={currentIndex > 0}
          canNext={currentIndex < conversations.length - 1}
          isAnalyzing={isAnalyzing}
          isSaving={isSaving}
          isBatchAnalyzing={isBatchRunning}
          hasApiKey={hasApiKey}
          onToggleTheme={toggleTheme}
          themeLabel={themeLabel}
        />
      </div>
      {/* 概览条：当前对话 / 进度 / 已标注 + 关键指标（工作台不再被看板挤到第二屏） */}
      <dl className="grid shrink-0 grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 bg-white sm:grid-cols-4 xl:grid-cols-7 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {statCards.map((item) => (
          <div key={item.label} className="px-4 py-2">
            <dt className="text-[11px] text-slate-500 dark:text-slate-400">{item.label}</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 lg:block dark:border-slate-800">
          <ConversationList
            conversations={conversations}
            annotations={annotations}
            currentIndex={currentIndex}
            onSelect={(index) => setCurrentIndex(index)}
          />
        </aside>

        <section className="min-w-0 flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950">
          <ConversationPanel conversation={currentConversation} currentIndex={currentIndex} totalCount={totalCount} />
        </section>

        <aside className="w-full shrink-0 space-y-3 border-t border-slate-200 bg-white p-4 xl:w-[380px] xl:overflow-y-auto xl:border-l xl:border-t-0 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">审核工作台</h2>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              自动保存状态：{saveState || '等待编辑'}
            </span>
          </div>

          <section className="rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="panel-header py-2">
              <h3 className="section-title">当前标签</h3>
            </div>
            <div className="flex flex-wrap gap-2 p-3">
              {draft.labels.length ? (
                draft.labels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300"
                  >
                    {getLabelDisplayName(label)}
                  </span>
                ))
              ) : (
                <span className="muted">尚未选择标签</span>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="panel-header py-2">
              <h3 className="section-title">问题标签</h3>
              <span className="muted">快捷键 1-6</span>
            </div>
            <div className="p-3">
              <LabelSelector selectedLabels={draft.labels} onToggleLabel={handleToggleLabel} />
            </div>
          </section>

          <ScoreSelector selectedScore={draft.score || 3} onChangeScore={handleScoreChange} />

          <section className="rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="panel-header py-2">
              <h3 className="section-title">备注</h3>
            </div>
            <div className="p-3">
              <textarea
                value={draft.comment}
                onChange={handleCommentChange}
                rows={3}
                placeholder="填写人工审核备注，例如：回复准确但缺少退款时效说明"
                className="soft-input resize-none"
              />
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="panel-header py-2">
              <h3 className="section-title">本次审核</h3>
            </div>
            <div className="flex flex-wrap gap-2 p-3 text-xs text-slate-600 dark:text-slate-300">
              <span className="whitespace-nowrap rounded-md bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                评分：{draft.score || 3} 分
              </span>
              <span className="whitespace-nowrap rounded-md bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                标签：{draft.labels.length}
              </span>
              <span className="whitespace-nowrap rounded-md bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                AI 建议：{analysisState.labels.length || 0}
              </span>
              <span className="whitespace-nowrap rounded-md bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                耗时：{analytics.avgDurationMs ? '可统计' : '待生成'}
              </span>
            </div>
          </section>

          <AnalysisPanel
            analysisState={analysisState}
            isAnalyzing={isAnalyzing}
            hasApiKey={hasApiKey}
            onAnalyze={handleAnalyze}
          />

          <section className="rounded-lg border border-slate-200 p-3 text-xs leading-6 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-700 dark:text-slate-200">AI 服务</span>
              <span className="text-slate-600 dark:text-slate-400">
                当前状态：{hasApiKey ? '已配置' : '未配置'} · 仅保存在本机浏览器
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleImportApiKey}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                导入 API
              </button>
              <button
                type="button"
                onClick={handleClearApiKey}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                清除
              </button>
            </div>
            {!hasApiKey ? (
              <p className="mt-2 text-amber-700 dark:text-amber-300">
                未配置时「AI 分析 / 批量分析」不可用；可在「设置」中保存 Key。
              </p>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );

  return (
    <>
      <AppShell
        dataSourceLabel={`数据源：${dataSource.label}（${totalCount} 条）`}
        imported={dataSource.imported}
        onRestoreSample={handleRestoreSample}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/workbench" replace />} />
          <Route path="/workbench" element={workbench} />
          <Route
            path="/analytics"
            element={
              <Suspense
                fallback={
                  <div className="p-4 lg:p-6">
                    <DashboardSkeleton />
                  </div>
                }
              >
                <AnalyticsPage
                  analytics={analytics}
                  reviewerStatus={REVIEWER_PROFILE}
                  hasApiKey={hasApiKey}
                  isDark={isDark}
                  conversations={conversations}
                  annotations={annotations}
                  onOpenConversation={handleOpenConversationFromAnalytics}
                />
              </Suspense>
            }
          />
        </Routes>
      </AppShell>

      <ShortcutsDialog open={isShortcutsOpen} onClose={() => setIsShortcutsOpen(false)} />

      {isImportOpen ? (
        <Suspense fallback={null}>
          <ImportWizard open onClose={() => setIsImportOpen(false)} onImport={handleImportConversations} />
        </Suspense>
      ) : null}

      {isBatchOpen ? (
        <Suspense fallback={null}>
          <BatchAnalysisPanel
            open
            conversations={conversations}
            annotations={annotations}
            apiKey={apiKey}
            model={aiModel}
            defaultConcurrency={batchConcurrency}
            onClose={() => setIsBatchOpen(false)}
            onApplyResults={handleApplyBatchResults}
            onRunningChange={setIsBatchRunning}
          />
        </Suspense>
      ) : null}

      {isExportOpen ? (
        <Suspense fallback={null}>
          <ExportReportPanel
            open
            conversations={conversations}
            annotations={annotations}
            analytics={analytics}
            onClose={() => setIsExportOpen(false)}
          />
        </Suspense>
      ) : null}

      {isSettingsOpen ? (
        <Suspense fallback={null}>
          <SettingsPanel
            open
            settings={{ apiKey, model: aiModel, concurrency: batchConcurrency }}
            onClose={() => setIsSettingsOpen(false)}
            onSave={handleSaveSettings}
            onDataRestored={handleDataRestored}
          />
        </Suspense>
      ) : null}

      {isDataManagerOpen ? (
        <Suspense fallback={null}>
          <DataManagerPanel
            open
            conversations={conversations}
            annotations={annotations}
            onClose={() => setIsDataManagerOpen(false)}
            onJump={handleJumpToConversation}
            onExportFiltered={handleExportFiltered}
          />
        </Suspense>
      ) : null}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
