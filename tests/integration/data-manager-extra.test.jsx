/**
 * 数据管理页 · App 级集成补充测试
 *
 * 覆盖：导出筛选结果 CSV 的真实 Blob 内容（BOM/表头/命中行）、标签/评分/状态筛选端到端、
 *      概览统计与行状态徽标、分页（20 条 / 每页 15）、CSV 导入后数据管理与导入历史、
 *      查看跳转后筛选条件重置、面板打开时快捷键隔离、无结果时导出按钮禁用。
 *
 * 约束：不修改 src/**、helpers、既有 data-manager.test.jsx 与配置，只新增本文件。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  actionButton,
  getDeepSeekCalls,
  installMatchMedia,
  labelButton,
  progressCard,
  readAnnotations,
  readTheme,
  saveStatus,
  scoreButton,
  setupApp,
  waitForWorkbench
} from './helpers/appHarness';

const HEADING = { name: '数据管理' };
const IMPORT_HEADING = { name: '导入对话数据' };
const CONFIG_KEY = 'cs-review-config-v1';
const CSV_HEADER = '"id","user","assistant","labels","score","comment","ai_labels","ai_reason","reviewed_at","duration_ms"';

beforeEach(() => {
  localStorage.clear();
  installMatchMedia();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// -------------------- 本文件专用工装 --------------------

function seedConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ autoSave: true, ...config }));
}

async function openDataManager(user) {
  await user.click(actionButton('数据管理'));
  await screen.findByRole('heading', HEADING, { timeout: 5000 });
  return screen.getByRole('dialog', HEADING);
}

/** 概览指标卡（label 是卡片里的 p；表格状态徽标是 span，按标签名区分） */
function statsCard(dialog, label) {
  const matches = within(dialog).getAllByText(label);
  const labelNode = matches.find((node) => node.tagName === 'P');
  expect(labelNode).toBeTruthy();
  return labelNode.parentElement;
}

function dataRows(dialog) {
  // 第一行是表头，数据行 = 总数 - 1
  return within(dialog).getAllByRole('row').slice(1);
}

function rowOf(dialog, conversationId) {
  return within(dialog).getByRole('button', { name: `查看 #${conversationId}` }).closest('tr');
}

/** spy 下载链路：捕获最新 Blob，并避免 jsdom navigation 噪声 */
function spyBlobDownload() {
  let captured = null;
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    captured = blob;
    return 'blob:filtered-export';
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return () => captured;
}

function makeCsvFile(rows, fileName = 'imported-conversations.csv') {
  const content = ['id,user,assistant', ...rows.map((row) => row.join(','))].join('\n');
  return new File([content], fileName, { type: 'text/csv' });
}

/** 走导入向导导入 CSV 并等待弹窗关闭 */
async function importCsvViaWizard(user, file) {
  await user.click(actionButton('导入数据'));
  const dialog = await screen.findByRole('dialog', IMPORT_HEADING, { timeout: 5000 });
  const input = dialog.querySelector('input[type="file"]');

  await user.upload(input, file);
  await within(dialog).findByText('数据预览', {}, { timeout: 5000 });
  await user.click(within(dialog).getByRole('button', { name: '下一步' }));
  await user.click(await within(dialog).findByRole('button', { name: /确认导入 2 条/ }));

  await waitFor(() => expect(screen.queryByRole('heading', IMPORT_HEADING)).not.toBeInTheDocument(), {
    timeout: 5000
  });
}

function makeTwentyConversations() {
  return Array.from({ length: 20 }, (_, index) => {
    const id = String(index + 1).padStart(3, '0');
    return {
      id,
      turns: [
        { role: 'user', content: `分页测试用户消息 ${id}` },
        { role: 'assistant', content: `分页测试客服回复 ${id}` }
      ]
    };
  });
}

// -------------------- 1. 导出筛选结果 CSV --------------------

describe('导出筛选结果 CSV', () => {
  it('搜索「快递柜」→ 导出 → Blob 含 BOM/完整表头，仅 1 行命中数据，提示「已导出筛选结果 1 条」', async () => {
    const getBlob = spyBlobDownload();
    const { user } = setupApp();
    await waitForWorkbench();
    const dialog = await openDataManager(user);

    // 未筛选时导出全部 2 条
    await user.click(within(dialog).getByRole('button', { name: '导出筛选结果 CSV' }));
    await waitFor(() => expect(saveStatus()).toHaveTextContent('已导出筛选结果 2 条'));
    const allCsv = await getBlob().text();
    expect(allCsv.replace(/^\ufeff/, '').split('\n')).toHaveLength(3);

    // 搜索 002 独有的「快递柜」后导出筛选结果
    await user.type(within(dialog).getByLabelText('搜索对话'), '快递柜');
    expect(within(dialog).getByText('命中 1 / 2 条')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '导出筛选结果 CSV' }));
    await waitFor(() => expect(saveStatus()).toHaveTextContent('已导出筛选结果 1 条'));

    const blob = getBlob();
    expect(blob).not.toBeNull();
    expect(blob.type).toContain('text/csv');

    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);

    const csv = await blob.text();
    const lines = csv.replace(/^\ufeff/, '').split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(CSV_HEADER);
    expect(lines[1]).toContain('"002"');
    expect(lines[1]).toContain('快递柜');
    expect(lines[1]).not.toContain('"001"');
  });
});

