import { useEffect, useMemo, useRef, useState } from 'react';
import ActionBar from './components/ActionBar';
import AnalysisPanel from './components/AnalysisPanel';
import ConversationPanel from './components/ConversationPanel';
import Dashboard from './components/Dashboard';
import LabelSelector from './components/LabelSelector';
import ScoreSelector from './components/ScoreSelector';
import { buildAnalytics } from './lib/analytics';
import { DEFAULT_ANNOTATION, DEEPSEEK_DEFAULT_MODEL, LABELS, QUICK_SHORTCUTS, REVIEWER_PROFILE } from './lib/constants';
import { exportConversationsToCsv } from './lib/csv';
import { analyzeWithDeepSeek } from './lib/deepseek';
import { loadAnnotations, normalizeAnnotation, saveAnnotations } from './lib/storage';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useTheme } from './hooks/useTheme';

function getConversationText(conversation, role) {
  return conversation?.turns?.find((turn) => turn.role === role)?.content || '';
}

function getProgressLabel(currentIndex, total) {
  if (!total) {
    return '0 / 0';
  }

  return `${currentIndex + 1} / ${total}`;
}

function getApiKey() {
  return import.meta.env.VITE_DEEPSEEK_API_KEY || '';
}

function getModel() {
  return import.meta.env.VITE_DEEPSEEK_MODEL || DEEPSEEK_DEFAULT_MODEL;
}

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

