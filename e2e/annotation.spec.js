/**
 * 标注：标签 / 评分 / 备注 / 保存 / 刷新后持久化
 */
import { test, expect } from '@playwright/test';
import { ANNOTATIONS_KEY, readStore, waitForWorkbench } from './support.js';

test.describe('质检标注', () => {
  test('打标签 + 评分 + 保存 → 写入 localStorage 并计入已标注', async ({ page }) => {
    await waitForWorkbench(page);

    await page.getByRole('button', { name: /^回复准确/ }).click();
    await expect(page.getByText('已自动保存')).toBeVisible();

    await page.getByRole('button', { name: /^5 分/ }).click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText(/已保存/)).toBeVisible();

    const annotations = await readStore(page, ANNOTATIONS_KEY);
    expect(annotations['001'].labels).toEqual(['accurate']);
    expect(annotations['001'].score).toBe(5);
    expect(annotations['001'].reviewedAt).toBeTruthy();

    // 顶部「已标注」卡片
    await expect(page.getByText('已标注').locator('..').getByText('1 / 15')).toBeVisible();
  });

  test('备注自动保存，刷新后仍能恢复', async ({ page }) => {
    await waitForWorkbench(page);

    const comment = 'E2E 备注：回复准确但缺少退款时效说明';
    await page.getByPlaceholder(/填写人工审核备注/).fill(comment);
    await expect(page.getByText('已自动保存')).toBeVisible();

    const beforeReload = await readStore(page, ANNOTATIONS_KEY);
    expect(beforeReload['001'].comment).toBe(comment);

    await page.reload();
    await waitForWorkbench(page);
    await expect(page.getByPlaceholder(/填写人工审核备注/)).toHaveValue(comment);
  });

  test('切换对话后草稿按 ID 隔离，不串行', async ({ page }) => {
    await waitForWorkbench(page);

    await page.getByRole('button', { name: /^跑题/ }).click();
    await page.getByRole('button', { name: '下一条' }).click();
    await expect(page.getByText('当前进度').locator('..').getByText('2 / 15')).toBeVisible();

    // 第二条尚未打标签
    const annotations = await readStore(page, ANNOTATIONS_KEY);
    expect(annotations['001'].labels).toEqual(['off_topic']);
    expect(annotations['002']).toBeUndefined();

    await page.getByRole('button', { name: '上一条' }).click();
    await expect(page.getByText('当前进度').locator('..').getByText('1 / 15')).toBeVisible();
  });
});