// -------------------- 2. 标签 / 评分 / 状态筛选端到端 --------------------

describe('标签 / 评分 / 状态筛选端到端', () => {
  it('标注 001（风险回复 + 1 分）后打开面板：概览 1/2；标签、未审核、评分筛选分别命中 001 / 002 / 001', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    await user.click(labelButton('风险回复'));
    await user.click(scoreButton('1 分'));
    await waitFor(() => expect(readAnnotations()['001'].labels).toEqual(['risky']));

    const dialog = await openDataManager(user);
    expect(statsCard(dialog, '已审核')).toHaveTextContent('1');
    expect(statsCard(dialog, '未审核')).toHaveTextContent('1');

    // 标签筛选：风险回复 → 仅 001
    await user.click(within(dialog).getByRole('button', { name: '风险回复' }));
    expect(within(dialog).getByText('命中 1 / 2 条')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '查看 #001' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: '查看 #002' })).not.toBeInTheDocument();

    // 状态筛选：未审核 → 仅 002
    await user.click(within(dialog).getByRole('button', { name: '清空筛选' }));
    expect(within(dialog).getByText('命中 2 / 2 条')).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText('审核状态'), 'pending');
    expect(within(dialog).getByText('命中 1 / 2 条')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '查看 #002' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: '查看 #001' })).not.toBeInTheDocument();

    // 评分筛选：1 分 → 仅 001
    await user.click(within(dialog).getByRole('button', { name: '清空筛选' }));
    await user.click(within(dialog).getByRole('button', { name: '1 分' }));
    expect(within(dialog).getByText('命中 1 / 2 条')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '查看 #001' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: '查看 #002' })).not.toBeInTheDocument();
  });
});

// -------------------- 3. 概览统计与行状态徽标 --------------------

describe('概览统计与行状态徽标', () => {
  it('先标注 + AI 分析再打开面板：概览已审核/未审核/有 AI/问题对话同步，行徽标显示已审核 + AI；「有 AI 建议」状态可筛出 001', async () => {
    seedConfig({ apiKey: 'sk-ai', aiModel: 'deepseek-chat', concurrency: 3 });
    const { user } = setupApp();
    await waitForWorkbench();

    await user.click(actionButton('AI 分析'));
    await screen.findByRole('heading', { name: '已得到 AI 建议' });
    await user.click(labelButton('风险回复'));
    await waitFor(() => expect(readAnnotations()['001'].aiLabels).toEqual(['accurate']));

    const dialog = await openDataManager(user);
    expect(statsCard(dialog, '总对话')).toHaveTextContent('2');
    expect(statsCard(dialog, '已审核')).toHaveTextContent('1');
    expect(statsCard(dialog, '未审核')).toHaveTextContent('1');
    expect(statsCard(dialog, '有 AI 建议')).toHaveTextContent('1');
    expect(statsCard(dialog, '问题对话')).toHaveTextContent('1');

    const row001 = rowOf(dialog, '001');
    expect(within(row001).getByText('已审核')).toBeInTheDocument();
    expect(within(row001).getByText('AI')).toBeInTheDocument();
    expect(within(row001).getByText('风险回复')).toBeInTheDocument();

    const row002 = rowOf(dialog, '002');
    expect(within(row002).getByText('未审核')).toBeInTheDocument();
    expect(within(row002).queryByText('AI')).not.toBeInTheDocument();

    // 状态筛选「有 AI 建议」→ 仅 001
    await user.selectOptions(within(dialog).getByLabelText('审核状态'), 'ai');
    expect(within(dialog).getByText('命中 1 / 2 条')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '查看 #001' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: '查看 #002' })).not.toBeInTheDocument();
  });
});

// -------------------- 4. 分页 --------------------