export default function App() {
  const { isDark, toggleTheme } = useTheme();
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
  const [apiKey, setApiKey] = useState(getApiKey);
  const annotationsRef = useRef({});
  const reviewStartedAtRef = useRef(Date.now());
  const currentConversation = conversations[currentIndex];

  useEffect(() => {
    let ignore = false;

    async function loadConversations() {
      try {
        const response = await fetch('/data/conversations.json');
        if (!response.ok) {
          throw new Error(`读取对话数据失败：${response.status}`);
        }

        const data = await response.json();
        if (!ignore) {
          setConversations(Array.isArray(data) ? data : []);
          setLoading(false);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : '读取对话数据失败');
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
        error: ''
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
    setSaveState(`已自动保存 · ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`);
  }, [annotations, conversations.length]);

  const totalCount = conversations.length;
  const currentId = currentConversation?.id || '-';
  const userContent = useMemo(() => getConversationText(currentConversation, 'user'), [currentConversation]);
  const assistantContent = useMemo(() => getConversationText(currentConversation, 'assistant'), [currentConversation]);
  const reviewedCount = Object.keys(annotations).length;
  const completionRate = totalCount ? Math.round((reviewedCount / totalCount) * 100) : 0;
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
        updatedAt: getNowIso()
      });

      return {
        ...previous,
        [currentConversation.id]: nextAnnotation
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
    const startedAt = currentAnnotations[currentConversation.id]?.startedAt || new Date(reviewStartedAtRef.current).toISOString();
    const nextAnnotations = {
      ...currentAnnotations,
      [currentConversation.id]: normalizeAnnotation({
        ...(currentAnnotations[currentConversation.id] || DEFAULT_ANNOTATION),
        ...draft,
        startedAt,
        reviewedAt: nowIso,
        updatedAt: nowIso,
        durationMs: getDurationMs(startedAt)
      })
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

      const result = await analyzeWithDeepSeek({
        apiKey,
        userContent,
        assistantContent,
        model: getModel()
      });

      const nowIso = getNowIso();
      setAnnotations((previous) => {
        const existing = normalizeAnnotation(previous[currentConversation.id] || DEFAULT_ANNOTATION);
        const nextAnnotation = normalizeAnnotation({
          ...existing,
          aiLabels: result.labels,
          aiReason: result.reason,
          aiAt: nowIso,
          startedAt: existing.startedAt || new Date(reviewStartedAtRef.current).toISOString(),
          updatedAt: nowIso
        });

        return {
          ...previous,
          [currentConversation.id]: nextAnnotation
        };
      });

      annotationsRef.current = {
        ...annotationsRef.current,
        [currentConversation.id]: normalizeAnnotation({
          ...(annotationsRef.current[currentConversation.id] || DEFAULT_ANNOTATION),
          aiLabels: result.labels,
          aiReason: result.reason,
          aiAt: nowIso,
          startedAt: annotationsRef.current[currentConversation.id]?.startedAt || new Date(reviewStartedAtRef.current).toISOString(),
          updatedAt: nowIso
        })
      };

      setAnalysisState({
        status: 'success',
        reason: result.reason,
        labels: result.labels,
        error: ''
      });
      setSaveState('AI 建议已保存');
    } catch (analyzeError) {
      setAnalysisState({
        status: 'error',
        reason: '',
        labels: [],
        error: analyzeError instanceof Error ? analyzeError.message : 'AI 分析失败'
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
      setSaveState('已清除会话内 DeepSeek API Key');
      return;
    }

    setApiKey(trimmedApiKey);
    setSaveState('DeepSeek API Key 已导入到当前会话');
  };

  const handleClearApiKey = () => {
    setApiKey('');
    setSaveState('已清除会话内 DeepSeek API Key');
  };

  const goPrev = () => setCurrentIndex((index) => Math.max(index - 1, 0));
  const goNext = () => setCurrentIndex((index) => Math.min(index + 1, conversations.length - 1));

  const themeLabel = isDark ? '切换浅色模式' : '切换深色模式';

  useKeyboardShortcuts({
    onNext: goNext,
    onSave: handleSave,
    onAnalyze: handleAnalyze,
    onToggleTheme: toggleTheme,
    onToggleLabelShortcut: handleShortcutLabel,
    onSetScoreShortcut: handleScoreChange
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="glass-card rounded-3xl px-8 py-6 text-sm text-slate-600 dark:text-slate-300">正在加载对话数据...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="glass-card max-w-xl rounded-3xl px-8 py-6 text-sm text-rose-600 dark:text-rose-300">{error}</div>
      </div>
    );
  }

  if (!currentConversation) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="glass-card rounded-3xl px-8 py-6 text-sm text-slate-600 dark:text-slate-300">暂无对话数据</div>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-clip px-4 py-5 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-radial-soft opacity-100" />

      <div className="relative mx-auto flex w-full max-w-[1600px] flex-col gap-5">
        <header className="glass-card rounded-[32px] px-5 py-4 md:px-6 md:py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-600 dark:text-cyan-300">Customer Review QA</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">智能客服对话质检平台</h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                企业级审核工作台，支持聊天式对话浏览、标签标注、1~5 分评分、AI 辅助建议、自动保存、CSV 导出和快捷键高频操作。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
              <div className="rounded-3xl bg-slate-900 px-4 py-3 text-white dark:bg-white dark:text-slate-900">
                <p className="text-xs text-white/70 dark:text-slate-500">当前对话 ID</p>
                <p className="mt-1 text-lg font-semibold">{currentId}</p>
              </div>
              <div className="rounded-3xl bg-cyan-500 px-4 py-3 text-white">
                <p className="text-xs text-white/75">当前进度</p>
                <p className="mt-1 text-lg font-semibold">{progressLabel}</p>
              </div>
              <div className="rounded-3xl bg-slate-100 px-4 py-3 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <p className="text-xs text-slate-500 dark:text-slate-400">已标注</p>
                <p className="mt-1 text-lg font-semibold">
                  {reviewedCount} / {totalCount}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 transition-all" style={{ width: `${completionRate}%` }} />
          </div>
        </header>

        <Dashboard analytics={analytics} reviewerStatus={REVIEWER_PROFILE} hasApiKey={hasApiKey} isDark={isDark} />

        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr] xl:items-start">
          <div className="space-y-5 xl:sticky xl:top-5 xl:self-start">
            <ConversationPanel conversation={currentConversation} currentIndex={currentIndex} totalCount={totalCount} />
          </div>

          <div className="space-y-5">
            <section className="rounded-[32px] border border-white/60 bg-white/75 p-5 shadow-glow backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/75 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">审核工作台</h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">标签、评分、备注和 AI 建议都在这里完成。</p>
                </div>
                <div className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  自动保存状态：{saveState || '等待编辑'}
                </div>
              </div>

              <div className="mt-5 rounded-[28px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">当前标签</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {draft.labels.length ? (
                    draft.labels.map((label) => (
                      <span key={label} className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-300">
                        {getLabelDisplayName(label)}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500 dark:text-slate-400">尚未选择标签</span>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <LabelSelector selectedLabels={draft.labels} onToggleLabel={handleToggleLabel} />
              </div>

              <div className="mt-4">
                <ScoreSelector selectedScore={draft.score || 3} onChangeScore={handleScoreChange} />
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">备注</label>
                <textarea
                  value={draft.comment}
                  onChange={handleCommentChange}
                  rows={4}
                  placeholder="填写人工审核备注，例如：回复准确但缺少退款时效说明"
                  className="soft-input resize-none"
                />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">本次审核</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="whitespace-nowrap rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-900">评分：{draft.score || 3} 分</span>
                    <span className="whitespace-nowrap rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-900">标签：{draft.labels.length}</span>
                    <span className="whitespace-nowrap rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-900">AI 建议：{analysisState.labels.length || 0}</span>
                    <span className="whitespace-nowrap rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-900">耗时：{analytics.avgDurationMs ? '可统计' : '待生成'}</span>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">配置提示</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                    AI 分析依赖 <span className="font-medium text-slate-900 dark:text-white">DeepSeek API Key</span>，当前版本只保存在本次会话中，不会写入 localStorage。
                  </p>
                  <div className="mt-3 flex flex-col gap-3 rounded-2xl bg-slate-100 px-3 py-3 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      当前状态：{hasApiKey ? '已配置' : '未配置'} · 关闭页面后会失效
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleImportApiKey}
                        className="rounded-full border border-cyan-200 bg-cyan-500/10 px-3 py-1.5 text-cyan-800 transition hover:border-cyan-300 hover:bg-cyan-500/15 dark:border-cyan-900 dark:text-cyan-200"
                      >
                        导入 API
                      </button>
                      <button
                        type="button"
                        onClick={handleClearApiKey}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600 transition hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:text-slate-100"
                      >
                        清除
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <AnalysisPanel analysisState={analysisState} isAnalyzing={isAnalyzing} hasApiKey={hasApiKey} onAnalyze={handleAnalyze} />
              </div>

              <div className="mt-4 rounded-[28px] border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                <p className="font-semibold text-slate-900 dark:text-white">快捷键提示</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {QUICK_SHORTCUTS.map((item) => (
                    <span key={item.key} className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                      {item.key} · {item.label}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>

        <section className="glass-card rounded-[32px] px-5 py-5 md:px-6 md:py-6">
          <ActionBar
            onPrev={goPrev}
            onNext={goNext}
            onSave={handleSave}
            onExport={handleExport}
            onAnalyze={handleAnalyze}
            canPrev={currentIndex > 0}
            canNext={currentIndex < conversations.length - 1}
            isAnalyzing={isAnalyzing}
            isSaving={isSaving}
            hasApiKey={hasApiKey}
            onToggleTheme={toggleTheme}
            themeLabel={themeLabel}
          />
        </section>

        <footer className="pb-2 text-center text-xs text-slate-500 dark:text-slate-400">
          本地标注会自动保存到浏览器 localStorage · 支持导出 CSV · 支持快捷键 · 共 {LABELS.length} 个标签
        </footer>
      </div>
    </main>
  );
}