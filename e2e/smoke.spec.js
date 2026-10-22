/**
 * 冒烟：首页加载、示例数据、Dashboard、主题切换、无控制台错误
 */
import { test, expect } from '@playwright/test';
import { readStore, THEME_KEY, waitForWorkbench } from './support.js';

test.describe('首页与数据加载', () => {
  test('加载示例数据并渲染工作台与 Dashboard', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await waitForWorkbench(page);

    await expect(page.getByText('数据源：示例数据（15 条）')).toBeVisible();
    await expect(page.getByRole('heading', { name: '企业级审核概览' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '最近 7 天审核趋势' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '当前审核员状态' })).toBeVisible();
    await expect(page.getByRole('button', { name: '导入数据' })).toBeVisible();
    await expect(page.getByRole('button', { name: '批量分析' })).toBeDisabled();
    await expect(page.getByText('当前进度')).toBeVisible();

    // recharts 图表已实际渲染出 svg
    await expect(page.locator('.recharts-surface').first()).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test('切换深色模式：html 加 class 并写入 localStorage', async ({ page }) => {
    await waitForWorkbench(page);

    await page.getByRole('button', { name: '切换深色模式' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    const theme = await readStore(page, THEME_KEY);
    expect(theme).toBe('dark');

    await page.getByRole('button', { name: '切换浅色模式' }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    expect(await readStore(page, THEME_KEY)).toBe('light');
  });

  test('刷新后主题与标注保持（localStorage 持久化）', async ({ page }) => {
    await waitForWorkbench(page);
    await page.getByRole('button', { name: '切换深色模式' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.reload();
    await waitForWorkbench(page);

    await expect(page.locator('html')).toHaveClass(/dark/);
  });
});
