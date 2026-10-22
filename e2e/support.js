/**
 * E2E 共享工具：localStorage 键名与常用操作
 */
export const ANNOTATIONS_KEY = 'cs-review-annotations-v1';
export const CONFIG_KEY = 'cs-review-config-v1';
export const THEME_KEY = 'cs-review-theme-v1';

/** 在页面加载前写入 AI 配置（等价于用户已在设置页保存过 Key） */
export function seedAiConfig(page, overrides = {}) {
  return page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    {
      key: CONFIG_KEY,
      value: {
        aiModel: 'deepseek-chat',
        apiKey: 'sk-e2e-test',
        apiEndpoint: 'https://api.deepseek.com/chat/completions',
        temperature: 0.7,
        maxTokens: 2000,
        autoSave: true,
        concurrency: 3,
        ...overrides
      }
    }
  );
}

/** 读取 localStorage 里的 JSON 值 */
export function readStore(page, key) {
  return page.evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  }, key);
}

/** mock DeepSeek 接口 */
export function mockDeepSeek(page, body = { labels: ['accurate'], reason: '回复准确，符合政策' }) {
  return page.route('**/api.deepseek.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(body) } }] })
    })
  );
}

/** 等待主工作台渲染完成（示例数据加载成功） */
export async function waitForWorkbench(page) {
  await page.goto('/');
  await page.getByRole('heading', { name: '智能客服对话质检平台' }).waitFor();
  await page.getByRole('button', { name: '导出报告' }).waitFor();
}
