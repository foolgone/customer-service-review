/**
 * 设置模块 · App 级集成补充测试与安全取证
 *
 * 覆盖：保存模型/并发后运行时生效、清除 API Key、备份导入后的数据刷新与配置不同步取证、
 *      备份导出明文 Key 安全取证、设置面板快捷键隔离与恢复、懒加载 dialog 与关闭路径。
 *
 * 约束：不修改开发已有的 tests/integration/settings.test.jsx，只新增本文件。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { saveAnnotations } from '../../src/lib/storage';
import {
  actionButton,
  currentLabelBox,
  getDeepSeekCalls,
  installMatchMedia,
  labelButton,
  progressCard,
  readAnnotations,
  readTheme,
  reviewedCard,
  saveStatus,
  scoreStatus,
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

/** 在设置页修改字段并点击「保存设置」 */
async function saveSettingsViaUI(user, { apiKey, model, concurrency } = {}) {
  const dialog = settingsDialog();

  if (apiKey !== undefined) {
    const keyInput = within(dialog).getByLabelText(KEY_LABEL);
    await user.clear(keyInput);
    if (apiKey) {
      await user.type(keyInput, apiKey);
    }
  }

  if (model !== undefined) {
    await user.selectOptions(within(dialog).getByLabelText(MODEL_LABEL), model);
  }

  if (concurrency !== undefined) {
    await user.selectOptions(within(dialog).getByLabelText(CONCURRENCY_LABEL), String(concurrency));
  }

  await user.click(within(dialog).getByRole('button', { name: '保存设置' }));
  await waitFor(() => expect(saveStatus()).toHaveTextContent('设置已保存'));
}

/** 通过设置页隐藏 file input 上传备份 JSON，并等待恢复成功提示 */
async function uploadBackup(user, dialog, data) {
  const input = dialog.querySelector('input[type="file"]');
  const file = new File([JSON.stringify(data)], 'backup.json', { type: 'application/json' });
  await user.upload(input, file);
  await within(dialog).findByText('备份已恢复');
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

function makeBackup({ annotations = {}, config = {}, theme = 'light' } = {}) {
  return {
    annotations,
    theme,
    config: { apiKey: '', aiModel: 'deepseek-chat', concurrency: 3, autoSave: true, ...config },
    importHistory: [],
    exportedAt: '2026-10-21T08:00:00.000Z'
  };
}

// -------------------- A. 设置保存与运行时生效 --------------------

describe('A. 设置保存与运行时生效', () => {
  it('保存 deepseek-reasoner + API Key → 单条「AI 分析」请求 body.model 与 Authorization 使用设置值', async () => {
    const { user, fetchMock } = setupApp();
    await waitForWorkbench();
    await openSettings(user);

    await saveSettingsViaUI(user, { apiKey: 'sk-e2e-reasoner', model: 'deepseek-reasoner', concurrency: 4 });

    expect(readConfig()).toMatchObject({
      apiKey: 'sk-e2e-reasoner',
      aiModel: 'deepseek-reasoner',
      concurrency: 4
    });

    await closeSettings(user);
    expect(actionButton('AI 分析')).toBeEnabled();
    await user.click(actionButton('AI 分析'));
    expect(await screen.findByRole('heading', { name: '已得到 AI 建议' })).toBeInTheDocument();

    const calls = getDeepSeekCalls(fetchMock);
    expect(calls).toHaveLength(1);
    const [endpoint, options] = calls[0];
    expect(String(endpoint)).toContain('api.deepseek.com');
    expect(options.headers.Authorization).toBe('Bearer sk-e2e-reasoner');
    const body = JSON.parse(options.body);
    expect(body.model).toBe('deepseek-reasoner');
    expect(body.temperature).toBe(0);
  });

  it('设置页「清除 API Key」→ 配置 apiKey 清空、模型/并发保留，关闭后 AI 与批量分析按钮禁用', async () => {
    seedConfig({ apiKey: 'sk-clear-me', aiModel: 'deepseek-reasoner', concurrency: 4 });
    const { user } = setupApp();
    await waitForWorkbench();
    expect(actionButton('AI 分析')).toBeEnabled();

    await openSettings(user);
    const dialog = settingsDialog();
    expect(within(dialog).getByLabelText(KEY_LABEL)).toHaveValue('sk-clear-me');

    await user.click(within(dialog).getByRole('button', { name: '清除 API Key' }));

    expect(await within(dialog).findByText('已清除 API Key')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(KEY_LABEL)).toHaveValue('');
    expect(within(dialog).getByText('API Key 未配置')).toBeInTheDocument();
    expect(readConfig()).toMatchObject({ apiKey: '', aiModel: 'deepseek-reasoner', concurrency: 4 });

    await closeSettings(user);
    expect(actionButton('AI 分析')).toBeDisabled();
    expect(actionButton('批量分析')).toBeDisabled();
  });

  it('设置默认并发 2 保存 → 打开批量分析面板 combobox 默认值为 2', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    await openSettings(user);
    await saveSettingsViaUI(user, { apiKey: 'sk-batch', concurrency: 2 });
    await closeSettings(user);

    await user.click(actionButton('批量分析'));
    await screen.findByRole('heading', { name: '批量 AI 分析' });

    expect(screen.getByRole('combobox')).toHaveValue('2');
    expect(readConfig().concurrency).toBe(2);
  });

  it('保存设置后重开设置页 → 回填刚保存的 Key/模型/并发（运行时 state 已同步）', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    await openSettings(user);
    await saveSettingsViaUI(user, { apiKey: 'sk-runtime-sync', model: 'deepseek-reasoner', concurrency: 2 });
    await closeSettings(user);
    await openSettings(user);

    const dialog = settingsDialog();
    expect(within(dialog).getByLabelText(KEY_LABEL)).toHaveValue('sk-runtime-sync');
    expect(within(dialog).getByLabelText(MODEL_LABEL)).toHaveValue('deepseek-reasoner');
    expect(within(dialog).getByLabelText(CONCURRENCY_LABEL)).toHaveValue('2');
    expect(actionButton('AI 分析')).toBeEnabled();
  });
});

