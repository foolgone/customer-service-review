/**
 * FileUploader 组件单元测试
 * 覆盖：引导文案与隐藏 input accept、通过 input 选择文件、拖拽选择与高亮/恢复、
 *       空文件列表不触发回调、禁用态、错误文案、键盘 Enter/空格打开选择器。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUploader from '../../../../src/components/import/FileUploader';
import { createFile, JSON_MIME } from '../../../helpers/file';

const ACCEPT = '.json,.csv,.xlsx,.xls';

function renderUploader(overrides = {}) {
  const props = {
    file: null,
    error: '',
    disabled: false,
    onSelectFile: vi.fn(),
    ...overrides
  };
  const view = render(<FileUploader {...props} />);

  return {
    ...props,
    ...view,
    region: () => screen.getByRole('button'),
    input: () => view.container.querySelector('input[type="file"]')
  };
}

describe('FileUploader', () => {
  it('渲染拖拽引导文案、格式提示与隐藏 input 的 accept 属性', () => {
    const view = renderUploader();

    expect(screen.getByText('拖拽文件到此处，或点击选择文件')).toBeInTheDocument();
    expect(screen.getByText(/支持 \.json \.csv \.xlsx \.xls/)).toBeInTheDocument();

    const input = view.input();
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAttribute('accept', ACCEPT);
    expect(input).toHaveClass('hidden');
    expect(input).toBeEnabled();
  });

  it('通过 input 选择文件 → onSelectFile 收到 File，选择后展示「✓ 文件名」与格式化大小', async () => {
    const file = createFile('a'.repeat(2048), 'conversations.json', JSON_MIME);
    const view = renderUploader();
    const user = userEvent.setup();

    await user.upload(view.input(), file);

    expect(view.onSelectFile).toHaveBeenCalledTimes(1);
    expect(view.onSelectFile.mock.calls[0][0]).toBe(file);

    // 组件受控于 file prop：模拟父组件回填后展示已选文件信息
    view.rerender(<FileUploader file={file} onSelectFile={view.onSelectFile} />);
    expect(screen.getByText('✓ conversations.json')).toBeInTheDocument();
    expect(screen.getByText('2.00 KB')).toBeInTheDocument();
  });

  it('拖拽文件到区域 → onSelectFile 收到 File，且拖拽高亮被清除', () => {
    const file = createFile('{"a":1}', 'dragged.json', JSON_MIME);
    const view = renderUploader();
    const region = view.region();

    fireEvent.dragOver(region);
    expect(region).toHaveClass('border-blue-400');

    fireEvent.drop(region, { dataTransfer: { files: [file] } });

    expect(view.onSelectFile).toHaveBeenCalledTimes(1);
    expect(view.onSelectFile.mock.calls[0][0]).toBe(file);
    expect(region).not.toHaveClass('border-blue-400');
  });

  it('dragOver 进入高亮样式，dragLeave 后恢复默认样式', () => {
    const view = renderUploader();
    const region = view.region();

    expect(region).not.toHaveClass('border-blue-400');

    fireEvent.dragOver(region);
    expect(region).toHaveClass('border-blue-400');

    fireEvent.dragLeave(region);
    expect(region).not.toHaveClass('border-blue-400');
  });

  it('input change 或 drop 的文件列表为空 → 不触发 onSelectFile', () => {
    const view = renderUploader();

    fireEvent.change(view.input(), { target: { files: [] } });
    fireEvent.drop(view.region(), { dataTransfer: { files: [] } });

    expect(view.onSelectFile).not.toHaveBeenCalled();
  });

  it('disabled=true → input 禁用、区域点击不会打开选择器', async () => {
    const view = renderUploader({ disabled: true });
    const user = userEvent.setup();
    const input = view.input();
    const clicks = vi.fn();
    input.addEventListener('click', clicks);

    expect(input).toBeDisabled();
    expect(view.region()).toHaveClass('cursor-not-allowed');

    await user.click(view.region());

    expect(clicks).not.toHaveBeenCalled();
    expect(view.onSelectFile).not.toHaveBeenCalled();
  });

  it('error 有值 → 在区域下方展示错误文案；无 error 时不渲染', () => {
    const view = renderUploader({ error: '不支持的文件扩展名：.pdf' });

    expect(screen.getByText('不支持的文件扩展名：.pdf')).toBeInTheDocument();

    view.rerender(<FileUploader error="" onSelectFile={view.onSelectFile} />);
    expect(screen.queryByText('不支持的文件扩展名：.pdf')).not.toBeInTheDocument();
  });

  it('键盘 Enter / 空格 → 打开文件选择器；其他按键不触发', () => {
    const view = renderUploader();
    const input = view.input();
    const clicks = vi.fn();
    input.addEventListener('click', clicks);
    const region = view.region();

    fireEvent.keyDown(region, { key: 'Enter' });
    expect(clicks).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(region, { key: ' ' });
    expect(clicks).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(region, { key: 'a' });
    expect(clicks).toHaveBeenCalledTimes(2);
  });
});
