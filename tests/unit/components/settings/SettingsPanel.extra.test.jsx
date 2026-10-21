/**
 * SettingsPanel 补充组件测试（task-10）
 * 与开发自带的 SettingsPanel.test.jsx 互补，聚焦「漏洞面 + 安全取证」：
 * - 未保存草稿在关闭（卸载）重开后回填原值；保存后回填新值；
 * - API Key 状态徽标随输入实时变化、清空 / 清除按钮后的状态；
 * - 导出标注备份：捕获 Blob 与下载文件名，解析 JSON 结构，并取证 config.apiKey 是否明文出现在备份中；
 * - 导入备份边界：空对象 {}、非对象 JSON（"123" / "[]"）、"null"、取消文件选择；
 * - onSave / onDataRestored 缺省时的容错；
 * - 数据管理文案（autoSave / 导入历史条数）；
 * - 焦点进入 dialog、Tab / Shift+Tab 焦点循环；
 * - 双关闭按钮、遮罩关闭与内容区不关闭；
 * - 疑似缺陷取证：备份明文 Key、空备份假成功、导入覆盖 config。
 *
 * 说明：
 * - 复用真实 src/lib/storage.js 与 useDialogA11y，只 spy 浏览器下载 API（URL.createObjectURL / anchor.click）；
 * - 不修改任何源码；对疑似缺陷按当前行为断言并在用例名 / 注释中登记；
 * - 「关闭后重开」按 App 的实际行为模拟：App 用条件挂载（isSettingsOpen ? <SettingsPanel/> : null），
 *   关闭即卸载、再次打开重新挂载，因此测试用 unmount + 重新 render 模拟，而非仅切换 open prop。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPanel from '../../../../src/components/settings/SettingsPanel.jsx';
import {
  addImportHistory,
  getAnnotations,
  getConfig,
  getImportHistory,
  getTheme,
  saveAnnotations,
  saveConfig,
  saveTheme
} from '../../../../src/lib/storage.js';

const ANNOTATIONS_KEY = 'cs-review-annotations-v1';
const CONFIG_KEY = 'cs-review-config-v1';
const BASE_SETTINGS = { apiKey: 'sk-original', model: 'deepseek-chat', concurrency: 3 };

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

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
  return { ...utils, props };
}

function getDialog() {
  return screen.getByRole('dialog', { name: '设置' });
}

function getFileInput(container) {
  return container.querySelector('input[type="file"]');
}

function getFocusables() {
  return Array.from(getDialog().querySelectorAll(FOCUSABLE_SELECTOR));
}

function makeFile(content, name = 'backup.json') {
  return new File([typeof content === 'string' ? content : JSON.stringify(content)], name, {
    type: 'application/json'
  });
}

/** 拦截真实下载：捕获 createObjectURL 的 Blob 与 anchor.click 的 <a> 元素 */
function spyDownload() {
  const captured = { blob: null, anchors: [] };

  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    captured.blob = blob;
    return 'blob:vitest-mock-url';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function captureAnchorClick() {
    captured.anchors.push(this);
  });

  return captured;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SettingsPanel 补充 · 草稿保存与回填', () => {
  it('修改 Key/模型/并发后不保存直接关闭 → 重开回填原值（草稿丢弃）', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSave = vi.fn();

    const { unmount } = render(
      <SettingsPanel open settings={{ ...BASE_SETTINGS }} onClose={onClose} onSave={onSave} onDataRestored={vi.fn()} />
    );

    await user.clear(screen.getByLabelText('DeepSeek API Key'));
    await user.type(screen.getByLabelText('DeepSeek API Key'), 'sk-draft');
    await user.selectOptions(screen.getByLabelText('模型'), 'deepseek-reasoner');
    await user.selectOptions(screen.getByLabelText('批量分析默认并发'), '5');

    expect(screen.getByLabelText('DeepSeek API Key')).toHaveValue('sk-draft');
    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-reasoner');
    expect(screen.getByLabelText('批量分析默认并发')).toHaveValue('5');

    await user.click(screen.getAllByRole('button', { name: '关闭' })[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();

    // 模拟 App：关闭后卸载，父级 settings 未变 → 重新打开时回填原值
    unmount();
    render(
      <SettingsPanel
        open
        settings={{ ...BASE_SETTINGS }}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDataRestored={vi.fn()}
      />
    );

    expect(screen.getByLabelText('DeepSeek API Key')).toHaveValue('sk-original');
    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-chat');
    expect(screen.getByLabelText('批量分析默认并发')).toHaveValue('3');
  });

  it('保存后关闭重开 → 回填保存后的新值，徽标为已配置', async () => {
    const user = userEvent.setup();
    let parentSettings = { apiKey: '', model: 'deepseek-chat', concurrency: 3 };
    const onSave = vi.fn((next) => {
      parentSettings = next;
    });

    const { unmount } = render(
      <SettingsPanel
        open
        settings={{ ...parentSettings }}
        onClose={vi.fn()}
        onSave={onSave}
        onDataRestored={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText('DeepSeek API Key'), '  sk-saved-new  ');
    await user.selectOptions(screen.getByLabelText('模型'), 'deepseek-reasoner');
    await user.selectOptions(screen.getByLabelText('批量分析默认并发'), '4');
    await user.click(screen.getByRole('button', { name: '保存设置' }));

    expect(onSave).toHaveBeenCalledWith({ apiKey: 'sk-saved-new', model: 'deepseek-reasoner', concurrency: 4 });

    unmount();
    render(
      <SettingsPanel
        open
        settings={{ ...parentSettings }}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDataRestored={vi.fn()}
      />
    );

    expect(screen.getByLabelText('DeepSeek API Key')).toHaveValue('sk-saved-new');
    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-reasoner');
    expect(screen.getByLabelText('批量分析默认并发')).toHaveValue('4');
    expect(screen.getByText('API Key 已配置')).toBeInTheDocument();
  });
});