// -------------------- B. 备份导入 --------------------

describe('B. 备份导入', () => {
  it('导入备份 → 标注/已标注计数/Dashboard/当前草稿刷新，009 保留；但备份中的 API Key 未刷新运行时（按钮仍禁用）', async () => {
    // 先有一条「当前数据集之外」的标注，验证备份合并后不会被误删
    saveAnnotations({
      '009': makeAnnotation({ labels: ['accurate'], score: 5, comment: '未知对话', reviewedAt: '2026-10-20T08:00:00.000Z' })
    });

    const { user } = setupApp();
    await waitForWorkbench();
    expect(reviewedCard()).toHaveTextContent('0 / 2');

    await openSettings(user);
    const dialog = settingsDialog();
    await uploadBackup(
      user,
      dialog,
      makeBackup({
        annotations: {
          '001': makeAnnotation(),
          '009': makeAnnotation({ labels: ['accurate'], score: 5, comment: '未知对话' })
        },
        config: { apiKey: 'sk-backup', aiModel: 'deepseek-reasoner', concurrency: 2 }
      })
    );

    // 数据刷新：已标注计数 / 当前草稿 / Dashboard / 存储
    await waitFor(() => expect(reviewedCard()).toHaveTextContent('1 / 2'));
    expect(within(currentLabelBox()).getByText('风险回复')).toBeInTheDocument();
    expect(scoreStatus()).toHaveTextContent('4 分');
    await waitFor(() => {
      expect(within(screen.getByText('已审核数量').parentElement).getByText('1')).toBeInTheDocument();
    });
    expect(readAnnotations()['009']).toBeTruthy();
    // 恢复成功提示可能被紧随其后的自动保存提示覆盖（BUG-15 同类时序），两种文案都接受
    expect(saveStatus()).toHaveTextContent(/已自动保存|本地数据已更新/);

    // config 已写入 localStorage
    expect(readConfig()).toMatchObject({ apiKey: 'sk-backup', aiModel: 'deepseek-reasoner', concurrency: 2 });

    // 重点取证：面板输入框仍是打开时的运行时旧值（空 Key），导入的 config 未同步到 App 状态
    expect(within(dialog).getByLabelText(KEY_LABEL)).toHaveValue('');
    await closeSettings(user);
    expect(actionButton('AI 分析')).toBeDisabled();
    expect(actionButton('批量分析')).toBeDisabled();

    // 重开设置仍是旧值，而存储里已是备份值 —— 运行时与持久化不一致
    await openSettings(user);
    expect(within(settingsDialog()).getByLabelText(KEY_LABEL)).toHaveValue('');
    expect(readConfig().apiKey).toBe('sk-backup');
  });

  it('重点取证：导入备份写盘 config/theme，但 App 运行时设置不刷新 → 重开设置旧值、批量并发旧值、AI 请求仍用旧 model/Key', async () => {
    seedConfig({ apiKey: 'sk-runtime-old', aiModel: 'deepseek-chat', concurrency: 3 });
    const { user, fetchMock } = setupApp();
    await waitForWorkbench();
    await openSettings(user);

    await uploadBackup(
      user,
      settingsDialog(),
      makeBackup({
        annotations: { '001': makeAnnotation() },
        config: { apiKey: 'sk-backup-new', aiModel: 'deepseek-reasoner', concurrency: 2 },
        theme: 'dark'
      })
    );

    // 备份 config/theme 已写盘
    expect(readConfig()).toMatchObject({ apiKey: 'sk-backup-new', aiModel: 'deepseek-reasoner', concurrency: 2 });
    expect(readTheme()).toBe('dark');
    // 但主题 UI 未刷新（onDataRestored 只重载 annotations）
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    // 重开设置：仍显示导入前的运行时旧值
    await closeSettings(user);
    await openSettings(user);
    const dialog = settingsDialog();
    expect(within(dialog).getByLabelText(KEY_LABEL)).toHaveValue('sk-runtime-old');
    expect(within(dialog).getByLabelText(MODEL_LABEL)).toHaveValue('deepseek-chat');
    expect(within(dialog).getByLabelText(CONCURRENCY_LABEL)).toHaveValue('3');

    // 危害放大：用户在旧表单上点「保存设置」，旧的运行时值会写回，覆盖刚导入的备份 config
    await user.click(within(dialog).getByRole('button', { name: '保存设置' }));
    await waitFor(() => expect(saveStatus()).toHaveTextContent('设置已保存'));
    expect(readConfig()).toMatchObject({ apiKey: 'sk-runtime-old', aiModel: 'deepseek-chat', concurrency: 3 });
    await closeSettings(user);

    // 批量分析默认并发仍是运行时旧值 3（而非备份里的 2）
    await user.click(actionButton('批量分析'));
    await screen.findByRole('heading', { name: '批量 AI 分析' });
    expect(screen.getByRole('combobox')).toHaveValue('3');
    await user.click(screen.getAllByRole('button', { name: '关闭' })[0]);

    // 单条 AI 分析仍使用旧 Key/model（备份 config 未生效）
    await user.click(actionButton('AI 分析'));
    expect(await screen.findByRole('heading', { name: '已得到 AI 建议' })).toBeInTheDocument();
    const deepSeekCall = getDeepSeekCalls(fetchMock)[0];
    expect(deepSeekCall[1].headers.Authorization).toBe('Bearer sk-runtime-old');
    expect(JSON.parse(deepSeekCall[1].body).model).toBe('deepseek-chat');
  });
});

