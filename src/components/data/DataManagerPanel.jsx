import { useDeferredValue, useMemo, useState } from 'react';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { LABELS } from '../../lib/constants';
import {
  DEFAULT_FILTERS,
  STATUS_OPTIONS,
  filterConversations,
  hasActiveFilters,
  normalizeFilters,
  paginate,
  summarizeConversations
} from '../../lib/filters';
import { formatLabelList, toLabelArray } from '../../lib/labels';
import { isHumanReviewed } from '../../lib/analytics';
import { getImportHistory } from '../../lib/storage';

const TITLE_ID = 'data-manager-title';
const PAGE_SIZE = 15;
const IMPORT_HISTORY_LIMIT = 5;

function getConversationText(conversation, role) {
  return conversation?.turns?.find((turn) => turn.role === role)?.content || '';
}

function formatHistoryTime(value) {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString('zh-CN', { hour12: false });
}

function StatusBadge({ reviewed, hasAi }) {
  return (
    <div className="flex flex-wrap gap-1">
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
          reviewed ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
        }`}
      >
        {reviewed ? '已审核' : '未审核'}
      </span>
      {hasAi ? (
        <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-700 dark:text-cyan-300">AI</span>
      ) : null}
    </div>
  );
}

export default function DataManagerPanel({ open, conversations = [], annotations = {}, onClose, onJump, onExportFiltered }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState({ type: '', text: '' });
  const dialogRef = useDialogA11y({ open, onClose });

  // BUG-34：大数据集下输入保持流畅，过滤跟随延迟值
  const deferredKeyword = useDeferredValue(filters.keyword);
  const deferredFilters = useMemo(
    () => normalizeFilters({ ...filters, keyword: deferredKeyword }),
    [filters, deferredKeyword]
  );

  const stats = useMemo(() => summarizeConversations(conversations, annotations), [conversations, annotations]);
  const filtered = useMemo(
    () => filterConversations(conversations, annotations, deferredFilters),
    [conversations, annotations, deferredFilters]
  );
  const paged = useMemo(() => paginate(filtered, page, PAGE_SIZE), [filtered, page]);
  // BUG-33：输入框非空（哪怕只有空格）也提供「清空筛选」入口
  const active = hasActiveFilters(filters) || filters.keyword.length > 0;
  const importHistory = useMemo(() => getImportHistory().slice(0, IMPORT_HISTORY_LIMIT), [open]);

  if (!open) {
    return null;
  }

  const handleExportFiltered = () => {
    if (!filtered.length) {
      return;
    }

    try {
      onExportFiltered?.(filtered);
      // BUG-32：面板内即时反馈，不再只写工作台状态
      setMessage({ type: 'success', text: `已导出筛选结果 ${filtered.length} 条` });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '导出筛选结果失败' });
    }
  };

  const updateFilters = (patch) => {
    setFilters((previous) => normalizeFilters({ ...previous, ...patch }));
    setPage(1);
  };

  const toggleLabel = (label) => {
    const selected = filters.labels.includes(label)
      ? filters.labels.filter((item) => item !== label)
      : [...filters.labels, label];

    updateFilters({ labels: selected });
  };

  const toggleScore = (score) => {
    const selected = filters.scores.includes(score)
      ? filters.scores.filter((item) => item !== score)
      : [...filters.scores, score];

    updateFilters({ scores: selected });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white shadow-[0_40px_120px_-40px_rgba(15,23,42,0.6)] dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-300">Data</p>
            <h2 id={TITLE_ID} className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">数据管理</h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">筛选/搜索当前数据集，查看导入历史，并跳转到指定对话。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:text-white"
          >
            关闭
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { label: '总对话', value: stats.total },
              { label: '已审核', value: stats.reviewed },
              { label: '未审核', value: stats.pending },
              { label: '有 AI 建议', value: stats.withAi },
              { label: '问题对话', value: stats.problem }
            ].map((item) => (
              <div key={item.label} className="rounded-2xl bg-slate-100 px-3 py-2 text-center dark:bg-slate-950/60">
                <p className="text-lg font-semibold text-slate-900 dark:text-white">{item.value}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={filters.keyword}
                onChange={(event) => updateFilters({ keyword: event.target.value })}
                placeholder="搜索对话 ID / 用户消息 / 客服回复"
                aria-label="搜索对话"
                className="soft-input min-w-[16rem] flex-1 py-2 text-sm"
              />
              <select
                value={filters.status}
                onChange={(event) => updateFilters({ status: event.target.value })}
                aria-label="审核状态"
                className="soft-input w-auto min-w-[8rem] appearance-none py-2 text-sm"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {active ? (
                <button
                  type="button"
                  onClick={() => {
                    setFilters(DEFAULT_FILTERS);
                    setPage(1);
                  }}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300"
                >
                  清空筛选
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-400">标签</span>
              {LABELS.map((label) => {
                const selected = filters.labels.includes(label.value);
                return (
                  <button
                    key={label.value}
                    type="button"
                    onClick={() => toggleLabel(label.value)}
                    aria-pressed={selected}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      selected
                        ? 'border-cyan-400 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-300 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300'
                    }`}
                  >
                    {label.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-400">评分</span>
              {[5, 4, 3, 2, 1].map((score) => {
                const selected = filters.scores.includes(score);
                return (
                  <button
                    key={score}
                    type="button"
                    onClick={() => toggleScore(score)}
                    aria-pressed={selected}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      selected
                        ? 'border-cyan-400 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-300 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300'
                    }`}
                  >
                    {score} 分
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">筛选结果</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                命中 {filtered.length} / {stats.total} 条
              </p>
            </div>

            <div
              className="mt-2 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800"
              tabIndex={0}
              role="region"
              aria-label="对话筛选结果表格（可横向滚动）"
            >
              <table aria-label="对话筛选结果" className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950/60">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2 font-medium text-slate-600 dark:text-slate-400">ID</th>
                    <th className="px-3 py-2 font-medium text-slate-600 dark:text-slate-400">用户消息</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium text-slate-600 dark:text-slate-400">标签</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium text-slate-600 dark:text-slate-400">评分</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium text-slate-600 dark:text-slate-400">状态</th>
                    <th className="whitespace-nowrap px-3 py-2 font-medium text-slate-600 dark:text-slate-400">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {paged.items.length ? (
                    paged.items.map((conversation) => {
                      const annotation = annotations?.[conversation.id] || {};
                      const labels = toLabelArray(annotation.labels);
                      const hasAi = Array.isArray(annotation.aiLabels) && annotation.aiLabels.length > 0;

                      return (
                        <tr key={conversation.id} className="align-top">
                          <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{conversation.id}</td>
                          <td className="max-w-[22rem] px-3 py-2 text-slate-600 dark:text-slate-300">
                            <span className="line-clamp-2">{getConversationText(conversation, 'user') || '-'}</span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">{formatLabelList(labels) || '-'}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">
                            {Number(annotation.score) ? `${Number(annotation.score)} 分` : '-'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            <StatusBadge reviewed={isHumanReviewed(annotation)} hasAi={hasAi} />
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            <button
                              type="button"
                              onClick={() => onJump?.(conversation.id)}
                              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300"
                            >
                              查看 #{conversation.id}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-slate-600 dark:text-slate-400">
                        没有匹配的对话，试试调整筛选条件
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400">
              <span>
                第 {paged.page} / {paged.pageCount} 页
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                  disabled={paged.page <= 1}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300"
                >
                  上一页
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(current + 1, paged.pageCount))}
                  disabled={paged.page >= paged.pageCount}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300"
                >
                  下一页
                </button>
              </div>
            </div>
          </div>

          <section className="border-t border-slate-200 pt-4 dark:border-slate-800">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">导入历史</h3>
              <span className="text-xs text-slate-600 dark:text-slate-400">最近 {importHistory.length} 条</span>
            </div>
            {importHistory.length ? (
              <ul className="mt-2 space-y-2 text-xs">
                {importHistory.map((item, index) => (
                  <li
                    key={`${item.fileName}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-slate-50 px-3 py-2 dark:bg-slate-950/60"
                  >
                    <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">{item.fileName}</span>
                    <span className="shrink-0 text-slate-600 dark:text-slate-400">
                      {item.format} · 有效 {item.valid}/{item.total} · {formatHistoryTime(item.importedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">暂无导入记录</p>
            )}
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
          <span
            className={`min-h-[1rem] text-xs ${
              message.type === 'error'
                ? 'text-rose-600 dark:text-rose-300'
                : message.type === 'success'
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {message.text || `导出内容为当前筛选结果（${filtered.length} 条）`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportFiltered}
              disabled={!filtered.length}
              className="primary-button border border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:text-cyan-700 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200"
            >
              导出筛选结果 CSV
            </button>
            <button
              type="button"
              onClick={onClose}
              className="primary-button bg-cyan-500 text-white hover:bg-cyan-600"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
