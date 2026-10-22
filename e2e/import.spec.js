/**
 * 导入：JSON 三步向导 → 替换列表 → 恢复示例数据
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { waitForWorkbench } from './support.js';

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'import-conversations.json');

test.describe('数据导入', () => {
  test('JSON 文件：预览统计 → 确认导入 → 列表替换', async ({ page }) => {
    await waitForWorkbench(page);

    await page.getByRole('button', { name: '导入数据' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: '导入对话数据' })).toBeVisible();

    // 隐藏的 file input 直接塞文件
    await page.locator('input[type="file"]').setInputFiles(FIXTURE);

    // 预览步骤：4 个统计卡与有效对话数
    await expect(page.getByRole('button', { name: '下一步' })).toBeVisible();
    await expect(page.getByText('有效对话')).toBeVisible();
    await expect(page.getByText('总行数')).toBeVisible();

    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByRole('button', { name: '确认导入 2 条' }).click();

    // 弹窗关闭，数据源与进度更新
    await expect(dialog).toBeHidden();
    await expect(page.getByText('数据源：JSON · import-conversations.json（2 条）')).toBeVisible();
    await expect(page.getByText('已导入 · 刷新需重新导入')).toBeVisible();
    await expect(page.getByText('当前进度').locator('..').getByText('1 / 2')).toBeVisible();
  });

  test('导入后可恢复示例数据', async ({ page }) => {
    await waitForWorkbench(page);

    await page.getByRole('button', { name: '导入数据' }).click();
    await page.locator('input[type="file"]').setInputFiles(FIXTURE);
    await page.getByRole('button', { name: '下一步' }).click();
    await page.getByRole('button', { name: '确认导入 2 条' }).click();
    await expect(page.getByText('（2 条）')).toBeVisible();

    await page.getByRole('button', { name: '恢复示例数据' }).click();
    await expect(page.getByText('数据源：示例数据（15 条）')).toBeVisible();
    await expect(page.getByText('已恢复示例数据')).toBeVisible();
  });

  test('拒绝不支持的文件类型', async ({ page }) => {
    await waitForWorkbench(page);

    await page.getByRole('button', { name: '导入数据' }).click();
    // 用 Playwright 的 buffer 方式伪装一个 .exe
    await page.locator('input[type="file"]').setInputFiles({
      name: 'malware.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('not a data file')
    });

    await expect(page.getByText(/不支持的文件扩展名/)).toBeVisible();
  });
});
