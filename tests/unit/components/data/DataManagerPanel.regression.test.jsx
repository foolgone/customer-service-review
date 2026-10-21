/**
 * DataManagerPanel BUG-32~35 专项回归
 * 守护：
 * - BUG-32 面板内导出筛选结果即时反馈（成功/失败）
 * - BUG-33 纯空白关键词也提供清空入口，点击后输入框清空且恢复全量
 * - BUG-34 useDeferredValue 延迟过滤：输入即时回显、结果最终收敛（大数据集）
 * - BUG-35 表格 aria-label 与可聚焦滚动 region（补充断言）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataManagerPanel from '../../../../src/components/data/DataManagerPanel.jsx';

const conversations = [
  {
    id: '001',
    turns: [
      { role: 'user', content: '蓝牙耳机能退款吗' },
      { role: 'assistant', content: '7 天内可申请退款' }
    ]
  },
  {
    id: '002',
    turns: [
      { role: 'user', content: '包裹显示签收但没收到' },
      { role: 'assistant', content: '建议先查快递柜' }
    ]
  }
];

function renderPanel(overrides = {}) {
  const props = {
    open: true,
    conversations,
    annotations: {},
    onClose: vi.fn(),
    onJump: vi.fn(),
    onExportFiltered: vi.fn(),
    ...overrides
  };
  return { ...render(<DataManagerPanel {...props} />), props };
}

beforeEach(() => {
  localStorage.clear();
});

describe('BUG-32 导出筛选结果的面板内即时反馈', () => {
  it('导出成功 → 面板底部显示「已导出筛选结果 N 条」', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.click(screen.getByRole('button', { name: '导出筛选结果 CSV' }));

    expect(props.onExportFiltered).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('已导出筛选结果 2 条')).toBeInTheDocument();
  });

  it('导出失败（Error）→ 面板内显示错误信息，仍可继续操作', async () => {
    const user = userEvent.setup();
    const onExportFiltered = vi.fn(() => {
      throw new Error('磁盘已满');
    });
    renderPanel({ onExportFiltered });

    await user.click(screen.getByRole('button', { name: '导出筛选结果 CSV' }));

    expect(await screen.findByText('磁盘已满')).toBeInTheDocument();
    // 面板仍可用
    expect(screen.getByRole('dialog', { name: '数据管理' })).toBeInTheDocument();
  });

  it('导出失败（非 Error）→ 显示兜底文案', async () => {
    const user = userEvent.setup();
    const onExportFiltered = vi.fn(() => {
      throw 'boom';
    });
    renderPanel({ onExportFiltered });

    await user.click(screen.getByRole('button', { name: '导出筛选结果 CSV' }));

    expect(await screen.findByText('导出筛选结果失败')).toBeInTheDocument();
  });

  it('筛选后导出 → 提示的是当前命中条数', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.type(screen.getByLabelText('搜索对话'), '快递柜');
    await waitFor(() => expect(screen.getByText('命中 1 / 2 条')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: '导出筛选结果 CSV' }));

    expect(props.onExportFiltered.mock.calls[0][0].map((item) => item.id)).toEqual(['002']);
    expect(await screen.findByText('已导出筛选结果 1 条')).toBeInTheDocument();
  });
});

describe('BUG-33 纯空白关键词的清空入口', () => {
  it('输入纯空格 → 出现清空入口；点击后输入框清空、按钮消失、恢复全量', async () => {
    const user = userEvent.setup();
    renderPanel();

    const input = screen.getByLabelText('搜索对话');
    await user.type(input, '   ');

    const clearButton = screen.getByRole('button', { name: '清空筛选' });
    expect(clearButton).toBeInTheDocument();

    await user.click(clearButton);

    expect(input).toHaveValue('');
    expect(screen.queryByRole('button', { name: '清空筛选' })).not.toBeInTheDocument();
    expect(screen.getByText('命中 2 / 2 条')).toBeInTheDocument();
  });
});

describe('BUG-34 大数据集下的延迟搜索', () => {
  it('输入即时回显，过滤结果最终收敛到命中项（deferred 值）', async () => {
    const user = userEvent.setup();
    const largeList = Array.from({ length: 200 }, (_, index) => ({
      id: `c${index + 1}`,
      turns: [
        { role: 'user', content: `用户问题 ${index + 1}` },
        { role: 'assistant', content: index === 99 ? '专属关键词 命中' : '普通回复' }
      ]
    }));

    renderPanel({ conversations: largeList });

    const input = screen.getByLabelText('搜索对话');
    await user.type(input, '专属关键词');

    // 输入值即时回显
    expect(input).toHaveValue('专属关键词');

    // 结果最终收敛（deferred 更新后）
    await waitFor(() => expect(screen.getByText('命中 1 / 200 条')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '查看 #c100' })).toBeInTheDocument();
  });
});

describe('BUG-35 表格可访问性（补充）', () => {
  it('table 有 aria-label，滚动容器为可聚焦 region', () => {
    renderPanel();

    const table = screen.getByRole('table', { name: '对话筛选结果' });
    expect(table).toBeInTheDocument();

    const region = screen.getByRole('region', { name: '对话筛选结果表格（可横向滚动）' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toContainElement(table);
  });
});
