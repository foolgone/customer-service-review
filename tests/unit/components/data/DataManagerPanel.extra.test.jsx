/**
 * DataManagerPanel 补充组件测试
 * 与开发自带的 DataManagerPanel.test.jsx（14 条）互补，补齐未覆盖的漏洞面：
 * - dialog 语义与五项概览统计数值（总对话 / 已审核 / 未审核 / 有 AI 建议 / 问题对话）；
 * - 关键词搜索「快递柜」命中、清空筛选按钮出现 / 消失；
 * - 标签多选（OR）与评分多选组合、再次点击取消选中的双向行为；
 * - 审核状态三态切换（已审核 / 未审核 / 有 AI 建议）；
 * - 无结果空态、36 条数据分页（15/页、页码、上一页禁用、筛选后回第 1 页）；
 * - 查看跳转 onJump（含缺省回调容错）；
 * - 导出筛选结果（回调参数、无结果禁用、缺省回调容错）；
 * - 导入历史（空态、最多 5 条、文件名/格式/有效数/时间、非法时间显示 '-'）；
 * - 状态徽标（已审核 / 未审核 / AI）与行文本兜底（缺失消息、缺失评分、0 分）。
 *
 * 说明：使用真实 filters / labels / storage 实现，不 mock 业务逻辑；不修改源码与既有测试。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataManagerPanel from '../../../../src/components/data/DataManagerPanel.jsx';
import { addImportHistory, getImportHistory } from '../../../../src/lib/storage.js';

const IMPORT_HISTORY_KEY = 'cs-review-import-history-v1';

function makeConversation(id, { user = `用户消息 ${id}`, assistant = `客服回复 ${id}`, withTurns = true } = {}) {
  return {
    id,
    turns: withTurns
      ? [
          { role: 'user', content: user },
          { role: 'assistant', content: assistant }
        ]
      : undefined
  };
}

/**
 * 概览数据集（6 条）：
 * - c1：labels=['risky'] + reviewedAt，评分 2 → 已审核 / 问题对话
 * - c2：labels=['incomplete']（无 reviewedAt），评分 3 → 已审核 / 问题对话
 * - c3：labels=['accurate'] + reviewedAt，评分 5 → 已审核 / 非问题
 * - c4：仅 aiLabels=['off_topic']，评分 4 → 未审核 / 有 AI 建议
 * - c5：无标注、无 turns → 未审核
 * - c6：labels=['off_topic'] + reviewedAt，评分 0 → 已审核 / 问题对话
 * 期望概览：总 6 / 已审核 4 / 未审核 2 / 有 AI 建议 1 / 问题对话 3。
 */
function buildOverviewDataset() {
  return {
    conversations: [
      makeConversation('c1', { user: '快递柜取件码没收到怎么查', assistant: '请在驿站 App 查看取件码' }),
      makeConversation('c2', { user: '优惠券怎么用', assistant: '满 200 可用' }),
      makeConversation('c3', { user: '发票怎么开', assistant: '在订单详情申请' }),
      makeConversation('c4', { user: '物流太慢', assistant: '马上催' }),
      makeConversation('c5', { withTurns: false }),
      makeConversation('c6', { user: '客服态度不好', assistant: '抱歉给您带来不便' })
    ],
    annotations: {
      c1: { labels: ['risky'], score: 2, reviewedAt: '2026-10-20T02:00:00.000Z' },
      c2: { labels: ['incomplete'], score: 3 },
      c3: { labels: ['accurate'], score: 5, reviewedAt: '2026-10-19T02:00:00.000Z' },
      c4: { aiLabels: ['off_topic'], aiReason: '回答跑题', score: 4 },
      c5: {},
      c6: { labels: ['off_topic'], score: 0, reviewedAt: '2026-10-21T02:00:00.000Z' }
    }
  };
}