describe('SettingsPanel 补充 · API Key 状态徽标', () => {
  it('初始未配置 → 输入任意字符实时变「已配置」→ 清空后回「未配置」', async () => {
    const user = userEvent.setup();
    renderPanel({ settings: { apiKey: '', model: 'deepseek-chat', concurrency: 3 } });

    expect(screen.getByText('API Key 未配置')).toBeInTheDocument();

    const keyInput = screen.getByLabelText('DeepSeek API Key');
    await user.type(keyInput, 's');
    expect(screen.getByText('API Key 已配置')).toBeInTheDocument();
    expect(screen.queryByText('API Key 未配置')).not.toBeInTheDocument();

    await user.clear(keyInput);
    expect(screen.getByText('API Key 未配置')).toBeInTheDocument();
  });

  it('点击「清除 API Key」→ 徽标回「未配置」，onSave 收到空 Key 并提示已清除', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    expect(screen.getByText('API Key 已配置')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '清除 API Key' }));

    expect(await screen.findByText('已清除 API Key')).toBeInTheDocument();
    expect(screen.getByText('API Key 未配置')).toBeInTheDocument();
    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ apiKey: '' }));
  });
});

describe('SettingsPanel 补充 · 导出标注备份与安全取证', () => {
  it('导出备份 → 文件名形如「质检标注备份-YYYY-MM-DD.json」，Blob 含 annotations/theme/config/importHistory/exportedAt', async () => {
    const user = userEvent.setup();
    saveAnnotations({ '001': { labels: ['accurate'], score: 5 } });
    saveTheme('dark');
    addImportHistory({ fileName: 'seed.json' });
    const captured = spyDownload();

    renderPanel();
    await user.click(screen.getByRole('button', { name: '导出标注备份' }));

    expect(await screen.findByText('标注备份已导出')).toBeInTheDocument();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(captured.blob).toBeInstanceOf(Blob);
    expect(captured.anchors).toHaveLength(1);
    expect(captured.anchors[0].download).toMatch(/^质检标注备份-\d{4}-\d{2}-\d{2}\.json$/);
    expect(captured.anchors[0].download).toBe(`质检标注备份-${new Date().toISOString().slice(0, 10)}.json`);

    const backup = JSON.parse(await captured.blob.text());
    expect(Object.keys(backup).sort()).toEqual(['annotations', 'config', 'exportedAt', 'importHistory', 'theme']);
    expect(backup.annotations).toEqual({ '001': { labels: ['accurate'], score: 5 } });
    expect(backup.theme).toBe('dark');
    expect(backup.importHistory).toHaveLength(1);
    expect(typeof backup.exportedAt).toBe('string');
    expect(Number.isNaN(Date.parse(backup.exportedAt))).toBe(false);
  });

  it('安全取证：导出备份包含明文 config.apiKey（疑似缺陷：备份文件泄露 API Key）', async () => {
    const user = userEvent.setup();
    saveConfig({ ...getConfig(), apiKey: 'sk-forensics-plain-123', autoSave: true });
    const captured = spyDownload();

    renderPanel();
    await user.click(screen.getByRole('button', { name: '导出标注备份' }));

    const backup = JSON.parse(await captured.blob.text());

    // 现状取证：备份 JSON 里 config.apiKey 为明文原值，未脱敏 / 未剔除
    expect(backup.config.apiKey).toBe('sk-forensics-plain-123');
    expect(JSON.stringify(backup)).toContain('sk-forensics-plain-123');
    // 对照：没有任何脱敏痕迹
    expect(JSON.stringify(backup)).not.toContain('***');
  });

  it('导出失败抛 Error → 展示 error.message；抛非 Error → 展示兜底「备份导出失败」', async () => {
    const user = userEvent.setup();
    const { rerender } = renderPanel();
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('创建下载链接失败');
    });

    await user.click(screen.getByRole('button', { name: '导出标注备份' }));
    expect(await screen.findByText('创建下载链接失败')).toBeInTheDocument();

    vi.restoreAllMocks();
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw 'url 创建异常';
    });
    rerender(<SettingsPanel open settings={{ ...BASE_SETTINGS }} onClose={vi.fn()} onSave={vi.fn()} onDataRestored={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '导出标注备份' }));
    expect(await screen.findByText('备份导出失败')).toBeInTheDocument();
  });
});

