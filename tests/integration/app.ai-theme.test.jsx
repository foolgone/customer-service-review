/**
 * F. AI 分析 + G. 主题切换 集成测试
 * 覆盖：未配置 Key 禁用、导入/清除 API Key、分析成功（建议标签/理由/持久化）、
 * 分析失败（HTTP 500）、无 Key 时 A 快捷键行为、prompt 取消/空值、D 键与主题按钮切换。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  actionButton,
  analysisSection,
  getDeepSeekCalls,
  httpErrorResponse,
  installMatchMedia,
  readAnnotations,
  readTheme,
  saveStatus,
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

/** 通过 prompt 导入 API Key */
async function importApiKey(user, key) {
  vi.spyOn(window, 'prompt').mockReturnValue(key);
  await user.click(actionButton('导入 API'));
}

describe('F. AI 分析', () => {
  it('未配置 API Key → ActionBar「AI 分析」与 AnalysisPanel「重新分析」均禁用，状态显示未配置', async () => {
    setupApp();
    await waitForWorkbench();

    expect(actionButton('AI 分析')).toBeDisabled();
    expect(actionButton('重新分析')).toBeDisabled();
    expect(screen.getByText(/当前状态：未配置/)).toBeInTheDocument();
  });

  it('点击「导入 API」并输入 Key（含首尾空格）→ 状态变「已配置」，两个 AI 分析按钮可用', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    await importApiKey(user, '  sk-test  ');

    expect(screen.getByText(/当前状态：已配置/)).toBeInTheDocument();
    expect(actionButton('AI 分析')).toBeEnabled();
    expect(actionButton('重新分析')).toBeEnabled();
    expect(saveStatus()).toHaveTextContent('DeepSeek API Key 已导入到当前会话');
  });

  it('分析成功 → 出现「已得到 AI 建议」、建议标签「回复准确」与理由，aiLabels/aiReason/aiAt 写入 localStorage', async () => {
    const { user, fetchMock } = setupApp();
    await waitForWorkbench();

    await importApiKey(user, 'sk-test');
    await user.click(actionButton('AI 分析'));

    expect(await screen.findByRole('heading', { name: '已得到 AI 建议' })).toBeInTheDocument();

    const panel = analysisSection('已得到 AI 建议');
    expect(panel).toBeTruthy();
    expect(within(panel).getByText('回复准确')).toBeInTheDocument();
    // AI 理由在「AI 理由」标签页中展示
    await user.click(within(panel).getByRole('button', { name: 'AI 理由' }));
    expect(within(panel).getByText('回复准确，符合政策')).toBeInTheDocument();

    // 请求参数正确：endpoint / Bearer token / 默认模型
    const deepSeekCalls = getDeepSeekCalls(fetchMock);
    expect(deepSeekCalls).toHaveLength(1);
    const [endpoint, options] = deepSeekCalls[0];
    expect(String(endpoint)).toContain('api.deepseek.com');
    expect(options.headers.Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(options.body).model).toBe('deepseek-chat');

    await waitFor(() => {
      const stored = readAnnotations()['001'];
      expect(stored.aiLabels).toEqual(['accurate']);
      expect(stored.aiReason).toBe('回复准确，符合政策');
      expect(stored.aiAt).toBeTruthy();
    });

    // BUG-10 修复后：AI 建议保存提示不再被同一轮自动保存覆盖
    await waitFor(() => {
      expect(saveStatus()).toHaveTextContent('AI 建议已保存');
    });
  });

  it('分析失败（DeepSeek 返回 HTTP 500）→ 显示「AI 分析失败」与错误文案', async () => {
    const { user } = setupApp({ deepseekResponse: () => httpErrorResponse(500, 'server error') });
    await waitForWorkbench();

    await importApiKey(user, 'sk-test');
    // 先展开面板，错误文案才会渲染
    await user.click(screen.getByRole('button', { name: '展开' }));
    await user.click(actionButton('重新分析'));

    expect(await screen.findByRole('heading', { name: 'AI 分析失败' })).toBeInTheDocument();
    const panel = analysisSection('AI 分析失败');
    expect(within(panel).getByText('DeepSeek 请求失败：500 server error')).toBeInTheDocument();
  });

  it('未配置 Key 时按 A → 不会发起 DeepSeek 请求，进入失败态并提示「请先配置 DeepSeek API Key」', async () => {
    const { user, fetchMock } = setupApp();
    await waitForWorkbench();

    fireEvent.keyDown(window, { key: 'a' });

    expect(await screen.findByRole('heading', { name: 'AI 分析失败' })).toBeInTheDocument();
    expect(getDeepSeekCalls(fetchMock)).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: '展开' }));
    const panel = analysisSection('AI 分析失败');
    expect(within(panel).getByText('请先配置 DeepSeek API Key')).toBeInTheDocument();
  });

  it('点击「清除」→ Key 状态回到未配置、AI 分析按钮重新禁用', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    await importApiKey(user, 'sk-test');
    expect(screen.getByText(/当前状态：已配置/)).toBeInTheDocument();

    await user.click(actionButton('清除'));

    expect(screen.getByText(/当前状态：未配置/)).toBeInTheDocument();
    expect(saveStatus()).toHaveTextContent('已清除会话内 DeepSeek API Key');
    expect(actionButton('AI 分析')).toBeDisabled();
    expect(actionButton('重新分析')).toBeDisabled();
  });

  it('「导入 API」在 prompt 取消（null）时 → 状态与提示均不变化', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    await importApiKey(user, null);

    expect(screen.getByText(/当前状态：未配置/)).toBeInTheDocument();
    expect(saveStatus()).toHaveTextContent('等待编辑');
    expect(actionButton('AI 分析')).toBeDisabled();
  });

  it('「导入 API」输入空字符串 → 清除已配置的 Key', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    await importApiKey(user, 'sk-test');
    expect(screen.getByText(/当前状态：已配置/)).toBeInTheDocument();

    await importApiKey(user, '   ');

    expect(screen.getByText(/当前状态：未配置/)).toBeInTheDocument();
    expect(saveStatus()).toHaveTextContent('已清除会话内 DeepSeek API Key');
  });
});

describe('G. 主题切换', () => {
  it('按 D 键 → documentElement 加 dark 且主题持久化为 dark；再按 D → 恢复浅色', async () => {
    setupApp();
    await waitForWorkbench();

    fireEvent.keyDown(window, { key: 'd' });

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(readTheme()).toBe('dark');
    });

    fireEvent.keyDown(window, { key: 'd' });

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(readTheme()).toBe('light');
    });
  });

  it('点击 ActionBar 主题按钮（「切换深色模式」/「切换浅色模式」）→ 同样切换主题', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    await user.click(actionButton('切换深色模式'));

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(readTheme()).toBe('dark');
    });
    expect(actionButton('切换浅色模式')).toBeInTheDocument();

    await user.click(actionButton('切换浅色模式'));

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(readTheme()).toBe('light');
    });
    expect(actionButton('切换深色模式')).toBeInTheDocument();
  });
});
