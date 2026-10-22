import { useRef, useState } from 'react';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { PROBLEM_LABELS, formatLabelList, toLabelArray } from '../../lib/labels';

const TITLE_ID = 'export-report-title';
const EXPORT_TIMEOUT_MS = 90000;

function getConversationText(conversation, role) {
  return conversation?.turns?.find((turn) => turn.role === role)?.content || '';
}

function formatDate(date = new Date()) {
  return date.toLocaleString('zh-CN', { hour12: false });
}

// BUG-23：弱网下动态 import / 截图可能长时间挂起，加超时避免用户被困在面板里
function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function getProblemConversations(conversations, annotations, limit = 10) {
  return conversations
    .filter((conversation) => {
      const labels = toLabelArray(annotations?.[conversation.id]?.labels);
      return labels.some((label) => PROBLEM_LABELS.has(label));
    })
    .slice(0, limit)
    .map((conversation) => {
      const annotation = annotations[conversation.id] || {};
      return {
        id: conversation.id,
        user: getConversationText(conversation, 'user'),
        labels: toLabelArray(annotation.labels),
        score: Number(annotation.score) || 0,
        comment: annotation.comment || ''
      };
    });
}

export default function ExportReportPanel({ open, conversations = [], annotations = {}, analytics = {}, onClose }) {
  const reportRef = useRef(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const dialogRef = useDialogA11y({ open, onClose, disableClose: Boolean(busy) });

  if (!open) {
    return null;
  }

  const problemConversations = getProblemConversations(conversations, annotations);
  const total = Number(analytics.totalCount) || conversations.length;
  const reviewed = Number(analytics.reviewedCount) || 0;
  const completionRate = total ? Math.round((reviewed / total) * 100) : 0;

  const handleExportExcel = async () => {
    try {
      setBusy('excel');
      // xlsx 体积较大，点击导出时再加载
      const { exportToExcel, getExcelFileName } = await import('../../lib/exporters/excel');
      exportToExcel({ conversations, annotations, analytics }, getExcelFileName());
      setMessage({ type: 'success', text: 'Excel 已导出（含明细 / 统计 / 问题对话三个 Sheet）' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Excel 导出失败' });
    } finally {
      setBusy('');
    }
  };

  const handleExportPdf = async () => {
    try {
      setBusy('pdf');
      setMessage({ type: 'info', text: '正在生成 PDF...' });
      // html2canvas / jspdf 体积较大，点击导出时再加载
      const { exportReportToPdf, getPdfFileName } = await import('../../lib/exporters/pdf');
      await withTimeout(
        exportReportToPdf(reportRef.current, { fileName: getPdfFileName() }),
        EXPORT_TIMEOUT_MS,
        'PDF 生成超时，请重试或减少数据量'
      );
      setMessage({ type: 'success', text: 'PDF 已导出' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'PDF 导出失败' });
    } finally {
      setBusy('');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white shadow-[0_40px_120px_-40px_rgba(15,23,42,0.6)] dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-300">Export</p>
            <h2 id={TITLE_ID} className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">导出质检报告</h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Excel 含明细 / 统计 / 问题对话三个工作表；PDF 为当前预览的报告版式。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={Boolean(busy)}
            className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:text-white"
          >
            关闭
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100 p-4 dark:bg-slate-950/60">
          {/* 报告节点：刻意使用固定浅色样式，保证 PDF 与主题无关、始终白底黑字 */}
          <div ref={reportRef} data-export-report className="mx-auto w-[780px] bg-white px-10 py-8 text-slate-900">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-600">Customer Review QA</p>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight">智能客服对话质检报告</h1>
                <p className="mt-1 text-xs text-slate-600">生成时间：{formatDate()}</p>
              </div>
              <div className="rounded-xl bg-slate-900 px-3 py-2 text-right text-white">
                <p className="text-[10px] uppercase tracking-widest text-white/60">总对话数</p>
                <p className="text-xl font-semibold">{total}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-3">
              {[
                { label: '已审核', value: `${reviewed} / ${total}` },
                { label: '回复准确率', value: `${Number(analytics.accuracyRate) || 0}%` },
                { label: '风险回复率', value: `${Number(analytics.riskyRate) || 0}%` },
                { label: '平均评分', value: Number(analytics.avgScore) || 0 }
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 px-3 py-3">
                  <p className="text-[11px] text-slate-600">{item.label}</p>
                  <p className="mt-1 text-lg font-semibold">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>审核完成率</span>
                <span>{completionRate}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-cyan-500" style={{ width: `${completionRate}%` }} />
              </div>
            </div>

            <div className="mt-6">
              <h2 className="text-sm font-semibold">标签分布</h2>
              <div className="mt-3 space-y-2">
                {(analytics.historicalLabels || []).map((item) => (
                  <div key={item.name} className="flex items-center gap-3 text-xs">
                    <span className="w-24 shrink-0 text-slate-600">{item.name}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-slate-800"
                        style={{ width: `${Math.max(Number(item.rate) || 0, item.value ? 6 : 0)}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right text-slate-600">
                      {Number(item.value) || 0} 次 · {Number(item.rate) || 0}%
                    </span>
                  </div>
                ))}
                {!(analytics.historicalLabels || []).length ? <p className="text-xs text-slate-400">暂无标注数据</p> : null}
              </div>
            </div>

            <div className="mt-6">
              <h2 className="text-sm font-semibold">问题对话（最多 10 条）</h2>
              {problemConversations.length ? (
                <div className="mt-3 divide-y divide-slate-100">
                  {problemConversations.map((item) => (
                    <div key={item.id} className="py-2 text-xs">
                      <div className="flex items-start justify-between gap-4">
                        <p className="font-medium text-slate-700">#{item.id}</p>
                        <p className="shrink-0 text-slate-600">{item.score} 分</p>
                      </div>
                      <p className="mt-1 line-clamp-2 text-slate-600">{item.user}</p>
                      <p className="mt-1 text-slate-600">
                        标签：{formatLabelList(item.labels) || '-'}
                        {item.comment ? ` ｜ 备注：${item.comment}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">暂无问题对话（或尚未标注）</p>
              )}
            </div>

            <p className="mt-8 border-t border-slate-200 pt-3 text-[10px] text-slate-400">
              本报告由智能客服对话质检平台生成 · 数据来源于本地导入与人工审核结果 · AI 建议仅作辅助参考
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
          <div className="min-h-[1.25rem] text-xs">
            {message.text ? (
              <span
                className={
                  message.type === 'error'
                    ? 'text-rose-600 dark:text-rose-300'
                    : message.type === 'success'
                      ? 'text-emerald-600 dark:text-emerald-300'
                      : 'text-slate-600 dark:text-slate-400'
                }
              >
                {message.text}
              </span>
            ) : (
              <span className="text-slate-400 dark:text-slate-600">导出内容包含当前筛选后的全部对话与标注</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={Boolean(busy)}
              className="primary-button border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200"
            >
              关闭
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={Boolean(busy)}
              className="primary-button border border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:text-cyan-700 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200"
            >
              {busy === 'excel' ? '导出中...' : '导出 Excel'}
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={Boolean(busy)}
              className="primary-button bg-cyan-700 text-white hover:bg-cyan-800 disabled:opacity-50"
            >
              {busy === 'pdf' ? '生成中...' : '导出 PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
