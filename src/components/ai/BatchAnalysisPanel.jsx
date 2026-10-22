import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { createProvider, normalizeConcurrency, runBatchAnalysis, MAX_BATCH_CONCURRENCY } from '../../lib/ai';
import { normalizeAnnotation } from '../../lib/storage';

const SCOPE_OPTIONS = [
  { value: 'unanalyzed', label: '仅未分析', hint: '还没有 AI 建议的对话' },
  { value: 'pending', label: '仅未审核', hint: '还没有人工结论的对话' },
  { value: 'all', label: '全部对话', hint: '重新分析所有对话' },
];

const MAX_ERROR_ITEMS = 50;
const TITLE_ID = 'batch-analysis-title';

function getConversationText(conversation, role) {
  return conversation?.turns?.find((turn) => turn.role === role)?.content || '';
}

function getScopeCandidates(conversations, annotations, scope) {
  return conversations
    .map((conversation) => ({
      id: conversation.id,
      userContent: getConversationText(conversation, 'user'),
      assistantContent: getConversationText(conversation, 'assistant'),
    }))
    .filter((item) => item.userContent || item.assistantContent)
    .filter((item) => {
      const annotation = annotations?.[item.id];
      const normalized = normalizeAnnotation(annotation);
      const hasLabels = normalized.labels.length > 0;
      const hasAi = normalized.aiLabels.length > 0;

      if (scope === 'pending') {
        return !hasLabels && !normalized.reviewedAt;
      }

      if (scope === 'unanalyzed') {
        return !hasAi;
      }

      return true;
    });
}

