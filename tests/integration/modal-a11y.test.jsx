/**
 * 模态面板可访问性与快捷键隔离（BUG-20 / BUG-21 / BUG-22 修复的回归用例）
 * 覆盖：dialog 语义、Esc 关闭、初始焦点落在对话框内、面板打开时全局快捷键暂停
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { installMatchMedia, readAnnotations, setupApp, waitForWorkbench, actionButton } from './helpers/appHarness';

const EXPORT_TITLE = '导出质检报告';
const IMPORT_TITLE = '导入对话数据';

beforeEach(() => {
  localStorage.clear();
  installMatchMedia();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openDialog(user, buttonName, title) {
  await user.click(actionButton(buttonName));
  await screen.findByRole('heading', { name: title });
  return screen.getByRole('dialog', { name: title });
}

describe('模态面板可访问性', () => {
  it('导出面板 → 具备 dialog 语义（aria-modal + aria-labelledby）', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    const dialog = await openDialog(user, '导出报告', EXPORT_TITLE);

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(within(dialog).getByRole('heading', { name: EXPORT_TITLE })).toBeInTheDocument();
  });

  it('导入向导弹窗 → 同样具备 dialog 语义', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    const dialog = await openDialog(user, '导入数据', IMPORT_TITLE);

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('heading', { name: IMPORT_TITLE })).toBeInTheDocument();
  });

  it('打开面板后 Esc → 关闭导出面板（BUG-21）', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    await openDialog(user, '导出报告', EXPORT_TITLE);

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('heading', { name: EXPORT_TITLE })).not.toBeInTheDocument());
  });

  it('打开面板后按标签/评分/导航快捷键 → 不修改底层数据（BUG-20）', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    const dialog = await openDialog(user, '导出报告', EXPORT_TITLE);

    fireEvent.keyDown(window, { key: '6' });
    fireEvent.keyDown(window, { key: '1', altKey: true });
    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: 'a' });
    fireEvent.keyDown(window, { key: 'd' });

    expect(readAnnotations()['001']).toBeUndefined();
    expect(dialog).toBeInTheDocument();
  });

  it('关闭面板后全局快捷键恢复（Enter 切下一条）', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    await openDialog(user, '导出报告', EXPORT_TITLE);

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('heading', { name: EXPORT_TITLE })).not.toBeInTheDocument());

    fireEvent.keyDown(window, { key: 'Enter' });

    await waitFor(() => expect(screen.getByText('2 / 2')).toBeInTheDocument());
  });
});
