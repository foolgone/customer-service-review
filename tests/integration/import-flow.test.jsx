/**
 * 导入流程 集成测试（src/App.jsx + lazy ImportWizard 端到端）
 * 覆盖：打开导入向导、JSON 文件解析预览、确认导入替换列表、数据源标签、
 * 导入后按 ID 保留人工标注、恢复示例数据、非法扩展名/损坏 JSON 报错与关闭。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { createFile, createJsonFile } from '../helpers/file';
import {
  CONVERSATIONS_URL,
  USER_001,
  currentLabelBox,
  installMatchMedia,
  labelButton,
  progressCard,
  readAnnotations,
  reviewedCard,
  saveStatus,
  setupApp,
  waitForWorkbench
} from './helpers/appHarness';

const IMPORT_HISTORY_KEY = 'cs-review-import-history-v1';

const IMPORTED_CONVERSATIONS = [
  {
    id: '001',
    turns: [
      { role: 'user', content: '导入后的用户问题' },
      { role: 'assistant', content: '导入后的客服回复' }
    ]
  },
  {
    id: '101',
    turns: [
      { role: 'user', content: '第二个导入问题' },
      { role: 'assistant', content: '第二个导入回复' }
    ]
  }
];

beforeEach(() => {
  localStorage.clear();
  installMatchMedia();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** 点击「导入数据」并等待懒加载弹窗出现，返回弹窗容器 */
async function openImportWizard(user) {
  await user.click(screen.getByRole('button', { name: '导入数据' }));
  const heading = await screen.findByRole('heading', { name: '导入对话数据' }, { timeout: 10000 });
  return heading.closest('.fixed');
}

function getFileInput(dialog) {
  return dialog.querySelector('input[type="file"]');
}

/** 选择文件并等待进入「预览」步骤 */
async function uploadAndWaitPreview(user, dialog, file) {
  await user.upload(getFileInput(dialog), file);
  await within(dialog).findByText('数据预览');
}

async function confirmImport(user, dialog, count) {
  await user.click(within(dialog).getByRole('button', { name: '下一步' }));
  const confirmButton = await within(dialog).findByRole('button', { name: `确认导入 ${count} 条` });
  await user.click(confirmButton);
  await waitFor(() => {
    expect(screen.queryByRole('heading', { name: '导入对话数据' })).not.toBeInTheDocument();
  });
}

