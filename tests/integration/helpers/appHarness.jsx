/**
 * App 集成测试共享工装（非测试文件，不被 vitest include 收集）
 *
 * 说明：tests/setup.js 里的 matchMedia 用 `vi.fn().mockImplementation(...)` 定义，
 * 而 vitest.config.js 开启了 `restoreMocks: true`，每个用例开始前会把该 mock 的
 * 实现清空（返回 undefined），导致 useTheme 在挂载时崩溃。
 * 约束要求不能改 setup.js / vitest.config.js，因此这里用「普通函数」实现兜底，
 * 普通函数不会被 restoreAllMocks 清理。
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import App from '../../../src/App';

export const ANNOTATIONS_KEY = 'cs-review-annotations-v1';
export const THEME_KEY = 'cs-review-theme-v1';

// 与 public/data/conversations.json 中 001 / 002 的真实文案保持一致
export const USER_001 = '我三天前买的蓝牙耳机，今天发现左耳没声音，能退款吗？';
export const ASSISTANT_001 =
  '非常抱歉给您带来不便。根据我们的售后政策，商品签收后7天内出现质量问题可以申请退款。您的情况符合退款条件，我现在帮您发起退款申请，预计1-3个工作日到账。请问您希望退回原支付方式还是退到账户余额？';
export const USER_002 = '我的包裹显示已签收但是我没收到';
export const ASSISTANT_002 =
  '您好，这种情况一般是快递员代签了。建议您查看一下门卫处、快递柜或者邻居是否代收。如果确认没有收到，我可以帮您联系快递公司核实派送情况。请问您方便提供一下订单号吗？';

export const CONVERSATIONS = [
  {
    id: '001',
    turns: [
      { role: 'user', content: USER_001 },
      { role: 'assistant', content: ASSISTANT_001 }
    ]
  },
  {
    id: '002',
    turns: [
      { role: 'user', content: USER_002 },
      { role: 'assistant', content: ASSISTANT_002 }
    ]
  }
];

export const DEEPSEEK_SUCCESS_CONTENT = '{"labels":["accurate"],"reason":"回复准确，符合政策"}';
export const DEEPSEEK_SUCCESS_BODY = {
  choices: [{ message: { content: DEEPSEEK_SUCCESS_CONTENT } }]
};

export const CONVERSATIONS_URL = '/data/conversations.json';
export const DEEPSEEK_URL_PART = 'api.deepseek.com';

/**
 * 每个用例开始前调用：防御性地把 window.matchMedia 覆盖成「普通函数」实现。
 * 背景：vitest.config.js 开启 restoreMocks: true，若用 vi.fn().mockImplementation
 * 定义 polyfill，会在每个用例前被恢复成返回 undefined 的空函数，导致 useTheme 崩溃。
 * setup.js 现在已用普通函数兜底，这里再显式覆盖一次，保证本目录用例行为稳定
 * （默认 matches=false → 主题走 localStorage 的 'light'）。
 */
export function installMatchMedia() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      }
    })
  });
}

export function jsonResponse(data) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data)
  };
}

export function httpErrorResponse(status = 500, body = 'server error') {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => body
  };
}

/**
 * 按 URL 分发的 fetch mock：
 * - /data/conversations.json → 对话 fixture（或自定义响应/抛错）
 * - api.deepseek.com → AI 分析成功响应（或自定义响应/抛错）
 */
export function installFetch({ conversations = CONVERSATIONS, conversationResponse, deepseekResponse } = {}) {
  const fetchMock = vi.fn(async (input) => {
    const url = String(input);

    if (url.includes(CONVERSATIONS_URL)) {
      return conversationResponse ? conversationResponse() : jsonResponse(conversations);
    }

    if (url.includes(DEEPSEEK_URL_PART)) {
      return deepseekResponse ? deepseekResponse() : jsonResponse(DEEPSEEK_SUCCESS_BODY);
    }

    throw new Error(`未预期的 fetch 请求：${url}`);
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function getDeepSeekCalls(fetchMock) {
  return fetchMock.mock.calls.filter(([input]) => String(input).includes(DEEPSEEK_URL_PART));
}

/** 渲染 App：fetch mock + userEvent + render，返回操作句柄 */
export function setupApp(fetchOptions = {}, userOptions = {}) {
  const fetchMock = installFetch(fetchOptions);
  const user = userEvent.setup(userOptions);
  render(<App />);
  return { user, fetchMock };
}

/** 等待主工作台渲染完成（数据加载成功信号） */
export async function waitForWorkbench() {
  await screen.findByRole('heading', { name: '智能客服对话质检平台' });
}

// -------------------- 常用元素定位 --------------------

export function actionButton(name) {
  return screen.getByRole('button', { name });
}

export function labelButton(label) {
  return screen.getByRole('button', { name: new RegExp(label) });
}

export function scoreButton(label) {
  return screen.getByRole('button', { name: new RegExp(`^${label}`) });
}

/** 「当前标签」卡片容器 */
export function currentLabelBox() {
  return screen.getByText('当前标签').parentElement;
}

/** 顶部「已标注 N / M」卡片 */
export function reviewedCard() {
  return screen.getByText('已标注').parentElement;
}

/** 顶部「当前进度 N / M」卡片（标注后「已标注」也会出现同样的 N / M，必须限定容器） */
export function progressCard() {
  return screen.getByText('当前进度').parentElement;
}

/** 「自动保存状态：xxx」文案 */
export function saveStatus() {
  return screen.getByText(/自动保存状态/);
}

/** ScoreSelector 右上角「当前评分：N 分」 */
export function scoreStatus() {
  return screen.getByText(/当前评分：/);
}

/** 根据标题定位 AnalysisPanel 的 section */
export function analysisSection(title) {
  return screen.getByRole('heading', { name: title }).closest('section');
}

// -------------------- localStorage 读取 --------------------

export function readAnnotations() {
  const raw = localStorage.getItem(ANNOTATIONS_KEY);
  return raw ? JSON.parse(raw) : {};
}

export function readTheme() {
  const raw = localStorage.getItem(THEME_KEY);
  return raw ? JSON.parse(raw) : null;
}