describe('SettingsPanel 补充 · 导入备份边界', () => {
  it('导入空对象 {} → 当前提示「备份已恢复」并回调，但实际无任何数据写入（疑似缺陷：假成功）', async () => {
    const user = userEvent.setup();
    const { props, container } = renderPanel();
    saveAnnotations({ '001': { labels: ['accurate'] } });

    await user.upload(getFileInput(container), makeFile('{}', 'empty.json'));

    await waitFor(() => expect(props.onDataRestored).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('备份已恢复')).toBeInTheDocument();

    // 取证：没有任何字段，importAllData 什么也没写；提示成功会误导用户
    expect(getAnnotations()).toEqual({ '001': { labels: ['accurate'] } });
    expect(getTheme()).toBe('light');
    expect(getImportHistory()).toEqual([]);
    expect(localStorage.getItem(CONFIG_KEY)).toBeNull();
  });

  it('导入非对象 JSON（"123" / "[]"）→ 按当前行为仍提示「备份已恢复」（疑似缺陷：无格式校验）', async () => {
    const user = userEvent.setup();
    const { props, container } = renderPanel();
    const fileInput = getFileInput(container);

    await user.upload(fileInput, makeFile('123', 'number.json'));
    await waitFor(() => expect(props.onDataRestored).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('备份已恢复')).toBeInTheDocument();

    await user.upload(fileInput, makeFile('[]', 'array.json'));
    await waitFor(() => expect(props.onDataRestored).toHaveBeenCalledTimes(2));
    expect(screen.getByText('备份已恢复')).toBeInTheDocument();
    expect(localStorage.getItem(ANNOTATIONS_KEY)).toBeNull();
  });

  it('导入 JSON "null" → 抛 TypeError 被捕获，错误信息透传引擎原文（疑似缺陷：无友好提示）', async () => {
    const user = userEvent.setup();
    const { props, container } = renderPanel();

    await user.upload(getFileInput(container), makeFile('null', 'null.json'));

    expect(await screen.findByText(/Cannot read properties of null/)).toBeInTheDocument();
    expect(props.onDataRestored).not.toHaveBeenCalled();
    expect(screen.queryByText('备份已恢复')).not.toBeInTheDocument();
  });

  it('取消文件选择（change 无 file）→ 无提示变化、不回调、不报错', () => {
    const { props, container } = renderPanel();

    fireEvent.change(getFileInput(container));

    expect(screen.getByText('修改后点击「保存设置」生效')).toBeInTheDocument();
    expect(screen.queryByText('备份已恢复')).not.toBeInTheDocument();
    expect(props.onDataRestored).not.toHaveBeenCalled();
  });

  it('导入文件读取抛非 Error → 展示兜底「备份恢复失败」', async () => {
    const user = userEvent.setup();
    const { props, container } = renderPanel();
    const file = makeFile('{}', 'broken.json');
    Object.defineProperty(file, 'text', {
      value: () => Promise.reject('读取失败')
    });

    await user.upload(getFileInput(container), file);

    expect(await screen.findByText('备份恢复失败')).toBeInTheDocument();
    expect(props.onDataRestored).not.toHaveBeenCalled();
  });

  it('导入含 config 的备份 → 整对象覆盖本地配置（取证：可改写 apiKey 且丢弃既有配置字段）', async () => {
    const user = userEvent.setup();
    const { props, container } = renderPanel();
    saveConfig({ ...getConfig(), apiKey: 'sk-current', autoSave: true, temperature: 0.7 });

    await user.upload(
      getFileInput(container),
      makeFile({ config: { apiKey: 'sk-injected', autoSave: false } }, 'config-only.json')
    );

    await waitFor(() => expect(props.onDataRestored).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('备份已恢复')).toBeInTheDocument();

    // 取证：备份里的 config 被整对象覆盖（非合并），既有 aiModel/temperature 等字段丢失
    expect(getConfig()).toEqual({ apiKey: 'sk-injected', autoSave: false });
    expect(getConfig().temperature).toBeUndefined();
    // 面板重渲染后文案随覆盖后的 autoSave 变化
    expect(screen.getByText(/自动保存关闭 ｜ 导入历史 0 条/)).toBeInTheDocument();
  });
});

