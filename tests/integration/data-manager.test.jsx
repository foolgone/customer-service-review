import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  actionButton,
  currentLabelBox,
  installMatchMedia,
  labelButton,
  progressCard,
  readAnnotations,
  saveStatus,
  setupApp,
  waitForWorkbench
} from './helpers/appHarness';

const HEADING = { name: '数据管理' };

beforeEach(() => {
  localStorage.clear();
  installMatchMedia();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function openDataManager(user) {
  await user.click(actionButton('数据管理'));
  await screen.findByRole('heading', HEADING, { timeout: 5000 });
  return screen.getByRole('dialog', HEADING);
}

describe('数据管理页', () => {
  it('点击「数据管理」→ 打开 dialog，展示概览统计与全部对话', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    const dialog = await openDataManager(user);

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('总对话')).toBeInTheDocument();
    expect(within(dialog).getByText('命中 2 / 2 条')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '查看 #001' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '查看 #002' })).toBeInTheDocument();
  });

  it('搜索后点击「查看 #002」→ 关闭面板并跳转到第 2 条对话', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    const dialog = await openDataManager(user);

    // 用 002 独有的「快递柜」搜索（001 的客服回复里没有）
    await user.type(within(dialog).getByLabelText('搜索对话'), '快递柜');
    expect(within(dialog).getByText('命中 1 / 2 条')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: '查看 #001' })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '查看 #002' }));

    await waitFor(() => expect(screen.queryByRole('heading', HEADING)).not.toBeInTheDocument());
    expect(progressCard()).toHaveTextContent(/2 \/ 2/);
  });

  it('面板打开时按标签快捷键 → 不修改底层标注（快捷键隔离）', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    await openDataManager(user);

    fireEvent.keyDown(window, { key: '6' });
    fireEvent.keyDown(window, { key: '1', altKey: true });

    expect(readAnnotations()['001']).toBeUndefined();
    expect(screen.getByRole('dialog', HEADING)).toBeInTheDocument();
  });

  it('导出筛选结果 → 提示已导出条数', async () => {
    const created = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      created.push('blob:filtered');
      return 'blob:filtered';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const { user } = setupApp();
    await waitForWorkbench();
    const dialog = await openDataManager(user);

    await user.type(within(dialog).getByLabelText('搜索对话'), '快递柜');
    await user.click(within(dialog).getByRole('button', { name: '导出筛选结果 CSV' }));

    await waitFor(() => expect(saveStatus()).toHaveTextContent('已导出筛选结果 1 条'));
    expect(created.length).toBeGreaterThan(0);
  });

  it('面板关闭后工作台可继续操作（标注生效）', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    await openDataManager(user);

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('heading', HEADING)).not.toBeInTheDocument());

    await user.click(labelButton('回复准确'));
    expect(currentLabelBox()).toHaveTextContent('回复准确');
  });
});