// -------------------- C. 备份导出安全取证 --------------------

describe('C. 备份导出安全取证', () => {
  it('导出标注备份 → 备份 JSON 中 config.apiKey 为明文（安全风险取证），且 annotations 一并落盘', async () => {
    seedConfig({ apiKey: 'sk-plain-secret', aiModel: 'deepseek-chat', concurrency: 3 });
    saveAnnotations({ '001': makeAnnotation({ labels: ['accurate'], score: 5, comment: '已审核' }) });

    let capturedBlob = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      capturedBlob = blob;
      return 'blob:settings-backup';
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const { user } = setupApp();
    await waitForWorkbench();
    await openSettings(user);
    await user.click(within(settingsDialog()).getByRole('button', { name: '导出标注备份' }));
    expect(await within(settingsDialog()).findByText('标注备份已导出')).toBeInTheDocument();
    expect(capturedBlob).not.toBeNull();

    const raw = await capturedBlob.text();
    // 安全取证：明文 API Key 出现在可下载的备份文件中
    expect(raw).toContain('sk-plain-secret');

    const backup = JSON.parse(raw);
    expect(backup.config.apiKey).toBe('sk-plain-secret');
    expect(backup.annotations['001'].labels).toEqual(['accurate']);
    expect(backup).toHaveProperty('theme');
    expect(backup).toHaveProperty('exportedAt');
  });

  it('导出备份读取已落盘的 config：设置页未保存的 Key 输入不会进入备份文件', async () => {
    seedConfig({ apiKey: 'sk-saved-only', aiModel: 'deepseek-chat', concurrency: 3 });

    let capturedBlob = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      capturedBlob = blob;
      return 'blob:settings-backup';
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const { user } = setupApp();
    await waitForWorkbench();
    await openSettings(user);
    const dialog = settingsDialog();

    // 只在输入框里改，不点保存
    const keyInput = within(dialog).getByLabelText(KEY_LABEL);
    await user.clear(keyInput);
    await user.type(keyInput, 'sk-unsaved-draft');
    await user.click(within(dialog).getByRole('button', { name: '导出标注备份' }));
    await within(dialog).findByText('标注备份已导出');

    const backup = JSON.parse(await capturedBlob.text());
    expect(backup.config.apiKey).toBe('sk-saved-only');
    expect(await capturedBlob.text()).not.toContain('sk-unsaved-draft');
  });
});

