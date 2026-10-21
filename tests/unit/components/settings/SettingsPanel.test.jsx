/**
 * SettingsPanel 组件测试
 * 覆盖：渲染与回填、保存设置、清除 Key、导出备份、导入备份、清空标注、Esc 关闭
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPanel from '../../../../src/components/settings/SettingsPanel.jsx';
import { getAnnotations, saveAnnotations } from '../../../../src/lib/storage.js';

const ANNOTATIONS_KEY = 'cs-review-annotations-v1';

function renderPanel(overrides = {}) {
  const props = {
    open: true,
    settings: { apiKey: 'sk-existing', model: 'deepseek-chat', concurrency: 3 },
    onClose: vi.fn(),
    onSave: vi.fn(),
    onDataRestored: vi.fn(),
    ...overrides
  };
  const utils = render(<SettingsPanel {...props} />);
  return { ...utils, props };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SettingsPanel 渲染', () => {
  it('open=false → 不渲染', () => {
    renderPanel({ open: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('渲染 dialog 语义、标题与回填当前设置', () => {
    renderPanel();

    const dialog = screen.getByRole('dialog', { name: '设置' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('DeepSeek API Key')).toHaveValue('sk-existing');
    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-chat');
    expect(screen.getByLabelText('批量分析默认并发')).toHaveValue('3');
    expect(screen.getByText('API Key 已配置')).toBeInTheDocument();
  });
});

describe('SettingsPanel AI 配置', () => {
  it('修改后保存 → onSave 收到归一化设置，并提示成功', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.clear(screen.getByLabelText('DeepSeek API Key'));
    await user.type(screen.getByLabelText('DeepSeek API Key'), '  sk-new  ');
    await user.selectOptions(screen.getByLabelText('模型'), 'deepseek-reasoner');
    await user.selectOptions(screen.getByLabelText('批量分析默认并发'), '4');
    await user.click(screen.getByRole('button', { name: '保存设置' }));

    expect(props.onSave).toHaveBeenCalledWith({ apiKey: 'sk-new', model: 'deepseek-reasoner', concurrency: 4 });
    expect(await screen.findByText('设置已保存')).toBeInTheDocument();
  });

  it('清除 API Key → onSave 收到空 Key', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.click(screen.getByRole('button', { name: '清除 API Key' }));

    expect(props.onSave).toHaveBeenCalledWith(expect.objectContaining({ apiKey: '' }));
    expect(await screen.findByText('已清除 API Key')).toBeInTheDocument();
  });
});

describe('SettingsPanel 数据管理', () => {
  it('导出标注备份 → 触发 JSON 下载', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    saveAnnotations({ '001': { labels: ['accurate'], score: 5 } });

    renderPanel();
    await user.click(screen.getByRole('button', { name: '导出标注备份' }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('标注备份已导出')).toBeInTheDocument();
  });

  it('导入备份 → 写入标注并回调 onDataRestored', async () => {
    const user = userEvent.setup();
    const { props, container } = renderPanel();
    const backup = {
      annotations: { '009': { labels: ['risky'], score: 1, comment: '旧备份' } },
      theme: 'dark'
    };
    const file = new File([JSON.stringify(backup)], 'backup.json', { type: 'application/json' });

    const input = container.querySelector('input[type="file"]');
    await user.upload(input, file);

    await waitFor(() => expect(props.onDataRestored).toHaveBeenCalledTimes(1));
    expect(getAnnotations()['009'].comment).toBe('旧备份');
    expect(await screen.findByText(/备份已恢复/)).toBeInTheDocument();
  });

  it('导入非法 JSON → 提示恢复失败且不改数据', async () => {
    const user = userEvent.setup();
    const { props, container } = renderPanel();
    const file = new File(['not-json'], 'bad.json', { type: 'application/json' });

    await user.upload(container.querySelector('input[type="file"]'), file);

    expect(await screen.findByText(/Unexpected token|JSON/i)).toBeInTheDocument();
    expect(props.onDataRestored).not.toHaveBeenCalled();
  });

  it('清空本地标注 → 二次确认后清空并回调', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    saveAnnotations({ '001': { labels: ['accurate'] } });

    await user.click(screen.getByRole('button', { name: '清空本地标注' }));

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(ANNOTATIONS_KEY)).toBe('{}');
    expect(props.onDataRestored).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('本地标注已清空')).toBeInTheDocument();
  });

  it('取消确认 → 不清空数据', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    saveAnnotations({ '001': { labels: ['accurate'] } });

    await user.click(screen.getByRole('button', { name: '清空本地标注' }));

    expect(props.onDataRestored).not.toHaveBeenCalled();
    expect(getAnnotations()['001'].labels).toEqual(['accurate']);
  });
});

describe('SettingsPanel 关闭', () => {
  it('Esc 关闭面板', () => {
    const { props } = renderPanel();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩关闭；点击内容区不关闭', () => {
    const { props } = renderPanel();

    fireEvent.click(screen.getByRole('heading', { name: '设置' }));
    expect(props.onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('dialog').parentElement);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
