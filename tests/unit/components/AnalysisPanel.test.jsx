/**
 * AnalysisPanel 组件单元测试
 * 覆盖：idle/success/error/analyzing 四种状态的标题与内容、折叠/展开、
 *       建议标签中文映射、理由 tab、空标签与空理由兜底、重新分析按钮可用性与回调。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnalysisPanel from '../../../src/components/AnalysisPanel';

const IDLE_STATE = { status: 'idle', labels: [], reason: '', error: '' };

function renderPanel(analysisState, overrides = {}) {
  const props = {
    analysisState,
    isAnalyzing: false,
    hasApiKey: true,
    onAnalyze: vi.fn(),
    ...overrides
  };

  render(<AnalysisPanel {...props} />);
  return props;
}

describe('AnalysisPanel', () => {
  it('status=idle：标题「AI 辅助分析」，默认折叠并显示摘要提示', () => {
    renderPanel(IDLE_STATE);

    expect(screen.getByRole('heading', { name: 'AI 辅助分析' })).toBeInTheDocument();
    expect(screen.getByText('折叠模式 · AI 仅保留摘要')).toBeInTheDocument();
    expect(screen.getByText('按需展开查看')).toBeInTheDocument();
    expect(screen.queryByText('点击分析后这里会展示建议标签和理由。')).not.toBeInTheDocument();
  });

  it('status=idle：点击「展开」显示空态引导文案，点击「收起」恢复折叠', async () => {
    const user = userEvent.setup();
    renderPanel(IDLE_STATE);

    await user.click(screen.getByRole('button', { name: '展开' }));
    expect(screen.getByText('点击分析后这里会展示建议标签和理由。')).toBeInTheDocument();
    expect(screen.queryByText('折叠模式 · AI 仅保留摘要')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '收起' }));
    expect(screen.getByText('折叠模式 · AI 仅保留摘要')).toBeInTheDocument();
    expect(screen.queryByText('点击分析后这里会展示建议标签和理由。')).not.toBeInTheDocument();
  });

  it('无 apiKey 时「重新分析」禁用', () => {
    renderPanel(IDLE_STATE, { hasApiKey: false });

    expect(screen.getByRole('button', { name: '重新分析' })).toBeDisabled();
  });

  it('isAnalyzing=true 时「重新分析」禁用且文案为「分析中...」', () => {
    renderPanel(IDLE_STATE, { isAnalyzing: true, hasApiKey: true });

    const button = screen.getByRole('button', { name: '分析中...' });
    expect(button).toBeDisabled();
    expect(screen.queryByRole('button', { name: '重新分析' })).not.toBeInTheDocument();
  });

  it('可用状态下点击「重新分析」触发 onAnalyze', async () => {
    const props = renderPanel(IDLE_STATE, { hasApiKey: true, isAnalyzing: false });
    const user = userEvent.setup();

    const analyzeButton = screen.getByRole('button', { name: '重新分析' });
    expect(analyzeButton).toBeEnabled();

    await user.click(analyzeButton);
    expect(props.onAnalyze).toHaveBeenCalledTimes(1);
  });

  it('status=success：标题「已得到 AI 建议」并自动展开，建议标签显示中文名', () => {
    renderPanel({ status: 'success', labels: ['accurate', 'off_topic'], reason: '回复准确且覆盖用户问题', error: '' });

    expect(screen.getByRole('heading', { name: '已得到 AI 建议' })).toBeInTheDocument();
    // 自动展开：tab 与建议内容直接可见
    expect(screen.getByRole('button', { name: 'AI 建议' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AI 理由' })).toBeInTheDocument();
    expect(screen.getByText('回复准确')).toBeInTheDocument();
    expect(screen.getByText('跑题')).toBeInTheDocument();
    expect(screen.queryByText('折叠模式 · AI 仅保留摘要')).not.toBeInTheDocument();
  });

  it('status=success：切到「AI 理由」tab 显示 reason', async () => {
    const user = userEvent.setup();
    renderPanel({ status: 'success', labels: ['accurate'], reason: '模型判断回复准确', error: '' });

    await user.click(screen.getByRole('button', { name: 'AI 理由' }));

    expect(screen.getByText('模型判断回复准确')).toBeInTheDocument();
    expect(screen.getByText('判断理由')).toBeInTheDocument();
    expect(screen.queryByText('回复准确')).not.toBeInTheDocument();
  });

  it('status=success：labels 为空显示「模型未返回建议标签」，reason 为空显示兜底文案', async () => {
    const user = userEvent.setup();
    renderPanel({ status: 'success', labels: [], reason: '', error: '' });

    expect(screen.getByText('模型未返回建议标签')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'AI 理由' }));
    expect(
      screen.getByText('模型未返回理由，请检查返回内容是否包含 reason / analysis / explanation。')
    ).toBeInTheDocument();
  });

  it('status=success：未知标签值回退显示原始字符串', () => {
    renderPanel({ status: 'success', labels: ['custom_label'], reason: '', error: '' });

    expect(screen.getByText('custom_label')).toBeInTheDocument();
  });

  it('status=success：点击「收起」后折叠，并显示已生成标签数量摘要', async () => {
    const user = userEvent.setup();
    renderPanel({ status: 'success', labels: ['accurate', 'risky'], reason: '理由', error: '' });

    await user.click(screen.getByRole('button', { name: '收起' }));

    expect(screen.getByText('折叠模式 · AI 仅保留摘要')).toBeInTheDocument();
    expect(screen.getByText('已生成 2 个建议标签')).toBeInTheDocument();
    expect(screen.queryByText('回复准确')).not.toBeInTheDocument();
  });

  it('status=error：标题「AI 分析失败」，展开后显示错误文案', async () => {
    const user = userEvent.setup();
    renderPanel({ status: 'error', labels: [], reason: '', error: '调用失败：401 未授权' });

    expect(screen.getByRole('heading', { name: 'AI 分析失败' })).toBeInTheDocument();
    expect(screen.queryByText('调用失败：401 未授权')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '展开' }));
    expect(screen.getByText('调用失败：401 未授权')).toBeInTheDocument();
  });

  it('status=analyzing：标题「AI 正在分析」，展开后显示调用提示', async () => {
    const user = userEvent.setup();
    renderPanel({ status: 'analyzing', labels: [], reason: '', error: '' }, { isAnalyzing: true });

    expect(screen.getByRole('heading', { name: 'AI 正在分析' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '分析中...' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '展开' }));
    expect(screen.getByText('正在调用 DeepSeek 进行分析...')).toBeInTheDocument();
  });
});
