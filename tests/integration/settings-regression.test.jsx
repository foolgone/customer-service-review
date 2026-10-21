/**
 * BUG-25~28 设置模块 App 级集成回归测试
 *
 * 覆盖：
 * - BUG-25：备份恢复后运行时配置/主题即时刷新（config 合并保留本机 Key、主题 dark 即时生效、
 *   重开设置回填、批量默认并发、单条 AI 请求使用恢复后的模型与本机 Key）。
 * - BUG-26：导出备份不含明文 API Key（config.apiKey 缺失 + note 说明）；导入含 apiKey/未知字段的
 *   备份不覆盖本机 Key、未知字段不落盘、白名单配置正常应用。
 * - BUG-27：导出 → 清空 → 再导入同一备份可恢复标注；空备份不假成功、不回调；非法 JSON 给出明确提示。
 * - BUG-28：恢复提示「本地数据已更新」不被自动保存覆盖；随后用户编辑恢复「已自动保存 · ...」提示。
 * - 额外回归：BUG-29「清除 API Key」不连带提交未保存的模型草稿。
 *
 * 约束：不修改 src/**、helpers、既有 integration 测试与配置，只新增本文件。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { saveAnnotations } from '../../src/lib/storage';
import {
  actionButton,
  getDeepSeekCalls,
  installMatchMedia,
  labelButton,
  readAnnotations,
  readTheme,
  reviewedCard,
  saveStatus,
  setupApp,
  waitForWorkbench
} from './helpers/appHarness';

const CONFIG_KEY = 'cs-review-config-v1';
const SETTINGS_HEADING = { name: '设置' };
const KEY_LABEL = 'DeepSeek API Key';
const MODEL_LABEL = '模型';
const CONCURRENCY_LABEL = '批量分析默认并发';

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

function readConfig() {
  const raw = localStorage.getItem(CONFIG_KEY);
  return raw ? JSON.parse(raw) : null;
}

function makeAnnotation(overrides = {}) {
  return {
    labels: ['risky'],
    score: 4,
    comment: '备份备注',
    aiLabels: [],
    aiReason: '',
    aiAt: '',
    reviewedAt: '',
    updatedAt: '2026-10-21T08:00:00.000Z',
    startedAt: '',
    durationMs: 0,
    ...overrides
  };
}

function settingsDialog() {
  return screen.getByRole('dialog', SETTINGS_HEADING);
}

async function openSettings(user) {
  await user.click(actionButton('设置'));
  await screen.findByRole('heading', SETTINGS_HEADING);
  return settingsDialog();
}

async function closeSettings(user) {
  const dialog = settingsDialog();
  await user.click(within(dialog).getAllByRole('button', { name: '关闭' })[0]);
  await waitFor(() => expect(screen.queryByRole('dialog', SETTINGS_HEADING)).not.toBeInTheDocument());
}

function uploadFile(user, dialog, file) {
  const input = dialog.querySelector('input[type="file"]');
  return user.upload(input, file);
}

async function uploadBackup(user, dialog, data) {
  const file = new File([JSON.stringify(data)], 'backup.json', { type: 'application/json' });
  await uploadFile(user, dialog, file);
  await within(dialog).findByText(/备份已恢复/);
}

/** spy 下载链路：捕获 Blob，返回「取最新 Blob」函数，并避免 jsdom navigation 噪声 */
function spyDownload() {
  let captured = null;
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    captured = blob;
    return 'blob:settings-regression';
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return () => captured;
}

function makeBackup({ annotations, config, theme } = {}) {
  return {
    ...(annotations !== undefined ? { annotations } : {}),
    ...(theme !== undefined ? { theme } : {}),
    ...(config !== undefined ? { config } : {}),
    importHistory: [],
    exportedAt: '2026-10-21T08:00:00.000Z',
    note: 'API Key 不包含在备份中，恢复后需在设置中重新填写'
  };
}

// -------------------- BUG-25 恢复后运行时即时刷新 --------------------