describe('SettingsPanel 补充 · 缺省回调容错', () => {
  it('未传 onSave → 点击「保存设置」「清除 API Key」均不抛错且提示成功', async () => {
    const user = userEvent.setup();
    renderPanel({ onSave: undefined });

    await user.click(screen.getByRole('button', { name: '保存设置' }));
    expect(await screen.findByText('设置已保存')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '清除 API Key' }));
    expect(await screen.findByText('已清除 API Key')).toBeInTheDocument();
    expect(screen.getByText('API Key 未配置')).toBeInTheDocument();
  });

  it('未传 onDataRestored → 清空标注 / 导入备份均不抛错且提示成功', async () => {
    const user = userEvent.setup();
    const { container } = renderPanel({ onDataRestored: undefined });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    saveAnnotations({ '001': { labels: ['accurate'] } });

    await user.click(screen.getByRole('button', { name: '清空本地标注' }));
    expect(await screen.findByText('本地标注已清空')).toBeInTheDocument();
    expect(localStorage.getItem(ANNOTATIONS_KEY)).toBe('{}');

    await user.upload(getFileInput(container), makeFile({ annotations: { '002': { labels: ['risky'] } } }, 'ok.json'));
    expect(await screen.findByText('备份已恢复')).toBeInTheDocument();
    expect(getAnnotations()['002'].labels).toEqual(['risky']);
  });
});

