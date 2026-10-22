import { memo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { LABELS } from '../lib/constants';
import { formatDurationLabel } from '../lib/analytics';
// 图表动画统一关闭：recharts 的 isAnimationActive 只作用于系列组件（Line/Bar/Pie），
// 加在 LineChart/BarChart 容器上无效；这里复用 lib/performance.js 里早已定义但此前未被引用的配置。
import { CHART_ANIMATION_CONFIG } from '../lib/performance';

const PIE_COLORS = ['#06b6d4', '#0f172a', '#3b82f6', '#94a3b8', '#22c55e', '#f59e0b'];
const LABEL_MAP = new Map(LABELS.map((item) => [item.value, item.label]));

function getLabelName(value) {
  return LABEL_MAP.get(value) || value;
}

// 使用 memo 优化 MetricCard
const MetricCard = memo(function MetricCard({ label, value, hint }) {
  return (
    <div className="rounded-[24px] border border-white/60 bg-white/80 p-4 shadow-glow backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/75">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
});

// 优化图表组件，添加 memo
const TrendChart = memo(function TrendChart({ data, isDark, todayReviewCount }) {
  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60 md:p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">最近 7 天审核趋势</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">今日审核量：{todayReviewCount}</p>
        </div>
        <div className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-300">
          今日 {todayReviewCount}
        </div>
      </div>

      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1f2937' : '#e2e8f0'} />
            <XAxis dataKey="date" stroke={isDark ? '#94a3b8' : '#64748b'} />
            <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: isDark ? '#0f172a' : '#ffffff',
                border: `1px solid ${isDark ? '#1f2937' : '#e2e8f0'}`,
                borderRadius: '16px'
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#06b6d4"
              strokeWidth={3}
              dot={{ r: 4 }}
              {...CHART_ANIMATION_CONFIG}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

const LabelChart = memo(function LabelChart({ data, isDark }) {
  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60 md:p-5">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">标签分布</h3>
      <div className="mt-3 h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1f2937' : '#e2e8f0'} />
            <XAxis type="number" stroke={isDark ? '#94a3b8' : '#64748b'} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={84} stroke={isDark ? '#94a3b8' : '#64748b'} />
            <Tooltip
              contentStyle={{
                background: isDark ? '#0f172a' : '#ffffff',
                border: `1px solid ${isDark ? '#1f2937' : '#e2e8f0'}`,
                borderRadius: '16px'
              }}
            />
            <Bar dataKey="value" radius={[0, 16, 16, 0]} fill="#06b6d4" {...CHART_ANIMATION_CONFIG} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

const ScoreChart = memo(function ScoreChart({ data, isDark }) {
  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60 md:p-5">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">评分分布</h3>
      <div className="mt-3 h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1f2937' : '#e2e8f0'} />
            <XAxis dataKey="name" stroke={isDark ? '#94a3b8' : '#64748b'} />
            <YAxis stroke={isDark ? '#94a3b8' : '#64748b'} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: isDark ? '#0f172a' : '#ffffff',
                border: `1px solid ${isDark ? '#1f2937' : '#e2e8f0'}`,
                borderRadius: '16px'
              }}
            />
            <Bar dataKey="value" radius={[16, 16, 0, 0]} fill="#0f172a" {...CHART_ANIMATION_CONFIG} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

const ProgressPieChart = memo(function ProgressPieChart({ reviewedCount, pendingCount, isDark }) {
  const pieData = [
    { name: '已审核', value: reviewedCount },
    { name: '待审核', value: pendingCount }
  ];

  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60 md:p-5">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">审核进度</h3>
      <div className="mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              innerRadius={55}
              outerRadius={82}
              paddingAngle={4}
              {...CHART_ANIMATION_CONFIG}
            >
              {pieData.map((entry, index) => (
                <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: isDark ? '#0f172a' : '#ffffff',
                border: `1px solid ${isDark ? '#1f2937' : '#e2e8f0'}`,
                borderRadius: '16px'
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

// 主组件也使用 memo
export default memo(function Dashboard({ analytics, reviewerStatus, hasApiKey, isDark }) {
  return (
    <section className="rounded-[32px] border border-white/60 bg-white/70 p-5 shadow-glow backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/75 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-600 dark:text-cyan-300">Dashboard</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">企业级审核概览</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">把审核效率、标签趋势、评分分布和 AI 采纳率放在同一层级观察。</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{isDark ? '深色模式' : '浅色模式'}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{hasApiKey ? 'DeepSeek 已接入' : 'DeepSeek 未配置'}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{reviewerStatus.status}</span>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="已审核数量" value={analytics.reviewedCount} hint={`总任务 ${analytics.totalCount} · 待审核 ${analytics.pendingCount}`} />
        <MetricCard label="回复准确率" value={`${analytics.accuracyRate}%`} hint={`风险 ${analytics.riskyRate}% · 幻觉 ${analytics.hallucinationRate}%`} />
        <MetricCard label="AI 建议采纳率" value={`${analytics.aiAdoptionRate}%`} hint="人工结果与 AI 建议完全一致的比例" />
        <MetricCard label="平均审核耗时" value={formatDurationLabel(analytics.avgDurationMs)} hint={`平均评分 ${analytics.avgScore || 'N/A'}`} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="grid gap-4">
          <TrendChart data={analytics.todaySeries} isDark={isDark} todayReviewCount={analytics.todayReviewCount} />

          <div className="grid gap-4 lg:grid-cols-2">
            <LabelChart data={analytics.labelBreakdown} isDark={isDark} />
            <ScoreChart data={analytics.scoreDistribution} isDark={isDark} />
          </div>

          <ProgressPieChart
            reviewedCount={analytics.reviewedCount}
            pendingCount={analytics.pendingCount}
            isDark={isDark}
          />
        </div>

        <div className="grid gap-4">
          <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60 md:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">当前审核员状态</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">企业后台工作台 · 角色状态卡</p>
              </div>
              <div className="h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]" />
            </div>

            <div className="mt-4 rounded-[24px] bg-white/80 p-4 dark:bg-slate-900/80">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-500 text-lg font-semibold text-white">
                  {reviewerStatus.name.slice(0, 1)}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{reviewerStatus.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{reviewerStatus.team}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500 dark:text-slate-400">
                <div className="rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800">状态：{reviewerStatus.status}</div>
                <div className="rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800">API：{hasApiKey ? '已接入' : '未接入'}</div>
                <div className="rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800">评分均值：{analytics.avgScore || 'N/A'}</div>
                <div className="rounded-2xl bg-slate-100 px-3 py-2 dark:bg-slate-800">今日：{analytics.todayReviewCount}</div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60 md:p-5">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">历史标签统计</h3>
            <div className="mt-4 space-y-3">
              {analytics.historicalLabels.map((item) => (
                <div key={item.name}>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{item.name}</span>
                    <span>{item.value} 次 · {item.rate}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-500" style={{ width: `${Math.max(item.rate, item.value ? 8 : 0)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60 md:p-5">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">最近审核记录</h3>
            <div className="mt-4 space-y-3">
              {analytics.recentReviews.length ? (
                analytics.recentReviews.map((record) => (
                  <div key={record.id} className="rounded-2xl bg-white/80 p-3 dark:bg-slate-900/80">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">#{record.id}</p>
                        <p className="mt-1 max-h-12 overflow-hidden text-xs leading-6 text-slate-500 dark:text-slate-400">{record.preview}</p>
                      </div>
                      <div className="rounded-full bg-cyan-500/10 px-2 py-1 text-[10px] font-medium text-cyan-700 dark:text-cyan-300">
                        {record.score} 分
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {record.labels.slice(0, 3).map((label) => (
                        <span key={label} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {getLabelName(label)}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">{record.timeLabel} · {record.durationLabel}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">暂无审核记录</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