describe('BUG-25 备份恢复后运行时配置与主题即时刷新', () => {
  it('导入备份 → config 合并保留本机 Key、主题即时 dark、面板草稿不被重置；重开设置回填新配置、批量默认并发=2', async () => {
    seedConfig({ apiKey: 'sk-local', aiModel: 'deepseek-chat', concurrency: 3 });
    const { user } = setupApp();
    await waitForWorkbench();
    await openSettings(user);
    const dialog = settingsDialog();

    await uploadBackup(
      user,
      dialog,
      makeBackup({
        annotations: { '001': makeAnnotation() },
        theme: 'dark',
        config: { aiModel: 'deepseek-reasoner', concurrency: 2, temperature: 0.2 }
      })
    );

    // 恢复字段识别（标注 + 主题 + 配置）
    expect(within(dialog).getByText('备份已恢复（标注、主题、配置）')).toBeInTheDocument();
    // config 合并且本机 API Key 保留
    expect(readConfig()).toMatchObject({
      apiKey: 'sk-local',
      aiModel: 'deepseek-reasoner',
      concurrency: 2,
      temperature: 0.2
    });
    // 主题即时生效并落盘
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
    expect(readTheme()).toBe('dark');
    // BUG-30 回归：恢复期间面板草稿与提示不被父级变化重置
    expect(within(dialog).getByLabelText(KEY_LABEL)).toHaveValue('sk-local');
    expect(within(dialog).getByLabelText(MODEL_LABEL)).toHaveValue('deepseek-chat');
    expect(within(dialog).getByText('备份已恢复（标注、主题、配置）')).toBeInTheDocument();

    // 关闭重开：回填恢复后的运行时配置
    await closeSettings(user);
    await openSettings(user);
    const reopened = settingsDialog();
    expect(within(reopened).getByLabelText(KEY_LABEL)).toHaveValue('sk-local');
    expect(within(reopened).getByLabelText(MODEL_LABEL)).toHaveValue('deepseek-reasoner');
    expect(within(reopened).getByLabelText(CONCURRENCY_LABEL)).toHaveValue('2');
    await closeSettings(user);

    // 批量分析默认并发即时使用恢复值 2
    await user.click(actionButton('批量分析'));
    await screen.findByRole('heading', { name: '批量 AI 分析' });
    expect(screen.getByRole('combobox')).toHaveValue('2');
  });

  it('导入备份后关闭设置点「AI 分析」→ DeepSeek 请求 body.model 为恢复后的 reasoner，Authorization 用本机 Key', async () => {
    seedConfig({ apiKey: 'sk-local', aiModel: 'deepseek-chat', concurrency: 3 });
    const { user, fetchMock } = setupApp();
    await waitForWorkbench();
    await openSettings(user);

    await uploadBackup(
      user,
      settingsDialog(),
      makeBackup({
        annotations: { '001': makeAnnotation() },
        config: { aiModel: 'deepseek-reasoner', concurrency: 2 }
      })
    );
    await closeSettings(user);

    await user.click(actionButton('AI 分析'));
    expect(await screen.findByRole('heading', { name: '已得到 AI 建议' })).toBeInTheDocument();

    const deepSeekCalls = getDeepSeekCalls(fetchMock);
    expect(deepSeekCalls).toHaveLength(1);
    const [, options] = deepSeekCalls[0];
    expect(options.headers.Authorization).toBe('Bearer sk-local');
    expect(JSON.parse(options.body).model).toBe('deepseek-reasoner');
  });

  it('残余风险取证（当前行为）：导入备份后不重开设置直接点「保存设置」→ 打开时的旧草稿覆盖刚恢复的配置', async () => {
    seedConfig({ apiKey: 'sk-local', aiModel: 'deepseek-chat', concurrency: 3 });
    const { user } = setupApp();
    await waitForWorkbench();
    await openSettings(user);
    const dialog = settingsDialog();

    await uploadBackup(user, dialog, makeBackup({ config: { aiModel: 'deepseek-reasoner', concurrency: 2 } }));
    expect(readConfig()).toMatchObject({ aiModel: 'deepseek-reasoner', concurrency: 2 });
    // BUG-30 行为：面板草稿保持打开时的旧值（不因父级恢复而重置）
    expect(within(dialog).getByLabelText(MODEL_LABEL)).toHaveValue('deepseek-chat');
    expect(within(dialog).getByLabelText(CONCURRENCY_LABEL)).toHaveValue('3');

    // 用户不重开设置直接保存 → 旧草稿覆盖刚恢复的配置（疑似残余缺陷，按当前行为取证）
    await user.click(within(dialog).getByRole('button', { name: '保存设置' }));
    await waitFor(() => expect(saveStatus()).toHaveTextContent('设置已保存'));
    expect(readConfig()).toMatchObject({ apiKey: 'sk-local', aiModel: 'deepseek-chat', concurrency: 3 });

    // 运行时也随之回退为旧草稿值
    await closeSettings(user);
    await openSettings(user);
    expect(within(settingsDialog()).getByLabelText(MODEL_LABEL)).toHaveValue('deepseek-chat');
    expect(within(settingsDialog()).getByLabelText(CONCURRENCY_LABEL)).toHaveValue('3');
  });
});