export default function BatchAnalysisPanel({
  open,
  conversations,
  annotations,
  apiKey,
  model,
  defaultConcurrency = 3,
  onClose,
  onApplyResults,
  onRunningChange,
}) {
  const [scope, setScope] = useState('unanalyzed');
  const [concurrency, setConcurrency] = useState(defaultConcurrency);
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState({ completed: 0, total: 0, success: 0, failed: 0 });
  const [errors, setErrors] = useState([]);
  const [error, setError] = useState('');
  const abortRef = useRef(null);
  const running = status === 'running';
  const dialogRef = useDialogA11y({ open, onClose, disableClose: running });

  const scopeCounts = useMemo(
    () =>
      Object.fromEntries(
        SCOPE_OPTIONS.map((option) => [
          option.value,
          getScopeCandidates(conversations, annotations, option.value).length,
        ]),
      ),
    [conversations, annotations],
  );

  const candidates = useMemo(
    () => getScopeCandidates(conversations, annotations, scope),
    [conversations, annotations, scope],
  );

  useEffect(() => {
    onRunningChange?.(running);
  }, [running, onRunningChange]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      setScope('unanalyzed');
      setConcurrency(defaultConcurrency);
      setStatus('idle');
      setProgress({ completed: 0, total: 0, success: 0, failed: 0 });
      setErrors([]);
      setError('');
    }
  }, [open, defaultConcurrency]);

  const handleStart = useCallback(async () => {
    if (!candidates.length || running) {
      return;
    }

    let provider;

    try {
      provider = createProvider('deepseek', { apiKey, model });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : '无法创建 AI 服务');
      return;
    }

    setError('');
    setErrors([]);
    setStatus('running');
    setProgress({ completed: 0, total: candidates.length, success: 0, failed: 0 });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const outcome = await runBatchAnalysis({
        items: candidates,
        concurrency: normalizeConcurrency(concurrency),
        signal: controller.signal,
        analyze: (item) => provider.analyze(item),
        onProgress: (entry) =>
          setProgress((previous) => ({
            ...previous,
            completed: entry.completed,
            success: previous.success + (entry.status === 'success' ? 1 : 0),
            failed: previous.failed + (entry.status === 'error' ? 1 : 0),
          })),
      });

      const records = outcome.results
        .filter((item) => item.status === 'success')
        .map((item) => ({
          id: item.item.id,
          labels: item.result?.labels || [],
          reason: item.result?.reason || '',
        }));

      const failedItems = outcome.results
        .filter((item) => item.status === 'error')
        .slice(0, MAX_ERROR_ITEMS)
        .map((item) => ({ id: item.item.id, message: item.error }));

      setErrors(failedItems);
      onApplyResults?.(records);
      setStatus(outcome.cancelled ? 'cancelled' : 'done');
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : '批量分析失败');
      setStatus('error');
    } finally {
      abortRef.current = null;
    }
  }, [apiKey, candidates, concurrency, model, onApplyResults, running]);

  if (!open) {
    return null;
  }

  // BUG-16：进度只按「已处理（成功+失败）」计算，取消导致的 skipped 不算完成
  const processed = progress.success + progress.failed;
  const percent = progress.total ? Math.round((processed / progress.total) * 100) : 0;
  const skipped = Math.max(progress.total - processed, 0);
  const summaryText = {
    idle: '选择范围后开始批量分析',
    running: `正在分析：${processed} / ${progress.total}`,
    done: `分析完成：成功 ${progress.success} 条${progress.failed ? ` · 失败 ${progress.failed} 条` : ''}`,
    cancelled: `已取消：完成 ${progress.success} 条${progress.failed ? ` · 失败 ${progress.failed} 条` : ''}${skipped ? ` · 跳过 ${skipped} 条` : ''}`,
    error: '批量分析失败',
  }[status];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget && !running) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/60 bg-white shadow-[0_40px_120px_-40px_rgba(15,23,42,0.6)] dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">
              Batch AI
            </p>
            <h2 id={TITLE_ID} className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              批量 AI 分析
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              逐条调用 DeepSeek 生成建议标签与理由；只写入 AI 建议，不会覆盖人工标注。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:text-white"
          >
            关闭
          </button>
        </div>

        <div className="min-h-[16rem] flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">分析范围</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {SCOPE_OPTIONS.map((option) => {
                const active = scope === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={running}
                    onClick={() => setScope(option.value)}
                    className={`rounded-lg border px-3 py-3 text-left transition disabled:cursor-not-allowed ${
                      active
                        ? 'border-blue-400 bg-blue-500/10 text-blue-800 ring-4 ring-blue-500/10 dark:text-blue-100'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-500/5 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200'
                    }`}
                  >
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{scopeCounts[option.value]} 条</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">并发数</span>
              <select
                value={concurrency}
                disabled={running}
                onChange={(event) => setConcurrency(Number(event.target.value))}
                className="soft-input min-w-[5rem] appearance-none py-2 text-sm"
              >
                {Array.from({ length: MAX_BATCH_CONCURRENCY }, (_, index) => index + 1).map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-400">
              本次将分析 <span className="font-semibold text-slate-900 dark:text-white">{candidates.length}</span> 条 ·
              约消耗 {candidates.length} 次 API 调用
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{summaryText}</p>
              <p className="shrink-0 text-xs text-slate-600 dark:text-slate-400">{percent}%</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-sky-500 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-emerald-700 dark:text-emerald-300">
                成功 {progress.success}
              </span>
              <span className="rounded-full bg-rose-500/10 px-3 py-1 text-rose-700 dark:text-rose-300">
                失败 {progress.failed}
              </span>
              <span className="rounded-full bg-slate-200/70 px-3 py-1 dark:bg-slate-800">
                总计 {progress.total || candidates.length}
              </span>
            </div>
          </div>

          {error ? <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}

          {errors.length ? (
            <details className="rounded-lg border border-rose-200 bg-rose-500/5 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-500/10 dark:text-rose-200">
              <summary className="cursor-pointer font-medium">
                查看 {errors.length} 条失败原因
                {progress.failed > errors.length ? `（共 ${progress.failed} 条，仅展示前 ${errors.length} 条）` : ''}
              </summary>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-2">
                {errors.map((item) => (
                  <li key={item.id} className="leading-6">
                    · #{item.id}：{item.message.length > 160 ? `${item.message.slice(0, 160)}…` : item.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <p className="text-xs text-slate-600 dark:text-slate-400">
            提示：批量分析逐条请求；取消后已完成的结果仍会保存到标注中（AI 建议仍需人工确认）。
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            className="primary-button border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
          >
            关闭
          </button>

          <div className="flex items-center gap-2">
            {running ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="primary-button border border-rose-200 bg-rose-500/10 text-rose-700 hover:bg-rose-500/15 dark:border-rose-900 dark:text-rose-200"
              >
                取消
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStart}
                disabled={!candidates.length || !apiKey}
                className="primary-button bg-blue-700 text-white hover:bg-blue-800"
              >
                {`开始分析 ${candidates.length} 条`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