describe('导入流程', () => {
  it('点击「导入数据」→ 懒加载的导入弹窗出现并停留在「选择文件」步骤', async () => {
    // 需要 applyAccept: false（非法扩展名用例要能绕过 input accept 过滤）
    const { user } = setupApp({}, { applyAccept: false });
    await waitForWorkbench();

    expect(screen.queryByRole('heading', { name: '导入对话数据' })).not.toBeInTheDocument();

    const dialog = await openImportWizard(user);

    expect(within(dialog).getByText('选择文件')).toBeInTheDocument();
    expect(within(dialog).getByText('拖拽文件到此处，或点击选择文件')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '取消' })).toBeInTheDocument();
    expect(getFileInput(dialog)).toBeTruthy();
  });

  it('选择合法 JSON → 预览显示有效条数 → 下一步 → 确认导入 → 弹窗关闭、列表替换、数据源与进度更新', async () => {
    const { user } = setupApp({}, { applyAccept: false });
    await waitForWorkbench();
    expect(screen.getByText(/数据源：示例数据（2 条）/)).toBeInTheDocument();

    const dialog = await openImportWizard(user);
    await uploadAndWaitPreview(user, dialog, createJsonFile(IMPORTED_CONVERSATIONS, 'import-conv.json'));

    // 预览步骤：有效对话 2 条 + 预览数据
    expect(within(dialog).getByText('有效对话').parentElement).toHaveTextContent('2');
    expect(within(dialog).getByText('总行数').parentElement).toHaveTextContent('2');
    expect(within(dialog).getByText('导入后的用户问题')).toBeInTheDocument();

    await confirmImport(user, dialog, 2);

    // 列表替换 + 数据源标签 + 进度回到 1 / 2
    expect(screen.getByText('导入后的用户问题')).toBeInTheDocument();
    expect(screen.getByText(/数据源：JSON · import-conv\.json（2 条）/)).toBeInTheDocument();
    expect(progressCard()).toHaveTextContent(/1 \/ 2/);
    expect(saveStatus()).toHaveTextContent('已导入 2 条对话');
    expect(screen.getByText(/已导入 · 刷新需重新导入/)).toBeInTheDocument();

    // 导入历史写入 localStorage
    const history = JSON.parse(localStorage.getItem(IMPORT_HISTORY_KEY));
    expect(Array.isArray(history)).toBe(true);
    expect(history[0]).toMatchObject({
      fileName: 'import-conv.json',
      format: 'JSON',
      total: 2,
      valid: 2,
      invalid: 0
    });
  });

  it('导入后按对话 ID 保留原人工标注 → 新数据集包含 001 时「已标注」仍为 1 / 2', async () => {
    const { user } = setupApp({}, { applyAccept: false });
    await waitForWorkbench();

    // 先给示例数据的 001 打标签
    await user.click(labelButton('回复准确'));
    expect(reviewedCard()).toHaveTextContent(/1 \/ 2/);
    expect(within(currentLabelBox()).getByText('回复准确')).toBeInTheDocument();

    // 导入包含 001 的新数据集
    const dialog = await openImportWizard(user);
    await uploadAndWaitPreview(user, dialog, createJsonFile(IMPORTED_CONVERSATIONS, 'keep-annotation.json'));
    await confirmImport(user, dialog, 2);

    expect(screen.getByText(/数据源：JSON · keep-annotation\.json（2 条）/)).toBeInTheDocument();
    // 标注计数只统计当前数据集内 ID，001 仍在 → 1 / 2
    expect(reviewedCard()).toHaveTextContent(/1 \/ 2/);
    // 当前对话 001 的人工标注草稿被恢复
    expect(within(currentLabelBox()).getByText('回复准确')).toBeInTheDocument();
    expect(readAnnotations()['001'].labels).toEqual(['accurate']);
  });

  it('点击「恢复示例数据」→ 重新拉取示例 JSON，数据源回到「示例数据」并提示「已恢复示例数据」', async () => {
    const { user, fetchMock } = setupApp({}, { applyAccept: false });
    await waitForWorkbench();

    const dialog = await openImportWizard(user);
    await uploadAndWaitPreview(user, dialog, createJsonFile(IMPORTED_CONVERSATIONS, 'restore.json'));
    await confirmImport(user, dialog, 2);
    expect(screen.getByText(/数据源：JSON · restore\.json（2 条）/)).toBeInTheDocument();

    const conversationFetchesBefore = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes(CONVERSATIONS_URL)
    ).length;

    await user.click(screen.getByRole('button', { name: '恢复示例数据' }));

    await waitFor(() => {
      expect(saveStatus()).toHaveTextContent('已恢复示例数据');
    });
    expect(screen.getByText(/数据源：示例数据（2 条）/)).toBeInTheDocument();
    expect(screen.getByText(USER_001)).toBeInTheDocument();
    expect(progressCard()).toHaveTextContent(/1 \/ 2/);
    // 恢复后「已导入 · 刷新需重新导入」提示消失
    expect(screen.queryByText(/已导入 · 刷新需重新导入/)).not.toBeInTheDocument();

    const conversationFetchesAfter = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes(CONVERSATIONS_URL)
    ).length;
    expect(conversationFetchesAfter).toBe(conversationFetchesBefore + 1);
  });

  it('选择扩展名非法的文件 → 弹窗内展示校验错误且不导入；按 Esc 关闭弹窗', async () => {
    const { user } = setupApp({}, { applyAccept: false });
    await waitForWorkbench();

    const dialog = await openImportWizard(user);
    await user.upload(getFileInput(dialog), createFile('这不是对话数据', 'badcase.doc', 'application/msword'));

    expect(await within(dialog).findByText(/不支持的文件扩展名：\.doc/)).toBeInTheDocument();
    // 没有进入预览步骤，也没有替换数据源
    expect(within(dialog).queryByText('数据预览')).not.toBeInTheDocument();
    expect(screen.getByText(/数据源：示例数据（2 条）/)).toBeInTheDocument();
    expect(saveStatus()).toHaveTextContent('等待编辑');

    // Esc 关闭弹窗
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '导入对话数据' })).not.toBeInTheDocument();
    });
    expect(screen.getByText(/数据源：示例数据（2 条）/)).toBeInTheDocument();
  });

  it('选择损坏的 JSON → 弹窗内展示解析错误且不导入；点「取消」关闭弹窗', async () => {
    const { user } = setupApp({}, { applyAccept: false });
    await waitForWorkbench();

    const dialog = await openImportWizard(user);
    await user.upload(getFileInput(dialog), createFile('{ "id": "001", 这不是合法 JSON', 'broken.json', 'application/json'));

    expect(await within(dialog).findByText(/JSON 格式错误：/)).toBeInTheDocument();
    expect(within(dialog).queryByText('数据预览')).not.toBeInTheDocument();
    // 示例数据仍在
    expect(screen.getByText(USER_001)).toBeInTheDocument();
    expect(screen.getByText(/数据源：示例数据（2 条）/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '取消' }));
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '导入对话数据' })).not.toBeInTheDocument();
    });
  });
});
