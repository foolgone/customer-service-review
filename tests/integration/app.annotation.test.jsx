/**
 * B. 人工标注与持久化 + C. 导航 + H. 自动保存提示
 * 覆盖：标签点击/取消、数字键切换标签、评分按钮与 Alt 快捷键、
 * 备注自动保存到 localStorage、切换对话后草稿恢复、上一条/下一条边界、Enter 下一条。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  ANNOTATIONS_KEY,
  actionButton,
  currentLabelBox,
  installMatchMedia,
  labelButton,
  progressCard,
  readAnnotations,
  reviewedCard,
  saveStatus,
  scoreButton,
  scoreStatus,
  setupApp,
  waitForWorkbench
} from './helpers/appHarness';

beforeEach(() => {
  localStorage.clear();
  installMatchMedia();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('B. 人工标注与持久化', () => {
  it('点击标签「回复准确」→ 当前标签区出现该标签，并写入 localStorage（含 startedAt/updatedAt）', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    expect(within(currentLabelBox()).getByText('尚未选择标签')).toBeInTheDocument();

    await user.click(labelButton('回复准确'));

    expect(within(currentLabelBox()).getByText('回复准确')).toBeInTheDocument();
    // 「已标注」计数同步更新为 1 / 2
    expect(reviewedCard()).toHaveTextContent(/1 \/ 2/);

    await waitFor(() => {
      const stored = readAnnotations();
      expect(stored['001']).toBeTruthy();
      expect(stored['001'].labels).toEqual(['accurate']);
      expect(stored['001'].startedAt).toBeTruthy();
      expect(stored['001'].updatedAt).toBeTruthy();
    });
  });

  it('再次点击已选标签 → 取消选择并提示「尚未选择标签」，localStorage 同步为空', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    await user.click(labelButton('回复准确'));
    expect(within(currentLabelBox()).getByText('回复准确')).toBeInTheDocument();

    await user.click(labelButton('回复准确'));
    expect(within(currentLabelBox()).getByText('尚未选择标签')).toBeInTheDocument();

    await waitFor(() => {
      expect(readAnnotations()['001'].labels).toEqual([]);
    });
  });

  it('键盘按 1 → 选中「回复准确」；再按 1 → 取消选中', async () => {
    setupApp();
    await waitForWorkbench();

    fireEvent.keyDown(window, { key: '1' });
    await waitFor(() => {
      expect(within(currentLabelBox()).getByText('回复准确')).toBeInTheDocument();
    });

    fireEvent.keyDown(window, { key: '1' });
    await waitFor(() => {
      expect(within(currentLabelBox()).getByText('尚未选择标签')).toBeInTheDocument();
    });
  });

  it('点击评分「1 分」→ 当前评分显示 1 分，annotation.score 持久化为 1', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    expect(scoreStatus()).toHaveTextContent('当前评分：3 分');

    await user.click(scoreButton('1 分'));

    expect(scoreStatus()).toHaveTextContent('当前评分：1 分');
    await waitFor(() => {
      expect(readAnnotations()['001'].score).toBe(1);
    });
  });

  it('快捷键 Alt+2 → 按界面提示映射为 4 分，annotation.score 持久化为 4', async () => {
    setupApp();
    await waitForWorkbench();

    fireEvent.keyDown(window, { key: '2', altKey: true });

    await waitFor(() => {
      expect(scoreStatus()).toHaveTextContent('当前评分：4 分');
      expect(readAnnotations()['001'].score).toBe(4);
    });
  });

  it('快捷键 Alt+1 → 按界面提示映射为 5 分（BUG-01 已修复）', async () => {
    setupApp();
    await waitForWorkbench();

    fireEvent.keyDown(window, { key: '1', altKey: true });

    await waitFor(() => {
      expect(scoreStatus()).toHaveTextContent('当前评分：5 分');
      expect(readAnnotations()['001'].score).toBe(5);
    });
  });

  it('快捷键 Alt+5 → 按界面提示映射为 1 分（严重风险）', async () => {
    setupApp();
    await waitForWorkbench();

    fireEvent.keyDown(window, { key: '5', altKey: true });

    await waitFor(() => {
      expect(scoreStatus()).toHaveTextContent('当前评分：1 分');
      expect(readAnnotations()['001'].score).toBe(1);
    });
  });

  it('备注输入 → annotation.comment 自动保存，并显示「已自动保存」', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    const textarea = screen.getByPlaceholderText(/填写人工审核备注/);
    await user.type(textarea, '缺少退款时效说明');

    expect(textarea).toHaveValue('缺少退款时效说明');
    await waitFor(() => {
      expect(readAnnotations()['001'].comment).toBe('缺少退款时效说明');
    });
    expect(saveStatus()).toHaveTextContent(/已自动保存 ·/);
  });

  it('切换对话后草稿恢复 → 002 标注后切到 001 再切回 002，仍显示之前的标签与评分', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    // 001 → 002
    await user.click(actionButton('下一条'));
    expect(progressCard()).toHaveTextContent(/2 \/ 2/);
    expect(within(currentLabelBox()).getByText('尚未选择标签')).toBeInTheDocument();

    await user.click(labelButton('跑题'));
    await user.click(scoreButton('2 分'));
    expect(within(currentLabelBox()).getByText('跑题')).toBeInTheDocument();
    expect(scoreStatus()).toHaveTextContent('当前评分：2 分');

    // 切回 001：显示 001 自己的（空）草稿
    await user.click(actionButton('上一条'));
    expect(progressCard()).toHaveTextContent(/1 \/ 2/);
    expect(within(currentLabelBox()).getByText('尚未选择标签')).toBeInTheDocument();
    expect(scoreStatus()).toHaveTextContent('当前评分：3 分');

    // 再切回 002：草稿恢复
    await user.click(actionButton('下一条'));
    expect(progressCard()).toHaveTextContent(/2 \/ 2/);
    expect(within(currentLabelBox()).getByText('跑题')).toBeInTheDocument();
    expect(scoreStatus()).toHaveTextContent('当前评分：2 分');

    await waitFor(() => {
      const stored = readAnnotations();
      expect(stored['002'].labels).toEqual(['off_topic']);
      expect(stored['002'].score).toBe(2);
    });
  });
});

describe('C. 导航', () => {
  it('初始边界 → 上一条禁用、下一条可用；点击下一条进入 2 / 2 并反转按钮状态；上一条返回 1 / 2', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    expect(actionButton('上一条')).toBeDisabled();
    expect(actionButton('下一条')).toBeEnabled();

    await user.click(actionButton('下一条'));
    expect(progressCard()).toHaveTextContent(/2 \/ 2/);
    expect(actionButton('下一条')).toBeDisabled();
    expect(actionButton('上一条')).toBeEnabled();

    await user.click(actionButton('上一条'));
    expect(progressCard()).toHaveTextContent(/1 \/ 2/);
    expect(actionButton('上一条')).toBeDisabled();
    expect(actionButton('下一条')).toBeEnabled();
  });

  it('在窗口上按 Enter → 进入下一条（进度 2 / 2）', async () => {
    setupApp();
    await waitForWorkbench();

    fireEvent.keyDown(window, { key: 'Enter' });

    await waitFor(() => {
      expect(progressCard()).toHaveTextContent(/2 \/ 2/);
    });
    expect(actionButton('下一条')).toBeDisabled();
  });
});

describe('H. 自动保存提示（编辑后）', () => {
  it('初次编辑标签后 → 状态从「等待编辑」变为「已自动保存 · ...」', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    expect(saveStatus()).toHaveTextContent('等待编辑');

    await user.click(labelButton('回复准确'));

    expect(saveStatus()).toHaveTextContent(/已自动保存 ·/);
    expect(saveStatus()).not.toHaveTextContent('等待编辑');
  });

  it('localStorage 以对话 ID 为键累积保存多条标注（cs-review-annotations-v1）', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    await user.click(labelButton('回复准确'));
    await user.click(actionButton('下一条'));
    await user.click(labelButton('风险回复'));

    await waitFor(() => {
      const raw = localStorage.getItem(ANNOTATIONS_KEY);
      expect(raw).toBeTruthy();
      const stored = JSON.parse(raw);
      expect(Object.keys(stored).sort()).toEqual(['001', '002']);
      expect(stored['001'].labels).toEqual(['accurate']);
      expect(stored['002'].labels).toEqual(['risky']);
    });
  });
});
