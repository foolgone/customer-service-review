/**
 * AI 辅助：单条分析 + 批量分析（mock DeepSeek，不产生真实调用与费用）
 * 重点验证：AI 建议不覆盖人工标签、结果写入 localStorage、批量进度与失败隔离。
 */
import { test, expect } from '@playwright/test';
import { ANNOTATIONS_KEY, mockDeepSeek, readStore, seedAiConfig, waitForWorkbench } from './support.js';

test.describe('AI 辅助分析', () => {
  test('未配置 Key 时 AI / 批量按钮禁用', async ({ page }) => {
    await waitForWorkbench(page);
    await expect(page.getByRole('button', { name: 'AI 分析' })).toBeDisabled();
    await expect(page.getByRole('button', { name: '批量分析' })).toBeDisabled();
  });

  test('配置 Key 后单条分析：生成建议标签且不改人工标注', async ({ page }) => {
    await seedAiConfig(page);
    await mockDeepSeek(page);
    await waitForWorkbench(page);

    // 先有人工结论
    await page.getByRole('button', { name: /^风险回复/ }).click();
    await expect(page.getByText('已自动保存')).toBeVisible();

    await page.getByRole('button', { name: 'AI 分析' }).click();
    // 分析成功后面板会自动展开（AnalysisPanel 的 effect），折叠态摘要只是瞬时状态，
    // 因此断言稳定信号：标题变为「已得到 AI 建议」+ 建议标签区出现
    await expect(page.getByRole('heading', { name: '已得到 AI 建议' })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('建议标签')).toBeVisible();

    const annotations = await readStore(page, ANNOTATIONS_KEY);
    expect(annotations['001'].labels).toEqual(['risky']); // 人工结论保留
    expect(annotations['001'].aiLabels).toEqual(['accurate']); // AI 建议单独存放
    expect(annotations['001'].aiReason).toBeTruthy();
    expect(annotations['001'].aiAt).toBeTruthy();
  });

  test('批量分析：仅未分析范围 → 全部成功并写入 AI 字段', async ({ page }) => {
    await seedAiConfig(page);
    await mockDeepSeek(page);
    await waitForWorkbench(page);

    await page.getByRole('button', { name: '批量分析' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('分析范围')).toBeVisible();

    await dialog.getByRole('button', { name: /^开始分析 \d+ 条/ }).click();
    await expect(dialog.getByText(/分析完成：成功 15 条/)).toBeVisible({ timeout: 20_000 });

    const annotations = await readStore(page, ANNOTATIONS_KEY);
    expect(annotations['001'].aiLabels).toEqual(['accurate']);
    expect(annotations['002'].aiLabels).toEqual(['accurate']);
    // 纯 AI 建议不算人工审核
    expect(annotations['001'].labels).toEqual([]);

    await dialog.getByRole('button', { name: '关闭' }).first().click();
    await expect(dialog).toBeHidden();

    // 关闭后按钮恢复
    await expect(page.getByRole('button', { name: '批量分析' })).toBeEnabled();
  });
});
