/**
 * ErrorBoundary 兜底测试
 * 覆盖：无错误时原样渲染 children、普通渲染错误兜底 UI、chunk 加载失败识别与专属文案、
 *       点击「重新加载」走注入的 onReload / 默认的 window.location.reload、
 *       isChunkLoadError 对多种失败文案的识别。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary, { isChunkLoadError } from '../../../../src/components/common/ErrorBoundary';

function Boom({ message = '渲染炸了' }) {
  throw new Error(message);
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('无错误时原样渲染 children，不出现兜底 UI', () => {
    render(
      <ErrorBoundary>
        <p>正常内容</p>
      </ErrorBoundary>
    );

    expect(screen.getByText('正常内容')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重新加载' })).not.toBeInTheDocument();
  });

  it('子组件渲染抛错 → 展示兜底标题、错误信息与重新加载按钮', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByRole('heading', { name: '页面出现了一个错误' })).toBeInTheDocument();
    expect(screen.getByText('渲染炸了')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
  });

  it('chunk 加载失败 → 展示「页面需要重新加载」与资源更新说明', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Boom message="Failed to fetch dynamically imported module: /assets/Dashboard-abc.js" />
      </ErrorBoundary>
    );

    expect(screen.getByRole('heading', { name: '页面需要重新加载' })).toBeInTheDocument();
    expect(screen.getByText(/应用可能刚发布了新版本/)).toBeInTheDocument();
  });

  it('点击「重新加载」→ 调用注入的 onReload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    const onReload = vi.fn();

    render(
      <ErrorBoundary onReload={onReload}>
        <Boom />
      </ErrorBoundary>
    );

    await user.click(screen.getByRole('button', { name: '重新加载' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('未注入 onReload → 点击后走默认的 window.location.reload 且不抛错', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();

    // jsdom 的 Location.prototype.reload 是 non-configurable / non-writable，无法 spy；
    // 这里改为真实点击以覆盖默认分支：jsdom 只会打一条 "Not implemented" 日志，不抛错。
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    await user.click(screen.getByRole('button', { name: '重新加载' }));
    expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
  });

  describe('isChunkLoadError（不同打包器 / 浏览器的失败文案）', () => {
    it.each([
      ['Failed to fetch dynamically imported module: /assets/x.js', true],
      ['Importing a module script failed.', true],
      ['ChunkLoadError: Loading chunk 12 failed.', true],
      ['Cannot read properties of undefined (reading "labels")', false],
      ['', false]
    ])('%s → %s', (message, expected) => {
      expect(isChunkLoadError(new Error(message))).toBe(expected);
    });

    it('传入空值时不抛错', () => {
      expect(isChunkLoadError(undefined)).toBe(false);
      expect(isChunkLoadError(null)).toBe(false);
    });
  });
});