function renderPanel(overrides = {}) {
  const props = {
    open: true,
    ...buildOverviewDataset(),
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

/** 取概览卡片数值（卡片结构：<p>数值</p><p>标签</p>；徽标是 span，不会误命中） */
function getStatValue(label) {
  const labelNode = screen.getAllByText(label).find((node) => node.tagName === 'P');
  return labelNode.previousElementSibling.textContent;
}

function getRowButtonIds() {
  return within(getDialog())
    .queryAllByRole('button', { name: /^查看 #/ })
    .map((button) => button.textContent.replace('查看 #', ''));
}

function getRow(id) {
  return within(getDialog()).getByRole('button', { name: `查看 #${id}` }).closest('tr');
}

function getRowCells(id) {
  return Array.from(getRow(id).querySelectorAll('td')).map((cell) => cell.textContent.trim());
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DataManagerPanel 补充 · 渲染与概览', () => {
  it('open=false → 不渲染 dialog 与标题', () => {
    const { container } = renderPanel({ open: false });

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('数据管理')).not.toBeInTheDocument();
  });

  it('open=true → dialog 语义/标题/表头齐全，五项概览数值正确', () => {
    renderPanel();
    const dialog = getDialog();

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'data-manager-title');
    expect(document.getElementById('data-manager-title')).toHaveTextContent('数据管理');
    expect(within(dialog).getByRole('heading', { name: '数据管理' })).toBeInTheDocument();

    ['ID', '用户消息', '标签', '评分', '状态', '操作'].forEach((name) => {
      expect(within(dialog).getByRole('columnheader', { name })).toBeInTheDocument();
    });

    expect(getStatValue('总对话')).toBe('6');
    expect(getStatValue('已审核')).toBe('4');
    expect(getStatValue('未审核')).toBe('2');
    expect(getStatValue('有 AI 建议')).toBe('1');
    expect(getStatValue('问题对话')).toBe('3');
    expect(screen.getByText('命中 6 / 6 条')).toBeInTheDocument();
  });

  it('空数据集 → 概览全 0、空态提示、导出禁用、分页固定第 1 / 1 页', () => {
    renderPanel({ conversations: [], annotations: {} });

    expect(getStatValue('总对话')).toBe('0');
    expect(getStatValue('已审核')).toBe('0');
    expect(getStatValue('未审核')).toBe('0');
    expect(getStatValue('有 AI 建议')).toBe('0');
    expect(getStatValue('问题对话')).toBe('0');
    expect(screen.getByText('没有匹配的对话，试试调整筛选条件')).toBeInTheDocument();
    expect(screen.getByText('命中 0 / 0 条')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出筛选结果 CSV' })).toBeDisabled();
    expect(screen.getByText('第 1 / 1 页')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();
  });
});

describe('DataManagerPanel 补充 · 关键词搜索与清空筛选', () => {
  it('输入「快递柜」→ 命中 1 / 6 条；清空筛选按钮出现，点击后恢复全部且按钮消失', async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(screen.queryByRole('button', { name: '清空筛选' })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('搜索对话'), '快递柜');

    expect(screen.getByText('命中 1 / 6 条')).toBeInTheDocument();
    expect(getRowButtonIds()).toEqual(['c1']);
    expect(screen.getByRole('button', { name: '清空筛选' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '清空筛选' }));

    expect(screen.getByText('命中 6 / 6 条')).toBeInTheDocument();
    expect(getRowButtonIds()).toHaveLength(6);
    expect(screen.queryByRole('button', { name: '清空筛选' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('搜索对话')).toHaveValue('');
  });

  it('搜索无结果 → 空态提示、命中 0 条、导出按钮禁用', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText('搜索对话'), '不存在的关键词');

    expect(screen.getByText('没有匹配的对话，试试调整筛选条件')).toBeInTheDocument();
    expect(screen.getByText('命中 0 / 6 条')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出筛选结果 CSV' })).toBeDisabled();
    expect(getRowButtonIds()).toHaveLength(0);
  });
});

describe('DataManagerPanel 补充 · 标签与评分多选组合', () => {
  const comboCases = {
    conversations: [
      makeConversation('k1'),
      makeConversation('k2'),
      makeConversation('k3'),
      makeConversation('k4')
    ],
    annotations: {
      k1: { labels: ['risky'], score: 2, reviewedAt: '2026-10-20T02:00:00.000Z' },
      k2: { labels: ['incomplete'], score: 3 },
      k3: { labels: ['risky'], score: 5 },
      k4: { labels: ['accurate'], score: 2 }
    }
  };

  it('标签多选（风险回复 + 未解决问题，OR）与评分多选（2 分 + 3 分）组合 → 命中数正确且 aria-pressed', async () => {
    const user = userEvent.setup();
    renderPanel(comboCases);

    const risky = screen.getByRole('button', { name: '风险回复' });
    const incomplete = screen.getByRole('button', { name: '未解决问题' });
    await user.click(risky);
    await user.click(incomplete);

    expect(risky).toHaveAttribute('aria-pressed', 'true');
    expect(incomplete).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('命中 3 / 4 条')).toBeInTheDocument();
    expect(getRowButtonIds()).toEqual(['k1', 'k2', 'k3']);

    const score2 = screen.getByRole('button', { name: '2 分' });
    const score3 = screen.getByRole('button', { name: '3 分' });
    await user.click(score2);
    await user.click(score3);

    expect(score2).toHaveAttribute('aria-pressed', 'true');
    expect(score3).toHaveAttribute('aria-pressed', 'true');
    // 标签 OR + 评分 OR 取交集：k1(risky,2)、k2(incomplete,3)；k3(risky,5) 被评分排除
    expect(screen.getByText('命中 2 / 4 条')).toBeInTheDocument();
    expect(getRowButtonIds()).toEqual(['k1', 'k2']);
  });

  it('再次点击已选标签/评分 → 取消选中（双向切换），清空筛选后恢复全部', async () => {
    const user = userEvent.setup();
    renderPanel(comboCases);

    await user.click(screen.getByRole('button', { name: '风险回复' }));
    await user.click(screen.getByRole('button', { name: '未解决问题' }));
    await user.click(screen.getByRole('button', { name: '2 分' }));
    await user.click(screen.getByRole('button', { name: '3 分' }));

    // 取消「风险回复」→ 只剩 incomplete 标签 + 2/3 分 → k2
    await user.click(screen.getByRole('button', { name: '风险回复' }));
    expect(screen.getByRole('button', { name: '风险回复' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('命中 1 / 4 条')).toBeInTheDocument();
    expect(getRowButtonIds()).toEqual(['k2']);

    // 再取消「3 分」→ k2(3 分) 被排除，命中 0
    await user.click(screen.getByRole('button', { name: '3 分' }));
    expect(screen.getByRole('button', { name: '3 分' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('命中 0 / 4 条')).toBeInTheDocument();
    expect(screen.getByText('没有匹配的对话，试试调整筛选条件')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '清空筛选' }));
    expect(screen.getByText('命中 4 / 4 条')).toBeInTheDocument();
  });
});

describe('DataManagerPanel 补充 · 审核状态三态筛选', () => {
  it('已审核 / 未审核 / 有 AI 建议 / 全部 切换 → 命中数与行集合同步', async () => {
    const user = userEvent.setup();
    renderPanel();
    const status = screen.getByLabelText('审核状态');

    await user.selectOptions(status, 'reviewed');
    expect(screen.getByText('命中 4 / 6 条')).toBeInTheDocument();
    expect(getRowButtonIds()).toEqual(['c1', 'c2', 'c3', 'c6']);

    await user.selectOptions(status, 'pending');
    expect(screen.getByText('命中 2 / 6 条')).toBeInTheDocument();
    expect(getRowButtonIds()).toEqual(['c4', 'c5']);

    await user.selectOptions(status, 'ai');
    expect(screen.getByText('命中 1 / 6 条')).toBeInTheDocument();
    expect(getRowButtonIds()).toEqual(['c4']);

    await user.selectOptions(status, 'all');
    expect(screen.getByText('命中 6 / 6 条')).toBeInTheDocument();
    expect(getRowButtonIds()).toHaveLength(6);
  });
});

describe('DataManagerPanel 补充 · 分页', () => {
  function buildLargeDataset(count = 32) {
    return {
      conversations: Array.from({ length: count }, (_, index) => makeConversation(`p${index + 1}`)),
      annotations: {}
    };
  }

  it('32 条 → 首页 15 行、第 1 / 3 页、上一页禁用；下一页/上一页页码与行数正确', async () => {
    const user = userEvent.setup();
    renderPanel(buildLargeDataset());

    expect(screen.getByText('第 1 / 3 页')).toBeInTheDocument();
    expect(getRowButtonIds()).toHaveLength(15);
    expect(getRowButtonIds()[0]).toBe('p1');
    expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下一页' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '下一页' }));
    expect(screen.getByText('第 2 / 3 页')).toBeInTheDocument();
    expect(getRowButtonIds()).toHaveLength(15);
    expect(getRowButtonIds()[0]).toBe('p16');
    expect(screen.getByRole('button', { name: '上一页' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '下一页' }));
    expect(screen.getByText('第 3 / 3 页')).toBeInTheDocument();
    expect(getRowButtonIds()).toEqual(['p31', 'p32']);
    expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '上一页' }));
    expect(screen.getByText('第 2 / 3 页')).toBeInTheDocument();
  });

  it('停在第 2 页时输入搜索 → 页码重置为第 1 页并只显示命中行', async () => {
    const user = userEvent.setup();
    renderPanel(buildLargeDataset());

    await user.click(screen.getByRole('button', { name: '下一页' }));
    expect(screen.getByText('第 2 / 3 页')).toBeInTheDocument();

    await user.type(screen.getByLabelText('搜索对话'), 'p5');

    expect(screen.getByText('第 1 / 1 页')).toBeInTheDocument();
    expect(getRowButtonIds()).toEqual(['p5']);
    expect(screen.getByText('命中 1 / 32 条')).toBeInTheDocument();
  });
});

describe('DataManagerPanel 补充 · 查看跳转', () => {
  it('点击「查看 #id」→ onJump 收到对应对话 id', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.click(screen.getByRole('button', { name: '查看 #c1' }));

    expect(props.onJump).toHaveBeenCalledTimes(1);
    expect(props.onJump).toHaveBeenCalledWith('c1');
  });

  it('onJump 缺省 → 点击「查看」不抛错', async () => {
    const user = userEvent.setup();
    renderPanel({ onJump: undefined });

    await expect(user.click(screen.getByRole('button', { name: '查看 #c2' }))).resolves.toBeUndefined();
  });
});

