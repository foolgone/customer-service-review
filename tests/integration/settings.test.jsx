/**
 * 设置页 · App 级集成测试
 * 覆盖：入口与 dialog 语义、保存设置生效（API Key/模型/并发）、快捷键隔离、配置持久化
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { actionButton, installMatchMedia, readAnnotations, setupApp, waitForWorkbench } from './helpers/appHarness';

const SETTINGS_HEADING = { name: '设置' };
const CONFIG_KEY = 'cs-review-config-v1';

beforeEach(() => {
  localStorage.clear();
  installMatchMedia();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openSettings(user) {
  await user.click(actionButton('设置'));
  await screen.findByRole('heading', SETTINGS_HEADING);
  return screen.getByRole('dialog', SETTINGS_HEADING);
}

describe('设置页入口与基础交互', () => {
  it('点击「设置」→ 打开 dialog，回填当前（未配置）状态', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    const dialog = await openSettings(user);

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('DeepSeek API Key')).toHaveValue('');
    expect(screen.getByText('API Key 未配置')).toBeInTheDocument();
  });

  it('设置页打开时按标签快捷键 → 不修改底层数据（快捷键隔离）', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    await openSettings(user);

    fireEvent.keyDown(window, { key: '6' });
    fireEvent.keyDown(window, { key: '1', altKey: true });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(readAnnotations()['001']).toBeUndefined();
    expect(screen.getByRole('dialog', SETTINGS_HEADING)).toBeInTheDocument();
  });

  it('Esc 关闭设置页', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    await openSettings(user);
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('heading', SETTINGS_HEADING)).not.toBeInTheDocument());
  });
});

describe('设置保存生效', () => {
  it('保存 API Key 与模型 → 关闭后 AI 按钮启用，配置写入 localStorage', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    await openSettings(user);

    const keyInput = screen.getByLabelText('DeepSeek API Key');
    await user.clear(keyInput);
    await user.type(keyInput, 'sk-settings-test');
    await user.selectOptions(screen.getByLabelText('模型'), 'deepseek-reasoner');
    await user.click(screen.getByRole('button', { name: '保存设置' }));

    const stored = JSON.parse(localStorage.getItem(CONFIG_KEY));
    expect(stored.apiKey).toBe('sk-settings-test');
    expect(stored.aiModel).toBe('deepseek-reasoner');

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('heading', SETTINGS_HEADING)).not.toBeInTheDocument());

    expect(actionButton('AI 分析')).toBeEnabled();
  });

  it('重新打开应用后从 localStorage 恢复已保存的 Key（不再依赖构建期环境变量）', async () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ apiKey: 'sk-persisted', aiModel: 'deepseek-chat', concurrency: 2 }));

    const { user } = setupApp();
    await waitForWorkbench();

    expect(actionButton('AI 分析')).toBeEnabled();

    await openSettings(user);
    expect(screen.getByLabelText('DeepSeek API Key')).toHaveValue('sk-persisted');
    expect(screen.getByLabelText('批量分析默认并发')).toHaveValue('2');
  });

  it('批量分析面板使用设置里的默认并发数', async () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ apiKey: 'sk-persisted', aiModel: 'deepseek-chat', concurrency: 4 }));

    const { user } = setupApp();
    await waitForWorkbench();
    await user.click(actionButton('批量分析'));
    await screen.findByRole('heading', { name: '批量 AI 分析' });

    expect(screen.getByRole('combobox')).toHaveValue('4');
  });
});
