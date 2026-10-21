/**
 * DataPreview 组件单元测试
 * 覆盖：四个统计卡、字段映射显隐与下拉选项/回调、预览表格最多 10 条与空态、
 *       解析提示 details 的展示与展开。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataPreview from '../../../../src/components/import/DataPreview';
import { makeConversation } from '../../../helpers/file';

const BASE_STATS = { total: 14, valid: 9, invalid: 3, dropped: 2 };

function renderPreview(overrides = {}) {
  const props = {
    result: { data: [], errors: [] },
    stats: BASE_STATS,
    mapping: null,
    columns: [],
    needsMapping: false,
    onMappingChange: vi.fn(),
    ...overrides
  };

  return { ...props, ...render(<DataPreview {...props} />) };
}

function expectStat(label, value) {
  const labelElement = screen.getByText(label);
  expect(within(labelElement.parentElement).getByText(String(value))).toBeInTheDocument();
}

describe('DataPreview', () => {
  it('按 stats 渲染总行数 / 有效对话 / 格式错误 / 缺必填字段四项统计', () => {
    renderPreview();

    expectStat('总行数', 14);
    expectStat('有效对话', 9);
    expectStat('格式错误', 3);
    expectStat('缺必填字段', 2);
  });

  it('needsMapping=true → 显示「字段映射」与三个下拉，columns 作为选项，修改时回调 (field, value)', async () => {
    const view = renderPreview({
      needsMapping: true,
      mapping: { id: '对话编号', user: '用户消息列', assistant: '客服回复列' },
      columns: ['对话编号', '用户消息列', '客服回复列', '备注']
    });
    const user = userEvent.setup();

    expect(screen.getByText('字段映射')).toBeInTheDocument();
    expect(screen.getByText('对话 ID')).toBeInTheDocument();
    // 「用户消息」「客服回复」同时也是预览表头，这里限定字段标签 span
    expect(screen.getByText('用户消息', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('客服回复', { selector: 'span' })).toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(3);
    expect(selects[0]).toHaveValue('对话编号');
    expect(selects[1]).toHaveValue('用户消息列');
    expect(selects[2]).toHaveValue('客服回复列');

    const options = within(selects[0])
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual(['请选择列', '对话编号', '用户消息列', '客服回复列', '备注']);

    await user.selectOptions(selects[1], '备注');
    expect(view.onMappingChange).toHaveBeenLastCalledWith('user', '备注');

    await user.selectOptions(screen.getAllByRole('combobox')[2], '');
    expect(view.onMappingChange).toHaveBeenLastCalledWith('assistant', '');
  });

  it('needsMapping=false → 不渲染字段映射区域', () => {
    renderPreview({ needsMapping: false, mapping: null, columns: ['id', 'user', 'assistant'] });

    expect(screen.queryByText('字段映射')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('combobox')).toHaveLength(0);
  });

  it('needsMapping=true 但 mapping 为空 → 三个下拉默认选中「请选择列」', () => {
    renderPreview({ needsMapping: true, mapping: null, columns: ['id', 'user', 'assistant'] });

    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(3);
    selects.forEach((select) => expect(select).toHaveValue(''));
  });

  it('data 为 12 条 → 预览表格只渲染前 10 行，并展示 id / 用户消息 / 客服回复', () => {
    const conversations = Array.from({ length: 12 }, (_, index) =>
      makeConversation(`conv-${String(index + 1).padStart(2, '0')}`, {
        userContent: `用户问题${index + 1}`,
        assistantContent: `客服回复${index + 1}`
      })
    );

    renderPreview({ result: { data: conversations, errors: [] } });

    // 表头 1 行 + 数据 10 行
    expect(screen.getAllByRole('row')).toHaveLength(11);
    expect(screen.getByText('conv-01')).toBeInTheDocument();
    expect(screen.getByText('conv-10')).toBeInTheDocument();
    expect(screen.queryByText('conv-11')).not.toBeInTheDocument();
    expect(screen.queryByText('用户问题11')).not.toBeInTheDocument();

    expect(screen.getByText('用户问题1')).toBeInTheDocument();
    expect(screen.getByText('客服回复1')).toBeInTheDocument();
    expect(screen.getByText('最多显示前 10 条')).toBeInTheDocument();
  });

  it('data 为空 → 渲染「暂无可预览的数据，请检查文件内容或字段映射」空态', () => {
    renderPreview({ result: { data: [], errors: [] } });

    expect(screen.getByText('暂无可预览的数据，请检查文件内容或字段映射')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2); // 表头 + 空态行
  });

  it('result.errors 非空 → 显示「查看 N 条解析提示」，展开后可看到错误文本', async () => {
    const view = renderPreview({
      result: {
        data: [],
        errors: ['第 1 行：缺少用户消息', '第 2 行：缺少客服回复']
      }
    });
    const user = userEvent.setup();

    const summary = screen.getByText('查看 2 条解析提示');
    expect(summary).toBeInTheDocument();

    await user.click(summary);

    expect(screen.getByText(/第 1 行：缺少用户消息/)).toBeInTheDocument();
    expect(screen.getByText(/第 2 行：缺少客服回复/)).toBeInTheDocument();
    expect(view.onMappingChange).not.toHaveBeenCalled();
  });

  it('result.errors 为空 → 不渲染解析提示入口', () => {
    renderPreview({ result: { data: [], errors: [] } });

    expect(screen.queryByText(/查看 \d+ 条解析提示/)).not.toBeInTheDocument();
  });
});