describe('DataManagerPanel 补充 · 导出筛选结果', () => {
  it('有筛选结果时点击 → onExportFiltered 收到当前筛选结果数组（长度与内容正确）', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.type(screen.getByLabelText('搜索对话'), '快递柜');
    await user.click(screen.getByRole('button', { name: '导出筛选结果 CSV' }));

    expect(props.onExportFiltered).toHaveBeenCalledTimes(1);
    const exported = props.onExportFiltered.mock.calls[0][0];
    expect(Array.isArray(exported)).toBe(true);
    expect(exported).toHaveLength(1);
    expect(exported[0].id).toBe('c1');
  });

  it('无结果时导出按钮禁用且不触发回调；onExportFiltered 缺省时点击不抛错', async () => {
    const user = userEvent.setup();
    const { props, unmount } = renderPanel();

    await user.type(screen.getByLabelText('搜索对话'), '不存在的关键词');
    await user.click(screen.getByRole('button', { name: '导出筛选结果 CSV' }));
    expect(props.onExportFiltered).not.toHaveBeenCalled();

    unmount();
    renderPanel({ onExportFiltered: undefined });
    await expect(user.click(screen.getByRole('button', { name: '导出筛选结果 CSV' }))).resolves.toBeUndefined();
  });
});

describe('DataManagerPanel 补充 · 导入历史', () => {
  it('无导入历史 → 显示「暂无导入记录」与「最近 0 条」', () => {
    renderPanel();

    expect(screen.getByText('暂无导入记录')).toBeInTheDocument();
    expect(screen.getByText('最近 0 条')).toBeInTheDocument();
  });

  it('写入 6 条历史 → 只渲染最近 5 条（文件名/格式/有效数/时间）', () => {
    for (let index = 1; index <= 6; index += 1) {
      addImportHistory({ fileName: `f${index}.csv`, format: 'CSV', total: 10 + index, valid: 8 + index });
    }
    const newest = getImportHistory()[0];

    renderPanel();

    expect(screen.getByText('最近 5 条')).toBeInTheDocument();
    expect(within(getDialog()).getAllByRole('listitem')).toHaveLength(5);

    ['f6.csv', 'f5.csv', 'f4.csv', 'f3.csv', 'f2.csv'].forEach((fileName) => {
      expect(screen.getByText(fileName)).toBeInTheDocument();
    });
    expect(screen.queryByText('f1.csv')).not.toBeInTheDocument();

    const expectedTime = new Date(newest.importedAt).toLocaleString('zh-CN', { hour12: false });
    expect(screen.getByText(`CSV · 有效 14/16 · ${expectedTime}`)).toBeInTheDocument();
  });

  it('importedAt 非法或缺失 → 时间列显示 "-"', () => {
    localStorage.setItem(
      IMPORT_HISTORY_KEY,
      JSON.stringify([
        { fileName: 'bad-time.csv', format: 'CSV', total: 5, valid: 5, importedAt: 'not-a-date' },
        { fileName: 'no-time.csv', format: 'JSON', total: 2, valid: 2 }
      ])
    );

    renderPanel();

    expect(screen.getByText('bad-time.csv')).toBeInTheDocument();
    expect(screen.getByText('CSV · 有效 5/5 · -')).toBeInTheDocument();
    expect(screen.getByText('JSON · 有效 2/2 · -')).toBeInTheDocument();
  });
});

