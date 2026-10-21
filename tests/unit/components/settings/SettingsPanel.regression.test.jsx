/**
 * SettingsPanel BUG-29 / BUG-30 专项回归测试
 * 对应修复提交 ac38f63（BUG-25~30：备份安全与恢复刷新）。
 *
 * 覆盖：
 * - BUG-29：存在未保存的模型/并发草稿时点「清除 API Key」→ 只提交 apiKey 变更，
 *           model/concurrency 取「已保存值」，表单回滚，提示「已清除 API Key」；
 * - BUG-30（草稿同步）：面板打开期间父级 settings 因保存/恢复刷新而变化 → 不重置正在编辑的草稿与提示；
 * - BUG-30（重新打开）：open=false → open=true 后按最新 settings 同步表单并清空旧提示；
 * - BUG-30（遮罩容错）：onClose 未传时点击遮罩不抛错；
 * - 保存成功后父级回传新 settings → 「设置已保存」提示保留、表单显示新值。
 *
 * 说明：
 * - 使用真实 src/lib/storage.js 与 useDialogA11y；导出备份处仅 spy 浏览器下载 API，避免真实 Blob 下载；
 * - 不修改源码与既有测试；按修复后的当前行为断言（中文用例名「条件 → 预期」）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPanel from '../../../../src/components/settings/SettingsPanel.jsx';

const BASE_SETTINGS = { apiKey: 'sk-saved', model: 'deepseek-chat', concurrency: 3 };

function renderPanel(overrides = {}) {
  const props = {
    open: true,
    settings: { ...BASE_SETTINGS },
    onClose: vi.fn(),
    onSave: vi.fn(),
    onDataRestored: vi.fn(),
    ...overrides
  };

  const utils = render(<SettingsPanel {...props} />);

  // 模拟父级 state 更新后重新传参（同一挂载实例，isSettingsOpen 常驻场景）
  const rerenderPanel = (next = {}) => {
    const nextProps = { ...props, ...next };
    utils.rerender(<SettingsPanel {...nextProps} />);
    return nextProps;
  };

  return { ...utils, props, rerenderPanel };
}

function stubDownload() {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:vitest-mock-url');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SettingsPanel BUG-29 · 清除 API Key 与未保存草稿隔离', () => {
  it('未保存修改模型/并发后点「清除 API Key」→ onSave 只提交 apiKey 变更（model/concurrency 为已保存值），表单回滚', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel({ settings: { ...BASE_SETTINGS } });

    await user.selectOptions(screen.getByLabelText('模型'), 'deepseek-reasoner');
    await user.selectOptions(screen.getByLabelText('批量分析默认并发'), '5');

    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-reasoner');
    expect(screen.getByLabelText('批量分析默认并发')).toHaveValue('5');

    await user.click(screen.getByRole('button', { name: '清除 API Key' }));

    // 只提交 apiKey 变更，模型/并发回到已保存值（草稿不连带提交）
    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(props.onSave).toHaveBeenCalledWith({ apiKey: '', model: 'deepseek-chat', concurrency: 3 });

    expect(await screen.findByText('已清除 API Key')).toBeInTheDocument();
    expect(screen.getByLabelText('DeepSeek API Key')).toHaveValue('');
    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-chat');
    expect(screen.getByLabelText('批量分析默认并发')).toHaveValue('3');
    expect(screen.getByText('API Key 未配置')).toBeInTheDocument();
  });
});

describe('SettingsPanel BUG-30 · 父级设置同步边界', () => {
  it('打开期间父级 settings 变化 → 正在编辑的草稿与提示均不被重置', async () => {
    const user = userEvent.setup();
    stubDownload();
    const { props, rerenderPanel } = renderPanel({ settings: { ...BASE_SETTINGS } });

    // 产生草稿与一条提示
    await user.selectOptions(screen.getByLabelText('模型'), 'deepseek-reasoner');
    await user.click(screen.getByRole('button', { name: '导出标注备份' }));
    expect(await screen.findByText('标注备份已导出')).toBeInTheDocument();

    // 父级因保存/恢复刷新而回传新 settings（并发变化）
    rerenderPanel({ settings: { apiKey: 'sk-saved', model: 'deepseek-chat', concurrency: 2 } });

    // 草稿保留：模型仍是未保存的 reasoner，并发仍是打开时的 3（未被 prop 覆盖）
    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-reasoner');
    expect(screen.getByLabelText('批量分析默认并发')).toHaveValue('3');
    // 提示保留，未触发意外提交
    expect(screen.getByText('标注备份已导出')).toBeInTheDocument();
    expect(props.onSave).not.toHaveBeenCalled();
  });

  it('open=false 后再次 open=true → 表单按最新 settings 同步并清空旧提示', async () => {
    const user = userEvent.setup();
    const { rerenderPanel } = renderPanel({ settings: { ...BASE_SETTINGS } });

    await user.selectOptions(screen.getByLabelText('模型'), 'deepseek-reasoner');

    const refreshedSettings = { apiKey: 'sk-restored', model: 'deepseek-chat', concurrency: 2 };

    // 父级刷新（打开期间不重置草稿）
    rerenderPanel({ settings: refreshedSettings });
    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-reasoner');
    expect(screen.getByLabelText('批量分析默认并发')).toHaveValue('3');

    // 关闭 → 隐藏；再次打开 → 同步最新 settings
    rerenderPanel({ open: false, settings: refreshedSettings });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    rerenderPanel({ open: true, settings: refreshedSettings });

    expect(screen.getByRole('dialog', { name: '设置' })).toBeInTheDocument();
    expect(screen.getByLabelText('DeepSeek API Key')).toHaveValue('sk-restored');
    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-chat');
    expect(screen.getByLabelText('批量分析默认并发')).toHaveValue('2');
    // 重新打开时旧提示被清空，回落到默认提示
    expect(screen.getByText('修改后点击「保存设置」生效')).toBeInTheDocument();
  });

  it('onClose 未传 → 点击遮罩/关闭按钮/按 Esc 均不抛错', () => {
    const { props } = renderPanel({ onClose: undefined });
    const dialog = screen.getByRole('dialog', { name: '设置' });

    expect(() => fireEvent.click(dialog.parentElement)).not.toThrow();
    expect(() => fireEvent.click(screen.getAllByRole('button', { name: '关闭' })[0])).not.toThrow();
    expect(() => fireEvent.click(screen.getAllByRole('button', { name: '关闭' })[1])).not.toThrow();
    expect(() => fireEvent.keyDown(window, { key: 'Escape' })).not.toThrow();
    expect(props.onClose).toBeUndefined();
  });

  it('点击「保存设置」后父级回传新 settings → 「设置已保存」提示保留，表单显示新值', async () => {
    const user = userEvent.setup();
    const { props, rerenderPanel } = renderPanel({
      settings: { apiKey: '', model: 'deepseek-chat', concurrency: 3 }
    });

    await user.type(screen.getByLabelText('DeepSeek API Key'), 'sk-new-saved');
    await user.selectOptions(screen.getByLabelText('模型'), 'deepseek-reasoner');
    await user.selectOptions(screen.getByLabelText('批量分析默认并发'), '5');
    await user.click(screen.getByRole('button', { name: '保存设置' }));

    expect(props.onSave).toHaveBeenCalledWith({
      apiKey: 'sk-new-saved',
      model: 'deepseek-reasoner',
      concurrency: 5
    });
    expect(await screen.findByText('设置已保存')).toBeInTheDocument();

    // App 的 onSave 会 setState 后再把新 settings 传回面板
    rerenderPanel({ settings: { apiKey: 'sk-new-saved', model: 'deepseek-reasoner', concurrency: 5 } });

    expect(screen.getByText('设置已保存')).toBeInTheDocument();
    expect(screen.getByLabelText('DeepSeek API Key')).toHaveValue('sk-new-saved');
    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-reasoner');
    expect(screen.getByLabelText('批量分析默认并发')).toHaveValue('5');
    expect(screen.getByText('API Key 已配置')).toBeInTheDocument();
  });

  it('残余风险取证：打开期间导入含配置的备份后直接保存 → 用打开时的旧值覆盖刚恢复的配置（疑似缺陷，非本次修复范围）', async () => {
    const user = userEvent.setup();
    const { props, rerenderPanel, container } = renderPanel({
      settings: { apiKey: 'sk-local', model: 'deepseek-chat', concurrency: 3 }
    });

    // 面板内导入一份含白名单配置字段的有效备份（BUG-26/27 已修复路径）
    const backup = { config: { aiModel: 'deepseek-reasoner', concurrency: 5, autoSave: false } };
    await user.upload(
      container.querySelector('input[type="file"]'),
      new File([JSON.stringify(backup)], 'config-backup.json', { type: 'application/json' })
    );
    expect(await screen.findByText(/备份已恢复（配置）/)).toBeInTheDocument();

    // App 的 handleDataRestored（BUG-25）会重载 settings 并把新值回传面板
    rerenderPanel({ settings: { apiKey: 'sk-local', model: 'deepseek-reasoner', concurrency: 5 } });

    // BUG-30 的取舍：打开期间不同步 draft → 表单仍停留在打开时的旧值
    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-chat');
    expect(screen.getByLabelText('批量分析默认并发')).toHaveValue('3');

    // 此时点「保存设置」→ 用旧表单值覆盖刚恢复的配置
    await user.click(screen.getByRole('button', { name: '保存设置' }));
    expect(props.onSave).toHaveBeenCalledWith({ apiKey: 'sk-local', model: 'deepseek-chat', concurrency: 3 });
    expect(await screen.findByText('设置已保存')).toBeInTheDocument();
  });
});
