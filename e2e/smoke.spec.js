/**
 * 冒烟：工作台加载、页面导航、主题切换与持久化、无控制台错误
 */
import { test, expect } from '@playwright/test';
import { readStore, THEME_KEY, waitForWorkbench } from './support.js';

test.describe('应用外壳与导航', () => {
  test('工作台首屏可见（未配置 Key 时 AI 按钮禁用）', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await waitForWorkbench(page);

    await expect(page.getByText('数据源：示例数据（15 条）')).toBeVisible();
    await expect(page.getByRole('heading', { name: '质检工作台' })).toBeAttached();
    await expect(page.getByText('审核工作台')).toBeVisible();
    await expect(page.getByRole('button', { name: '导入数据' })).toBeVisible();
    await expect(page.getByRole('button', { name: '批量分析' })).toBeDisabled();
    await expect(page.getByText('已标注').first()).toBeVisible();
    // 左侧对话清单已渲染（搜索框是清单的标志）
    await expect(page.getByRole('searchbox', { name: '搜索对话' })).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test('切换到分析看板：Dashboard 与问题对话区渲染', async ({ page }) => {
    await waitForWorkbench(page);

    await page.getByRole('link', { name: '分析看板' }).click();

    await expect(page.getByRole('heading', { name: '分析看板' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '企业级审核概览' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '最近 7 天审核趋势' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '问题对话（最多 10 条）' })).toBeVisible();
    await expect(page.locator('.recharts-surface').first()).toBeVisible();

    // 返回工作台
    await page.getByRole('link', { name: '返回质检工作台' }).click();
    await expect(page.getByRole('button', { name: '导出报告' })).toBeVisible();
  });

  test('切换深色模式：html 加 class 并写入 localStorage', async ({ page }) => {
    await waitForWorkbench(page);

    await page.getByRole('button', { name: '切换深色模式' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    expect(await readStore(page, THEME_KEY)).toBe('dark');

    await page.getByRole('button', { name: '切换浅色模式' }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    expect(await readStore(page, THEME_KEY)).toBe('light');
  });

  test('刷新后主题保持（localStorage 持久化）', async ({ page }) => {
    await waitForWorkbench(page);
    await page.getByRole('button', { name: '切换深色模式' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);

    await page.reload();
    await waitForWorkbench(page);

    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('快捷键面板：? 呼出、Esc 关闭', async ({ page }) => {
    await waitForWorkbench(page);

    // Playwright 的 Shift+/ 会发出 key='/'，这里直接发送 '?'
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: '快捷键' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });
});