describe('分页', () => {
  it('自定义 fetch 返回 20 条 → 首页 15 行 / 第 1 / 2 页 → 下一页 5 行 / 第 2 / 2 页；筛选后回到第 1 页', async () => {
    const { user } = setupApp({ conversations: makeTwentyConversations() });
    await waitForWorkbench();
    const dialog = await openDataManager(user);

    expect(statsCard(dialog, '总对话')).toHaveTextContent('20');
    expect(dataRows(dialog)).toHaveLength(15);
    expect(within(dialog).getByText('第 1 / 2 页')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '查看 #001' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '查看 #015' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: '查看 #016' })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '下一页' }));

    expect(within(dialog).getByText('第 2 / 2 页')).toBeInTheDocument();
    expect(dataRows(dialog)).toHaveLength(5);
    expect(within(dialog).getByRole('button', { name: '查看 #016' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '查看 #020' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: '查看 #001' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '下一页' })).toBeDisabled();

    // 输入筛选条件会把页码重置回第 1 页
    await user.type(within(dialog).getByLabelText('搜索对话'), '分页测试');
    expect(within(dialog).getByText('第 1 / 2 页')).toBeInTheDocument();
    expect(within(dialog).getByText('命中 20 / 20 条')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '查看 #001' })).toBeInTheDocument();
  });
});

// -------------------- 5. CSV 导入后的数据管理与导入历史 --------------------

describe('CSV 导入后的数据管理与导入历史', () => {
  it('通过导入向导导入 2 条 CSV → 数据管理总对话 2、导入历史显示该文件（CSV · 有效 2/2）', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    await importCsvViaWizard(
      user,
      makeCsvFile([
        ['9001', '导入后的用户问题一', '导入后的客服回复一'],
        ['9002', '导入后的用户问题二', '导入后的客服回复二']
      ])
    );

    expect(saveStatus()).toHaveTextContent('已导入 2 条对话');

    const dialog = await openDataManager(user);
    expect(statsCard(dialog, '总对话')).toHaveTextContent('2');
    expect(within(dialog).getByText('导入历史')).toBeInTheDocument();
    expect(within(dialog).getByText('imported-conversations.csv')).toBeInTheDocument();
    expect(within(dialog).getByText(/CSV · 有效 2\/2/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '查看 #9002' })).toBeInTheDocument();
  });
});

// -------------------- 6. 查看跳转与筛选重置 --------------------

describe('查看跳转与筛选重置', () => {
  it('搜索后点击「查看 #002」→ 面板关闭并跳到 2/2；再次打开 → 搜索与筛选条件已重置', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    let dialog = await openDataManager(user);

    await user.type(within(dialog).getByLabelText('搜索对话'), '快递柜');
    expect(within(dialog).getByText('命中 1 / 2 条')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '查看 #002' }));

    await waitFor(() => expect(screen.queryByRole('heading', HEADING)).not.toBeInTheDocument());
    expect(progressCard()).toHaveTextContent(/2 \/ 2/);

    // 条件挂在组件本地 state，重新打开即恢复默认
    dialog = await openDataManager(user);
    expect(within(dialog).getByLabelText('搜索对话')).toHaveValue('');
    expect(within(dialog).getByText('命中 2 / 2 条')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: '清空筛选' })).not.toBeInTheDocument();
  });
});

// -------------------- 7. 快捷键隔离 --------------------

describe('快捷键隔离', () => {
  it('面板打开时 1/6、Alt+1、Enter、A、D 均不生效且面板不关；Esc 关闭后 Enter 恢复生效（2/2）', async () => {
    seedConfig({ apiKey: 'sk-iso', aiModel: 'deepseek-chat', concurrency: 3 });
    const { user, fetchMock } = setupApp();
    await waitForWorkbench();
    await openDataManager(user);

    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: '6' });
    fireEvent.keyDown(window, { key: '1', altKey: true });
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'd' });

    expect(readAnnotations()['001']).toBeUndefined();
    expect(getDeepSeekCalls(fetchMock)).toHaveLength(0);
    expect(progressCard()).toHaveTextContent(/1 \/ 2/);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(readTheme()).not.toBe('dark');
    expect(screen.getByRole('dialog', HEADING)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('heading', HEADING)).not.toBeInTheDocument());
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(progressCard()).toHaveTextContent(/2 \/ 2/));
  });
});

// -------------------- 8. 无结果时导出禁用 --------------------

describe('无结果时导出禁用', () => {
  it('搜索无命中 → 表格空态、导出筛选结果按钮 disabled；清空筛选后恢复可用与命中 2 条', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    const dialog = await openDataManager(user);

    await user.type(within(dialog).getByLabelText('搜索对话'), '不存在的关键词XYZ');

    expect(within(dialog).getByText('命中 0 / 2 条')).toBeInTheDocument();
    expect(within(dialog).getByText('没有匹配的对话，试试调整筛选条件')).toBeInTheDocument();
    expect(within(dialog).getByText(/导出内容为当前筛选结果（0 条）/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '导出筛选结果 CSV' })).toBeDisabled();

    await user.click(within(dialog).getByRole('button', { name: '清空筛选' }));
    expect(within(dialog).getByText('命中 2 / 2 条')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '导出筛选结果 CSV' })).toBeEnabled();
  });
});
