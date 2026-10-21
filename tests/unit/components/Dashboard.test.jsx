/**
 * Dashboard 组件冒烟测试
 * 使用真实 buildAnalytics 生成数据，断言：标题/状态胶囊、4 张指标卡、审核员信息、
 * 历史标签统计 6 项、最近审核记录、空数据兜底。不断言 recharts 图表内部。
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Dashboard from '../../../src/components/Dashboard';
import { buildAnalytics } from '../../../src/lib/analytics';
import { LABELS, REVIEWER_PROFILE } from '../../../src/lib/constants';
import { makeAnnotation, makeConversation } from '../../helpers/file';

const conversations = [
  makeConversation('conv-1', {
    userContent: '请问什么时候发货？',
    assistantContent: '预计 48 小时内发货'
  }),
  makeConversation('conv-2', {
    userContent: '我要退款',
    assistantContent: '已为您登记退款'
  })
];

const annotations = {
  'conv-1': makeAnnotation({
    labels: ['accurate'],
    score: 5,
    aiLabels: ['accurate'],
    aiReason: '回复准确',
    durationMs: 120000
  }),
  'conv-2': makeAnnotation({
    labels: ['risky'],
    score: 2,
    aiLabels: [],
    durationMs: 120000,
    comment: '存在风险承诺'
  })
};

const analytics = buildAnalytics(conversations, annotations);

describe('Dashboard', () => {
  it('渲染标题「企业级审核概览」与状态胶囊（深色模式 / DeepSeek 已接入）', () => {
    render(<Dashboard analytics={analytics} reviewerStatus={REVIEWER_PROFILE} hasApiKey isDark />);

    expect(screen.getByRole('heading', { name: '企业级审核概览' })).toBeInTheDocument();
    expect(screen.getByText('深色模式')).toBeInTheDocument();
    expect(screen.getByText('DeepSeek 已接入')).toBeInTheDocument();
    expect(screen.getByText(REVIEWER_PROFILE.status)).toBeInTheDocument();
  });

  it('渲染 4 张指标卡标签与对应数值', () => {
    render(<Dashboard analytics={analytics} reviewerStatus={REVIEWER_PROFILE} hasApiKey isDark />);

    const metrics = [
      { label: '已审核数量', value: '2' },
      { label: '回复准确率', value: '50%' },
      { label: 'AI 建议采纳率', value: '100%' },
      { label: '平均审核耗时', value: '2m 0s' }
    ];

    metrics.forEach(({ label, value }) => {
      const labelElement = screen.getByText(label);
      expect(labelElement).toBeInTheDocument();
      // MetricCard 结构：label / value / hint 同属一个父容器
      expect(within(labelElement.parentElement).getByText(value)).toBeInTheDocument();
    });
  });

  it('渲染审核员姓名「质检员」与团队「智能客服审核组」', () => {
    render(<Dashboard analytics={analytics} reviewerStatus={REVIEWER_PROFILE} hasApiKey isDark />);

    expect(screen.getByText('质检员')).toBeInTheDocument();
    expect(screen.getByText('智能客服审核组')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '当前审核员状态' })).toBeInTheDocument();
    expect(screen.getByText('评分均值：3.5')).toBeInTheDocument();
  });

  it('历史标签统计：展示全部 6 个标签的占比行', () => {
    render(<Dashboard analytics={analytics} reviewerStatus={REVIEWER_PROFILE} hasApiKey isDark />);

    expect(screen.getByRole('heading', { name: '历史标签统计' })).toBeInTheDocument();
    expect(screen.getAllByText(/次 ·/)).toHaveLength(LABELS.length);
  });

  it('最近审核记录：包含 #id、评分与用户消息预览', () => {
    render(<Dashboard analytics={analytics} reviewerStatus={REVIEWER_PROFILE} hasApiKey isDark />);

    expect(screen.getByRole('heading', { name: '最近审核记录' })).toBeInTheDocument();
    expect(screen.getByText('#conv-1')).toBeInTheDocument();
    expect(screen.getByText('#conv-2')).toBeInTheDocument();
    expect(screen.getByText('请问什么时候发货？')).toBeInTheDocument();
    expect(screen.getByText('我要退款')).toBeInTheDocument();
    expect(screen.getAllByText('5 分').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2 分').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('风险回复').length).toBeGreaterThanOrEqual(1);
  });

  it('最近审核记录：未知标签值回退显示原始字符串', () => {
    const unknownAnalytics = buildAnalytics(
      [makeConversation('conv-unknown', { userContent: '未知标签场景', assistantContent: '回复内容' })],
      {
        'conv-unknown': makeAnnotation({ labels: ['custom_label'], score: 3, aiLabels: [] })
      }
    );

    render(<Dashboard analytics={unknownAnalytics} reviewerStatus={REVIEWER_PROFILE} hasApiKey={false} isDark={false} />);

    expect(screen.getByText('custom_label')).toBeInTheDocument();
    expect(screen.getByText('#conv-unknown')).toBeInTheDocument();
  });

  it('空 analytics + 未配置 Key：显示「暂无审核记录」「浅色模式」「DeepSeek 未配置」', () => {
    const emptyAnalytics = buildAnalytics([], {});

    render(<Dashboard analytics={emptyAnalytics} reviewerStatus={REVIEWER_PROFILE} hasApiKey={false} isDark={false} />);

    expect(screen.getByText('浅色模式')).toBeInTheDocument();
    expect(screen.getByText('DeepSeek 未配置')).toBeInTheDocument();
    expect(screen.getByText('暂无审核记录')).toBeInTheDocument();

    const reviewedLabel = screen.getByText('已审核数量');
    expect(within(reviewedLabel.parentElement).getByText('0')).toBeInTheDocument();
    expect(within(reviewedLabel.parentElement).getByText('总任务 0 · 待审核 0')).toBeInTheDocument();

    const durationLabel = screen.getByText('平均审核耗时');
    expect(within(durationLabel.parentElement).getByText('平均评分 N/A')).toBeInTheDocument();
  });
});
