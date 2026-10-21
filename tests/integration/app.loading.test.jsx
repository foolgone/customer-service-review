/**
 * A. 数据加载 集成测试
 * 覆盖：加载中 / 加载成功 / HTTP 错误 / 空数据 / fetch 异常
 * 以及 H 组的一部分：初始「自动保存状态」。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/App';
import {
  ASSISTANT_001,
  USER_001,
  USER_002,
  httpErrorResponse,
  installFetch,
  installMatchMedia,
  progressCard,
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

describe('A. 数据加载', () => {
  it('加载成功 → 显示当前对话 001、进度 1 / 2、已标注 0 / 2 以及用户/客服消息', async () => {
    installFetch();
    render(<App />);

    // 首帧应处于加载中
    expect(screen.getByText('正在加载对话数据...')).toBeInTheDocument();

    await waitForWorkbench();

    expect(screen.getByText('001')).toBeInTheDocument();
    expect(progressCard()).toHaveTextContent(/1 \/ 2/);
    expect(screen.getByText('0 / 2')).toBeInTheDocument();
    expect(screen.getByText(USER_001)).toBeInTheDocument();
    expect(screen.getByText(ASSISTANT_001)).toBeInTheDocument();
    // 只渲染当前一条对话，不应提前渲染 002
    expect(screen.queryByText(USER_002)).not.toBeInTheDocument();
  });

  it('接口返回 HTTP 500 → 显示「读取对话数据失败：500」', async () => {
    installFetch({ conversationResponse: () => httpErrorResponse(500) });
    render(<App />);

    expect(await screen.findByText('读取对话数据失败：500')).toBeInTheDocument();
    expect(screen.queryByText('正在加载对话数据...')).not.toBeInTheDocument();
  });

  it('接口返回空数组 → 显示「暂无对话数据」', async () => {
    installFetch({ conversations: [] });
    render(<App />);

    expect(await screen.findByText('暂无对话数据')).toBeInTheDocument();
  });

  it('fetch 抛出非 Error 值（网络中断）→ 显示通用提示「读取对话数据失败」', async () => {
    installFetch({
      conversationResponse: () => {
        // 模拟某些 polyfill / 拦截器直接 throw 字符串的场景
        // eslint-disable-next-line no-throw-literal
        throw '网络中断';
      }
    });
    render(<App />);

    expect(await screen.findByText('读取对话数据失败')).toBeInTheDocument();
  });

  it('fetch 以 TypeError 拒绝（真实网络错误）→ 显示中文网络异常提示（BUG-09 已修复）', async () => {
    installFetch({
      conversationResponse: () => {
        throw new TypeError('Failed to fetch');
      }
    });
    render(<App />);

    expect(await screen.findByText('读取对话数据失败：网络异常，请检查网络连接后重试')).toBeInTheDocument();
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
  });
});

describe('H. 自动保存提示（初始态）', () => {
  it('首次加载且未编辑 → 自动保存状态显示「等待编辑」', async () => {
    setupApp();
    await waitForWorkbench();

    expect(saveStatus()).toHaveTextContent('等待编辑');
  });
});

describe('数据入口', () => {
  it('点击「导入数据」→ 懒加载打开导入向导，点击「关闭」后收起', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    expect(screen.queryByRole('heading', { name: '导入对话数据' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '导入数据' }));
    // 懒加载组件首次编译可能较慢，放宽等待时间
    expect(await screen.findByRole('heading', { name: '导入对话数据' }, { timeout: 10000 })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '关闭' }));
    expect(screen.queryByRole('heading', { name: '导入对话数据' })).not.toBeInTheDocument();
  });
});