// -------------------- BUG-26 备份安全 --------------------

describe('BUG-26 备份安全（不含 Key / 导入不覆盖 Key）', () => {
  it('导出标注备份 → Blob 文本不含明文 Key，config.apiKey 为 undefined，且带 note 说明', async () => {
    seedConfig({ apiKey: 'sk-local-secret', aiModel: 'deepseek-chat', concurrency: 3 });
    saveAnnotations({ '001': makeAnnotation({ labels: ['accurate'], score: 5, comment: '已审核' }) });
    const getBlob = spyDownload();

    const { user } = setupApp();
    await waitForWorkbench();
    await openSettings(user);
    await user.click(within(settingsDialog()).getByRole('button', { name: '导出标注备份' }));
    await within(settingsDialog()).findByText('标注备份已导出');

    const blob = getBlob();
    expect(blob).not.toBeNull();
    const raw = await blob.text();
    // 安全回归：备份文件不得出现明文 Key
    expect(raw).not.toContain('sk-local-secret');

    const backup = JSON.parse(raw);
    expect(backup.config.apiKey).toBeUndefined();
    expect(backup.config).toMatchObject({ aiModel: 'deepseek-chat', concurrency: 3 });
    expect(backup.note).toMatch(/API Key 不包含在备份中/);
    expect(backup.annotations['001'].labels).toEqual(['accurate']);
    expect(backup).toHaveProperty('theme');
    expect(backup).toHaveProperty('exportedAt');
  });

  it('导入含 apiKey 与未知字段的备份 → 本机 Key 不被替换、未知字段不落盘，白名单模型正常应用', async () => {
    seedConfig({ apiKey: 'sk-local-secret', aiModel: 'deepseek-chat', concurrency: 3 });
    const { user, fetchMock } = setupApp();
    await waitForWorkbench();
    await openSettings(user);

    await uploadBackup(
      user,
      settingsDialog(),
      makeBackup({ config: { apiKey: 'sk-injected', aiModel: 'deepseek-reasoner', hacking: 1 } })
    );
    expect(within(settingsDialog()).getByText('备份已恢复（配置）')).toBeInTheDocument();

    const config = readConfig();
    expect(config.apiKey).toBe('sk-local-secret');
    expect(config.aiModel).toBe('deepseek-reasoner');
    expect(config.hacking).toBeUndefined();

    // 运行时同样不使用注入 Key：AI 请求仍用本机 Key，模型用白名单恢复值
    await closeSettings(user);
    await user.click(actionButton('AI 分析'));
    expect(await screen.findByRole('heading', { name: '已得到 AI 建议' })).toBeInTheDocument();
    const [, options] = getDeepSeekCalls(fetchMock)[0];
    expect(options.headers.Authorization).toBe('Bearer sk-local-secret');
    expect(JSON.parse(options.body).model).toBe('deepseek-reasoner');
  });
});

// -------------------- BUG-27 备份 roundtrip 与异常提示 --------------------

