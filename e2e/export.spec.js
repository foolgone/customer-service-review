/**
 * 导出：CSV 明细 / Excel 报告 / PDF 报告（真实触发浏览器下载）
 */
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { waitForWorkbench } from './support.js';

test.describe('导出', () => {
  test('导出 CSV：文件名与表头正确', async ({ page }) => {
    await waitForWorkbench(page);
    await page.getByRole('button', { name: /^回复准确/ }).click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: '导出 CSV' }).click()
    ]);

    expect(download.suggestedFilename()).toMatch(/^customer-service-review-\d{4}-\d{2}-\d{2}\.csv$/);

    const filePath = await download.path();
    const content = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const [header, firstRow] = content.trim().split(/\r?\n/);

    expect(header).toContain('id');
    expect(header).toContain('user');
    expect(header).toContain('assistant');
    expect(firstRow).toContain('001');
    expect(content).toContain('accurate');
  });

  test('导出报告 → Excel（三个 Sheet 的入口）', async ({ page }) => {
    await waitForWorkbench(page);

    await page.getByRole('button', { name: '导出报告' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: '导出质检报告' })).toBeVisible();
    await expect(dialog.getByText('智能客服对话质检报告')).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('button', { name: '导出 Excel' }).click()
    ]);

    expect(download.suggestedFilename()).toMatch(/^质检报告-\d{4}-\d{2}-\d{2}\.xlsx$/);
    await expect(dialog.getByText(/Excel 已导出/)).toBeVisible();
  });

  test('导出报告 → PDF：生成并下载', async ({ page }) => {
    test.setTimeout(90_000);
    await waitForWorkbench(page);

    await page.getByRole('button', { name: '导出报告' }).click();
    const dialog = page.getByRole('dialog');

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60_000 }),
      dialog.getByRole('button', { name: '导出 PDF' }).click()
    ]);

    expect(download.suggestedFilename()).toMatch(/^质检报告-\d{4}-\d{2}-\d{2}\.pdf$/);
    await expect(dialog.getByText('PDF 已导出')).toBeVisible();
  });
});
