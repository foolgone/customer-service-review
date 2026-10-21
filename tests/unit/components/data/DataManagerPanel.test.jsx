/**
 * DataManagerPanel 组件测试
 * 覆盖：概览统计、筛选（关键词/标签/评分/状态）、清空、分页、跳转、导出筛选结果、导入历史、Esc 关闭
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataManagerPanel from '../../../../src/components/data/DataManagerPanel.jsx';
import { addImportHistory } from '../../../../src/lib/storage.js';

function makeConversation(id, user, assistant) {
  return {
    id,
    turns: [
      { role: 'user', content: user },
      { role: 'assistant', content: assistant }
    ]
  };
}

const conversations = [
  makeConversation('001', '耳机左耳没声音，能退款吗', '7 天内可申请退款'),
  makeConversation('002', '包裹显示签收但没收到', '建议先查门卫和快递柜'),
  makeConversation('003', '优惠券怎么用不了', '满 200 可用')
];

const annotations = {
  '001': { labels: ['accurate'], score: 5, reviewedAt: '2026-10-21T08:00:00.000Z' },
  '002': { labels: ['risky'], score: 2 },
  '003': { labels: [], score: 3, aiLabels: ['accurate'], aiReason: '准确' }
};

function renderPanel(overrides = {}) {
  const props = {
    open: true,
    conversations,
    annotations,
    onClose: vi.fn(),
    onJump: vi.fn(),
    onExportFiltered: vi.fn(),
    ...overrides
  };
  const utils = render(<DataManagerPanel {...props} />);
  return { ...utils, props };
}

function getDialog() {
  return screen.getByRole('dialog', { name: '数据管理' });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DataManagerPanel 概览与表格', () => {
  it('open=false → 不渲染', () => {
    renderPanel({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('渲染 dialog 语义、概览统计与三行数据', () => {
    renderPanel();

    const dialog = getDialog();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('总对话')).toBeInTheDocument();
    expect(within(dialog).getAllByText('已审核').length).toBeGreaterThan(0);
    expect(within(dialog).getByRole('button', { name: '查看 #001' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '查看 #002' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '查看 #003' })).toBeInTheDocument();
  });

  it('空数据 → 显示空结果提示', () => {
    renderPanel({ conversations: [], annotations: {} });

    expect(screen.getByText('没有匹配的对话，试试调整筛选条件')).toBeInTheDocument();
  });
});

describe('DataManagerPanel 筛选', () => {
  it('关键词搜索命中对话并更新计数', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText('搜索对话'), '签收');

    expect(screen.getByRole('button', { name: '查看 #002' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '查看 #001' })).not.toBeInTheDocument();
    expect(screen.getByText('命中 1 / 3 条')).toBeInTheDocument();
  });

  it('状态筛选：仅未审核 → 只显示 003', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.selectOptions(screen.getByLabelText('审核状态'), 'pending');

    expect(screen.getByRole('button', { name: '查看 #003' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '查看 #001' })).not.toBeInTheDocument();
  });

  it('标签与评分筛选可组合，点击清空恢复全部', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: '风险回复' }));
    await user.click(screen.getByRole('button', { name: '2 分' }));

    expect(screen.getByRole('button', { name: '查看 #002' })).toBeInTheDocument();
    expect(screen.getByText('命中 1 / 3 条')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '清空筛选' }));

    expect(screen.getByText('命中 3 / 3 条')).toBeInTheDocument();
  });

  it('标签按钮 aria-pressed 反映选中态', async () => {
    const user = userEvent.setup();
    renderPanel();

    const labelButton = screen.getByRole('button', { name: '风险回复' });
    expect(labelButton).toHaveAttribute('aria-pressed', 'false');

    await user.click(labelButton);
    expect(labelButton).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('DataManagerPanel 分页与跳转', () => {
  it('超过每页 15 条 → 下一页可用，页码同步', async () => {
    const user = userEvent.setup();
    const manyConversations = Array.from({ length: 18 }, (_, index) =>
      makeConversation(String(index + 1).padStart(3, '0'), `用户消息 ${index + 1}`, `客服回复 ${index + 1}`)
    );
    renderPanel({ conversations: manyConversations, annotations: {} });

    expect(screen.getByText('第 1 / 2 页')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '下一页' }));

    expect(screen.getByText('第 2 / 2 页')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();
  });

  it('点击「查看 #id」→ onJump 收到对话 ID', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.click(screen.getByRole('button', { name: '查看 #002' }));

    expect(props.onJump).toHaveBeenCalledWith('002');
  });
});

describe('DataManagerPanel 导出与导入历史', () => {
  it('点击导出筛选结果 → onExportFiltered 收到当前筛选结果，面板内即时提示（BUG-32 已修复）', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.type(screen.getByLabelText('搜索对话'), '签收');
    await user.click(screen.getByRole('button', { name: '导出筛选结果 CSV' }));

    expect(props.onExportFiltered).toHaveBeenCalledTimes(1);
    expect(props.onExportFiltered.mock.calls[0][0].map((item) => item.id)).toEqual(['002']);
    expect(await screen.findByText('已导出筛选结果 1 条')).toBeInTheDocument();
  });

  it('纯空白关键词 → 显示「清空筛选」入口（BUG-33 已修复）', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText('搜索对话'), '   ');

    expect(screen.getByRole('button', { name: '清空筛选' })).toBeInTheDocument();
  });

  it('结果表格具备可访问性标注（BUG-35 已修复）', () => {
    renderPanel();

    expect(screen.getByRole('table', { name: '对话筛选结果' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '对话筛选结果表格（可横向滚动）' })).toHaveAttribute('tabindex', '0');
  });

  it('有导入历史 → 展示文件名/格式/有效条数；无历史 → 提示暂无', () => {
    addImportHistory({ fileName: 'a.csv', format: 'CSV', total: 10, valid: 8, invalid: 2 });
    renderPanel();

    expect(screen.getByText('a.csv')).toBeInTheDocument();
    expect(screen.getByText(/CSV · 有效 8\/10/)).toBeInTheDocument();
  });

  it('无导入历史 → 提示暂无导入记录', () => {
    renderPanel();
    expect(screen.getByText('暂无导入记录')).toBeInTheDocument();
  });
});

describe('DataManagerPanel 关闭', () => {
  it('Esc 关闭面板', () => {
    const { props } = renderPanel();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩关闭；点击内容区不关闭', () => {
    const { props } = renderPanel();

    fireEvent.click(screen.getByRole('heading', { name: '数据管理' }));
    expect(props.onClose).not.toHaveBeenCalled();

    fireEvent.click(getDialog().parentElement);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

