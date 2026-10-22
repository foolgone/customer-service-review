/**
 * 分析看板页
 * 由工作台拆出：KPI + 图表（Dashboard）+ 问题对话清单。
 */
import { Suspense } from 'react';
import { Link } from 'react-router-dom';
import Dashboard from '../components/Dashboard';
import DashboardSkeleton from '../components/common/DashboardSkeleton';
import { PROBLEM_LABELS, formatLabelList, toLabelArray } from '../lib/labels';

function getConversationText(conversation, role) {
  return conversation?.turns?.find((turn) => turn.role === role)?.content || '';
}

function buildProblemRows(conversations, annotations, limit = 10) {
  return conversations
    .filter((conversation) =>
      toLabelArray(annotations?.[conversation.id]?.labels).some((label) => PROBLEM_LABELS.has(label)),
    )
    .slice(0, limit)
    .map((conversation, index) => ({
      index,
      conversation,
      labels: toLabelArray(annotations?.[conversation.id]?.labels),
      score: Number(annotations?.[conversation.id]?.score) || 0,
      comment: annotations?.[conversation.id]?.comment || '',
    }));
}

export default function AnalyticsPage({
  analytics,
  reviewerStatus,
  hasApiKey,
  isDark,
  conversations = [],
  annotations = {},
  onOpenConversation,
}) {
  const problemRows = buildProblemRows(conversations, annotations);

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400">Analytics</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">分析看板</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            质检效率、标签分布、评分结构与 AI 采纳率的统一视图。
          </p>
        </div>
        <Link to="/workbench" className="secondary-button">
          返回质检工作台
        </Link>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard analytics={analytics} reviewerStatus={reviewerStatus} hasApiKey={hasApiKey} isDark={isDark} />
      </Suspense>

      <section className="panel">
        <div className="panel-header">
          <h3 className="section-title">问题对话（最多 10 条）</h3>
          <span className="muted">命中「跑题 / 编造 / 态度差 / 未解决 / 风险」的对话</span>
        </div>
        {problemRows.length ? (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>对话 ID</th>
                  <th>用户问题</th>
                  <th>标签</th>
                  <th>评分</th>
                  <th>备注</th>
                  <th className="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {problemRows.map((row) => (
                  <tr key={row.conversation.id}>
                    <td className="whitespace-nowrap font-medium">#{row.conversation.id}</td>
                    <td className="max-w-[26rem]">
                      <span className="line-clamp-2">{getConversationText(row.conversation, 'user')}</span>
                    </td>
                    <td className="whitespace-nowrap">{formatLabelList(row.labels) || '-'}</td>
                    <td className="whitespace-nowrap tabular-nums">{row.score}</td>
                    <td className="max-w-[16rem]">
                      <span className="line-clamp-1">{row.comment || '-'}</span>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <button type="button" className="ghost-button" onClick={() => onOpenConversation?.(row.index)}>
                        去处理
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium">暂无问题对话</p>
            <p className="muted mt-1">打上问题类标签后，这里会自动汇总，便于复核。</p>
          </div>
        )}
      </section>
    </div>
  );
}