describe('DataManagerPanel 补充 · 状态徽标与行文本兜底', () => {
  it('有 labels 的记录 → 「已审核」徽标，标签与评分正常展示', () => {
    renderPanel();

    const c1Cells = getRowCells('c1');
    expect(within(getRow('c1')).getByText('已审核')).toBeInTheDocument();
    expect(within(getRow('c1')).queryByText('AI')).not.toBeInTheDocument();
    expect(c1Cells[2]).toBe('风险回复');
    expect(c1Cells[3]).toBe('2 分');

    const c3Cells = getRowCells('c3');
    expect(within(getRow('c3')).getByText('已审核')).toBeInTheDocument();
    expect(c3Cells[2]).toBe('回复准确');
    expect(c3Cells[3]).toBe('5 分');
  });

  it('纯 AI 建议记录 → 「未审核」+「AI」徽标，标签列不展示 AI 建议', () => {
    renderPanel();

    const row = getRow('c4');
    expect(within(row).getByText('未审核')).toBeInTheDocument();
    expect(within(row).getByText('AI')).toBeInTheDocument();
    const cells = getRowCells('c4');
    expect(cells[2]).toBe('-');
    expect(cells[3]).toBe('4 分');
  });

  it('用户消息缺失/评分 0/无标注 → 对应单元格显示 "-"', () => {
    renderPanel();

    const c5Cells = getRowCells('c5');
    expect(c5Cells[1]).toBe('-');
    expect(c5Cells[2]).toBe('-');
    expect(c5Cells[3]).toBe('-');
    expect(within(getRow('c5')).getByText('未审核')).toBeInTheDocument();
    expect(within(getRow('c5')).queryByText('AI')).not.toBeInTheDocument();

    // c6：评分 0 → '-'，但 labels 非空 → 已审核
    expect(getRowCells('c6')[3]).toBe('-');
    expect(within(getRow('c6')).getByText('已审核')).toBeInTheDocument();
  });
});