describe('SettingsPanel 补充 · 数据管理文案', () => {
  it('默认配置 autoSave=true → 显示「自动保存开启」，无导入历史 → 「导入历史 0 条」', () => {
    renderPanel();

    expect(screen.getByText(/当前配置版本：自动保存开启 ｜ 导入历史 0 条/)).toBeInTheDocument();
  });

  it('autoSave=false 且导入历史 2 条 → 文案同步为「自动保存关闭」「导入历史 2 条」', () => {
    saveConfig({ ...getConfig(), autoSave: false });
    addImportHistory({ fileName: 'a.json' });
    addImportHistory({ fileName: 'b.json' });

    renderPanel();

    expect(screen.getByText(/当前配置版本：自动保存关闭 ｜ 导入历史 2 条/)).toBeInTheDocument();
    expect(getImportHistory()).toHaveLength(2);
  });

  it('settings 缺省/传空对象 → 模型与并发回落到默认值，Key 为未配置', () => {
    const { unmount } = renderPanel({ settings: undefined });
    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-chat');
    expect(screen.getByLabelText('批量分析默认并发')).toHaveValue('3');
    expect(screen.getByText('API Key 未配置')).toBeInTheDocument();
    unmount();

    renderPanel({ settings: {} });
    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-chat');
    expect(screen.getByLabelText('批量分析默认并发')).toHaveValue('3');
  });
});

describe('SettingsPanel 补充 · 焦点与 Tab 循环', () => {
  it('打开后焦点进入 dialog 的第一个可聚焦元素（标题区关闭按钮）', () => {
    renderPanel();

    const dialog = getDialog();
    const focusables = getFocusables();

    expect(focusables.length).toBeGreaterThan(3);
    expect(document.activeElement).toBe(focusables[0]);
    expect(focusables[0]).toBe(screen.getAllByRole('button', { name: '关闭' })[0]);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('在最后一个可聚焦元素按 Tab → 回到第一个；在第一个按 Shift+Tab → 跳到最后一个', () => {
    renderPanel();
    const focusables = getFocusables();
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    // 最后一个可聚焦元素是底部「关闭」按钮（隐藏的 file input 在它之前）
    expect(last).toBe(screen.getAllByRole('button', { name: '关闭' })[1]);

    last.focus();
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('在中间元素按 Tab → 不拦截默认行为（焦点保持在原元素）', () => {
    renderPanel();
    const keyInput = screen.getByLabelText('DeepSeek API Key');

    keyInput.focus();
    fireEvent.keyDown(keyInput, { key: 'Tab' });

    expect(document.activeElement).toBe(keyInput);
  });
});

describe('SettingsPanel 补充 · 关闭与文件入口', () => {
  it('标题区关闭与底部关闭分别调用 onClose', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();
    const [titleClose, footerClose] = screen.getAllByRole('button', { name: '关闭' });

    await user.click(titleClose);
    expect(props.onClose).toHaveBeenCalledTimes(1);

    await user.click(footerClose);
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it('点击遮罩关闭；点击内容区不关闭', () => {
    const { props } = renderPanel();

    fireEvent.click(screen.getByRole('heading', { name: '设置' }));
    expect(props.onClose).not.toHaveBeenCalled();

    fireEvent.click(getDialog().parentElement);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('点击「导入备份」→ 触发隐藏 file input 的 click，不直接打开系统弹窗', async () => {
    const user = userEvent.setup();
    const inputClickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const { container } = renderPanel();

    await user.click(screen.getByRole('button', { name: '导入备份' }));

    expect(inputClickSpy).toHaveBeenCalledTimes(1);
    expect(inputClickSpy.mock.instances[0]).toBe(getFileInput(container));
    expect(screen.getByText('修改后点击「保存设置」生效')).toBeInTheDocument();
  });
});
