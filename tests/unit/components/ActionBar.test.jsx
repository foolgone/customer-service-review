/**
 * ActionBar 组件单元测试
 * 覆盖：上一条/下一条禁用态与回调、保存中/分析中/未配置 Key 的按钮状态与文案、
 *       批量分析按钮的禁用/运行中文案与回调、默认 props 行为、
 *       导出/导入/主题切换回调、themeLabel 透传、快捷键提示区文案。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActionBar from '../../../src/components/ActionBar';

function renderActionBar(overrides = {}) {
  const props = {
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onSave: vi.fn(),
    onExport: vi.fn(),
    onAnalyze: vi.fn(),
    onImport: vi.fn(),
    onBatchAnalyze: vi.fn(),
    isBatchAnalyzing: false,
    canPrev: true,
    canNext: true,
    isAnalyzing: false,
    isSaving: false,
    hasApiKey: true,
    onToggleTheme: vi.fn(),
    themeLabel: '切换深色模式',
    ...overrides
  };

  render(<ActionBar {...props} />);
  return props;
}

describe('ActionBar', () => {
  it('canPrev=false / canNext=false 时上一条、下一条按钮均禁用', () => {
    renderActionBar({ canPrev: false, canNext: false });

    expect(screen.getByRole('button', { name: '上一条' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下一条' })).toBeDisabled();
  });

  it('canPrev / canNext 为 true 时可点击并触发对应回调', async () => {
    const props = renderActionBar({ canPrev: true, canNext: true });
    const user = userEvent.setup();

    expect(screen.getByRole('button', { name: '上一条' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '下一条' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '上一条' }));
    await user.click(screen.getByRole('button', { name: '下一条' }));

    expect(props.onPrev).toHaveBeenCalledTimes(1);
    expect(props.onNext).toHaveBeenCalledTimes(1);
  });

  it('isSaving=true：保存按钮文案为「保存中...」且禁用', () => {
    renderActionBar({ isSaving: true });

    expect(screen.getByRole('button', { name: '保存中...' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
  });

  it('isSaving=false：保存按钮文案为「保存」，点击触发 onSave', async () => {
    const props = renderActionBar({ isSaving: false });
    const user = userEvent.setup();

    const saveButton = screen.getByRole('button', { name: '保存' });
    expect(saveButton).toBeEnabled();

    await user.click(saveButton);
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });

  it('isAnalyzing=true：AI 按钮文案为「分析中...」且禁用', () => {
    renderActionBar({ isAnalyzing: true, hasApiKey: true });

    expect(screen.getByRole('button', { name: '分析中...' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'AI 分析' })).not.toBeInTheDocument();
  });

  it('hasApiKey=false：AI 按钮文案为「AI 分析」但禁用', () => {
    renderActionBar({ hasApiKey: false, isAnalyzing: false });

    expect(screen.getByRole('button', { name: 'AI 分析' })).toBeDisabled();
  });

  it('可用状态下点击 AI 分析触发 onAnalyze', async () => {
    const props = renderActionBar({ hasApiKey: true, isAnalyzing: false });
    const user = userEvent.setup();

    const analyzeButton = screen.getByRole('button', { name: 'AI 分析' });
    expect(analyzeButton).toBeEnabled();

    await user.click(analyzeButton);
    expect(props.onAnalyze).toHaveBeenCalledTimes(1);
  });

  it('hasApiKey=true 且未批量分析：「批量分析」按钮可用，点击触发 onBatchAnalyze', async () => {
    const props = renderActionBar({ hasApiKey: true, isBatchAnalyzing: false });
    const user = userEvent.setup();

    const batchButton = screen.getByRole('button', { name: '批量分析' });
    expect(batchButton).toBeEnabled();

    await user.click(batchButton);
    expect(props.onBatchAnalyze).toHaveBeenCalledTimes(1);
  });

  it('hasApiKey=false：「批量分析」按钮禁用', () => {
    renderActionBar({ hasApiKey: false, isBatchAnalyzing: false });

    expect(screen.getByRole('button', { name: '批量分析' })).toBeDisabled();
  });

  it('isBatchAnalyzing=true：文案为「批量分析中...」且禁用', () => {
    renderActionBar({ hasApiKey: true, isBatchAnalyzing: true });

    expect(screen.getByRole('button', { name: '批量分析中...' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '批量分析' })).not.toBeInTheDocument();
  });

  it('未传 isBatchAnalyzing → 默认视为未运行，按钮文案为「批量分析」且可用', () => {
    const props = {
      onPrev: vi.fn(),
      onNext: vi.fn(),
      onSave: vi.fn(),
      onExport: vi.fn(),
      onAnalyze: vi.fn(),
      onImport: vi.fn(),
      onBatchAnalyze: vi.fn(),
      canPrev: true,
      canNext: true,
      isAnalyzing: false,
      isSaving: false,
      hasApiKey: true,
      onToggleTheme: vi.fn(),
      themeLabel: '切换深色模式'
    };

    render(<ActionBar {...props} />);

    expect(screen.getByRole('button', { name: '批量分析' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: '批量分析中...' })).not.toBeInTheDocument();
  });

  it('导出 CSV、导入数据、切换主题按钮点击分别触发各自回调', async () => {
    const props = renderActionBar({ themeLabel: '切换浅色模式' });
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '导出 CSV' }));
    await user.click(screen.getByRole('button', { name: '导入数据' }));
    await user.click(screen.getByRole('button', { name: '切换浅色模式' }));

    expect(props.onExport).toHaveBeenCalledTimes(1);
    expect(props.onImport).toHaveBeenCalledTimes(1);
    expect(props.onToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('themeLabel 文案透传到主题按钮', () => {
    const props = {
      onPrev: vi.fn(),
      onNext: vi.fn(),
      onSave: vi.fn(),
      onExport: vi.fn(),
      onAnalyze: vi.fn(),
      onImport: vi.fn(),
      canPrev: true,
      canNext: true,
      isAnalyzing: false,
      isSaving: false,
      hasApiKey: true,
      onToggleTheme: vi.fn()
    };

    const { rerender } = render(<ActionBar {...props} themeLabel="切换浅色模式" />);
    expect(screen.getByRole('button', { name: '切换浅色模式' })).toBeInTheDocument();

    rerender(<ActionBar {...props} themeLabel="跟随系统" />);
    expect(screen.getByRole('button', { name: '跟随系统' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '切换浅色模式' })).not.toBeInTheDocument();
  });

  it('快捷键提示区包含 Enter / Ctrl+S / A / D / 1-6 / Alt+1-5 文案', () => {
    renderActionBar();

    expect(screen.getByText('快捷键')).toBeInTheDocument();
    expect(screen.getByText('Enter 下一条')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+S 保存')).toBeInTheDocument();
    expect(screen.getByText('A AI 分析')).toBeInTheDocument();
    expect(screen.getByText('D 深色模式')).toBeInTheDocument();
    expect(screen.getByText('1-6 标签')).toBeInTheDocument();
    expect(screen.getByText('Alt+1-5 评分')).toBeInTheDocument();
  });
});