describe('BUG-27 备份导出/导入 roundtrip 与异常提示', () => {
  it('先标注 001 → 导出备份 → 清空标注 → 用同一备份导入 → 标注恢复（已标注 1 / 2）', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    await user.click(labelButton('回复准确'));
    await waitFor(() => expect(reviewedCard()).toHaveTextContent('1 / 2'));
    expect(readAnnotations()['001'].labels).toEqual(['accurate']);

    const getBlob = spyDownload();
    await openSettings(user);
    const dialog = settingsDialog();
    await user.click(within(dialog).getByRole('button', { name: '导出标注备份' }));
    await within(dialog).findByText('标注备份已导出');
    const backup = JSON.parse(await getBlob().text());
    expect(backup.annotations['001']).toBeTruthy();

    // 清空本地标注
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(within(dialog).getByRole('button', { name: '清空本地标注' }));
    expect(await within(dialog).findByText('本地标注已清空')).toBeInTheDocument();
    await waitFor(() => expect(reviewedCard()).toHaveTextContent('0 / 2'));
    expect(readAnnotations()).toEqual({});

    // 用同一份备份导入 → 标注恢复
    await uploadBackup(user, dialog, backup);
    await waitFor(() => expect(reviewedCard()).toHaveTextContent('1 / 2'));
    expect(readAnnotations()['001'].labels).toEqual(['accurate']);
  });

  it('空备份 {} → 提示「备份中没有可恢复的数据」，不触发恢复回调、标注不变', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    await openSettings(user);
    const dialog = settingsDialog();

    await uploadFile(user, dialog, new File(['{}'], 'empty.json', { type: 'application/json' }));

    expect(await within(dialog).findByText('备份中没有可恢复的数据')).toBeInTheDocument();
    // 面板保持打开，且未触发 onDataRestored（否则 saveStatus 会变成「本地数据已更新」）
    expect(screen.getByRole('dialog', SETTINGS_HEADING)).toBeInTheDocument();
    expect(saveStatus()).toHaveTextContent('等待编辑');
    expect(saveStatus()).not.toHaveTextContent('本地数据已更新');
    expect(readAnnotations()).toEqual({});
  });

  it('非法 JSON 文件 → 提示「备份文件不是有效的 JSON，恢复失败」，页面不崩溃', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    await openSettings(user);
    const dialog = settingsDialog();

    await uploadFile(user, dialog, new File(['{ 这不是合法的 JSON'], 'broken.json', { type: 'application/json' }));

    expect(await within(dialog).findByText('备份文件不是有效的 JSON，恢复失败')).toBeInTheDocument();
    expect(screen.getByRole('dialog', SETTINGS_HEADING)).toBeInTheDocument();
    expect(saveStatus()).toHaveTextContent('等待编辑');
    expect(readAnnotations()).toEqual({});
  });
});

// -------------------- BUG-28 恢复提示不被覆盖 --------------------

describe('BUG-28 恢复提示保持与自动保存恢复', () => {
  it('导入成功 → 提示「本地数据已更新」保持不被自动保存覆盖；随后点标签 → 恢复「已自动保存 · ...」', async () => {
    seedConfig({ apiKey: 'sk-local', aiModel: 'deepseek-chat', concurrency: 3 });
    const { user } = setupApp();
    await waitForWorkbench();
    await openSettings(user);

    await uploadBackup(user, settingsDialog(), makeBackup({ annotations: { '001': makeAnnotation() } }));

    // BUG-28：恢复提示保持
    await waitFor(() => expect(saveStatus()).toHaveTextContent('本地数据已更新'));
    expect(saveStatus()).not.toHaveTextContent('已自动保存');

    // 用户继续编辑 → aiNoticeRef 已复位，普通自动保存提示恢复
    await closeSettings(user);
    await user.click(labelButton('回复准确'));
    await waitFor(() => expect(saveStatus()).toHaveTextContent(/已自动保存 ·/));
    expect(readAnnotations()['001'].labels).toContain('accurate');
  });
});

// -------------------- 额外回归：BUG-29 --------------------

describe('BUG-29 清除 API Key 不连带提交未保存草稿', () => {
  it('只改模型草稿（未保存）后点「清除 API Key」→ 仅清 Key，模型/并发保持已保存值', async () => {
    seedConfig({ apiKey: 'sk-draft-key', aiModel: 'deepseek-chat', concurrency: 3 });
    const { user } = setupApp();
    await waitForWorkbench();
    await openSettings(user);
    const dialog = settingsDialog();

    // 只修改模型草稿，不点保存
    await user.selectOptions(within(dialog).getByLabelText(MODEL_LABEL), 'deepseek-reasoner');
    expect(within(dialog).getByLabelText(MODEL_LABEL)).toHaveValue('deepseek-reasoner');

    await user.click(within(dialog).getByRole('button', { name: '清除 API Key' }));
    expect(await within(dialog).findByText('已清除 API Key')).toBeInTheDocument();

    // 草稿中的 reasoner 不应被连带保存
    expect(readConfig()).toMatchObject({ apiKey: '', aiModel: 'deepseek-chat', concurrency: 3 });
    expect(within(dialog).getByLabelText(KEY_LABEL)).toHaveValue('');
    expect(within(dialog).getByLabelText(MODEL_LABEL)).toHaveValue('deepseek-chat');

    await closeSettings(user);
    expect(actionButton('AI 分析')).toBeDisabled();
    expect(actionButton('批量分析')).toBeDisabled();
  });
});
