/**
 * SettingsPanel BUG-31 专项回归
 * 守护「面板内导入备份后主动同步表单」这一修复，并记录其与既有草稿契约的边界：
 * - 恢复含配置的备份 → 表单同步为恢复结果；保存不会回退
 * - 恢复仅含标注的备份 → 已保存配置不变，但未保存的表单草稿会被同步为已保存值（当前行为）
 * - 恢复失败（非法/空备份）→ 表单草稿保持不变
 * - 备份中的 apiKey 注入不会进入表单（本机 Key 优先）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPanel from '../../../../src/components/settings/SettingsPanel.jsx';
import { getConfig, saveConfig, saveAnnotations } from '../../../../src/lib/storage.js';

function renderPanel(settingsOverrides = {}) {
  const props = {
    open: true,
    settings: { apiKey: 'sk-local', model: 'deepseek-chat', concurrency: 3, ...settingsOverrides },
    onClose: vi.fn(),
    onSave: vi.fn(),
    onDataRestored: vi.fn()
  };
  return { ...render(<SettingsPanel {...props} />), props };
}

function fileInput(container) {
  return container.querySelector('input[type="file"]');
}

function makeFile(content, name = 'backup.json') {
  return new File([typeof content === 'string' ? content : JSON.stringify(content)], name, {
    type: 'application/json'
  });
}

beforeEach(() => {
  localStorage.clear();
  saveConfig({ apiKey: 'sk-local', aiModel: 'deepseek-chat', concurrency: 3 });
});

describe('BUG-31 面板内恢复后表单同步', () => {
  it('恢复含配置的备份 → 表单同步为恢复结果（本机 Key + 备份模型/并发），保存提交恢复后的值', async () => {
    const user = userEvent.setup();
    const { props, container } = renderPanel();

    await user.upload(
      fileInput(container),
      makeFile({ annotations: {}, config: { aiModel: 'deepseek-reasoner', concurrency: 2 } })
    );

    await waitFor(() => expect(props.onDataRestored).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-reasoner');
    expect(screen.getByLabelText('批量分析默认并发')).toHaveValue('2');
    expect(screen.getByLabelText('DeepSeek API Key')).toHaveValue('sk-local');

    await user.click(screen.getByRole('button', { name: '保存设置' }));
    expect(props.onSave).toHaveBeenCalledWith({
      apiKey: 'sk-local',
      model: 'deepseek-reasoner',
      concurrency: 2
    });
  });

  it('恢复仅含标注的备份 → 已保存配置不变；未保存的表单草稿会被同步回已保存值（当前行为）', async () => {
    const user = userEvent.setup();
    const { container } = renderPanel();

    // 用户先在表单里改了模型/并发但没有保存
    await user.selectOptions(screen.getByLabelText('模型'), 'deepseek-reasoner');
    await user.selectOptions(screen.getByLabelText('批量分析默认并发'), '5');
    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-reasoner');

    // 导入一份只有标注的备份（不含 config）
    await user.upload(fileInput(container), makeFile({ annotations: { '001': { labels: ['accurate'] } } }));

    expect(await screen.findByText(/备份已恢复（标注）/)).toBeInTheDocument();

    // 已保存配置未被备份修改
    expect(getConfig()).toMatchObject({ aiModel: 'deepseek-chat', concurrency: 3 });
    // 当前行为：表单草稿被同步回已保存值（即未保存的修改被丢弃）
    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-chat');
    expect(screen.getByLabelText('批量分析默认并发')).toHaveValue('3');
  });

  it('恢复失败（空备份/非法 JSON）→ 表单草稿保持不变', async () => {
    const user = userEvent.setup();
    const { props, container } = renderPanel();

    await user.selectOptions(screen.getByLabelText('模型'), 'deepseek-reasoner');
    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-reasoner');

    await user.upload(fileInput(container), makeFile('{}', 'empty.json'));
    expect(await screen.findByText('备份中没有可恢复的数据')).toBeInTheDocument();
    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-reasoner');
    expect(props.onDataRestored).not.toHaveBeenCalled();

    await user.upload(fileInput(container), makeFile('not-json', 'bad.json'));
    expect(await screen.findByText('备份文件不是有效的 JSON，恢复失败')).toBeInTheDocument();
    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-reasoner');
  });

  it('备份中的 apiKey 注入不会进入表单（本机 Key 优先）', async () => {
    const user = userEvent.setup();
    const { container } = renderPanel();
    saveAnnotations({ '001': { labels: ['accurate'] } });

    await user.upload(
      fileInput(container),
      makeFile({ annotations: {}, config: { apiKey: 'sk-injected', aiModel: 'deepseek-reasoner' } })
    );

    await waitFor(() => expect(screen.getByLabelText('模型')).toHaveValue('deepseek-reasoner'));
    expect(screen.getByLabelText('DeepSeek API Key')).toHaveValue('sk-local');
    expect(getConfig().apiKey).toBe('sk-local');
  });
});