// -------------------- D. 快捷键隔离 --------------------

describe('D. 快捷键隔离', () => {
  it('设置面板打开时 1/6、Alt+1、Enter、A、D 全部不生效；Esc 关闭后 Enter 恢复生效（进度 2 / 2）', async () => {
    seedConfig({ apiKey: 'sk-iso', aiModel: 'deepseek-chat', concurrency: 3 });
    const { user, fetchMock } = setupApp();
    await waitForWorkbench();
    await openSettings(user);

    fireEvent.keyDown(window, { key: '1' });
    fireEvent.keyDown(window, { key: '6' });
    fireEvent.keyDown(window, { key: '1', altKey: true });
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'd' });

    // 标注 / 评分 / 导航 / 主题 / AI 分析均不生效
    expect(readAnnotations()['001']).toBeUndefined();
    expect(getDeepSeekCalls(fetchMock)).toHaveLength(0);
    expect(progressCard()).toHaveTextContent(/1 \/ 2/);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(readTheme()).not.toBe('dark');
    expect(screen.getByRole('dialog', SETTINGS_HEADING)).toBeInTheDocument();

    // Esc 关闭后快捷键恢复：Enter 进入 2 / 2
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', SETTINGS_HEADING)).not.toBeInTheDocument());
    fireEvent.keyDown(window, { key: 'Enter' });
    await waitFor(() => expect(progressCard()).toHaveTextContent(/2 \/ 2/));
  });
});

// -------------------- E. 懒加载与关闭 --------------------

describe('E. 懒加载与关闭', () => {
  it('点击「设置」→ 懒加载 dialog 出现（aria-modal）；关闭按钮/遮罩均可关闭，关闭后主工作台可继续标注', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(actionButton('设置'));
    const dialog = await screen.findByRole('dialog', SETTINGS_HEADING);
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('heading', SETTINGS_HEADING)).toBeInTheDocument();

    // 关闭按钮关闭
    await user.click(within(dialog).getAllByRole('button', { name: '关闭' })[1]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // 重开 → 点击遮罩关闭
    await user.click(actionButton('设置'));
    const reopened = await screen.findByRole('dialog', SETTINGS_HEADING);
    fireEvent.click(reopened.parentElement);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // 主工作台继续标注
    await user.click(labelButton('回复准确'));
    expect(currentLabelBox()).toHaveTextContent('回复准确');
    expect(reviewedCard()).toHaveTextContent('1 / 2');
  });
});
