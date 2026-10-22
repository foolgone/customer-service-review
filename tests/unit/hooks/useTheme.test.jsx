/**
 * useTheme hook 单元测试
 * 覆盖：默认浅色、读取已存主题、system 跟随媒体查询、toggle/setTheme、
 *       dark class 同步、localStorage 回写（key: cs-review-theme-v1）。
 * 注意：storage 以 JSON 序列化存储，因此预置值必须是 JSON.stringify('dark')。
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { StrictMode } from 'react';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../../../src/hooks/useTheme';
import { STORAGE_KEYS } from '../../../src/lib/constants';

const THEME_KEY = STORAGE_KEYS.theme;
// setup.js 提供的 matchMedia 为稳定的普通函数 polyfill（默认 matches=false）
const originalMatchMedia = window.matchMedia;

function stubMatchMedia(matches) {
  window.matchMedia = (query) => ({ ...originalMatchMedia(query), matches });
}

// 可派发 change 事件的 matchMedia 桩，用于验证「跟随系统」实时切换（BUG-12）
function installListenableMatchMedia(initialMatches) {
  const listeners = new Set();
  const mediaQuery = {
    matches: initialMatches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener(type, handler) {
      if (type === 'change') {
        listeners.add(handler);
      }
    },
    removeEventListener(type, handler) {
      if (type === 'change') {
        listeners.delete(handler);
      }
    },
    addListener(handler) {
      listeners.add(handler);
    },
    removeListener(handler) {
      listeners.delete(handler);
    },
    dispatchEvent() {
      return false;
    }
  };

  window.matchMedia = () => mediaQuery;

  return {
    emit(matches) {
      mediaQuery.matches = matches;
      listeners.forEach((handler) => handler({ matches }));
    }
  };
}

function preloadTheme(theme) {
  localStorage.setItem(THEME_KEY, JSON.stringify(theme));
}

function rootHasDarkClass() {
  return document.documentElement.classList.contains('dark');
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('useTheme', () => {
  it('无存储时：默认 theme=light、isDark=false、不挂 dark class，并回写 light', () => {
    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('light');
    expect(result.current.isDark).toBe(false);
    expect(rootHasDarkClass()).toBe(false);
    // 挂载后 theme 从初始 system 归一为 light，localStorage 最终写入 light
    expect(localStorage.getItem(THEME_KEY)).toBe(JSON.stringify('light'));
  });

  it('已存 dark 时：挂载后 theme=dark、isDark=true 且 documentElement 挂 dark class', () => {
    preloadTheme('dark');

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(rootHasDarkClass()).toBe(true);
    expect(localStorage.getItem(THEME_KEY)).toBe(JSON.stringify('dark'));
  });

  // 回归：E2E 发现「刷新后主题丢失」——旧实现先用默认值渲染、effect 里再读存储，
  // 持久化 effect 会抢先回写默认值；StrictMode 的 effect 重跑让它稳定复现。
  it('StrictMode 下挂载不会覆盖已保存的主题（刷新丢主题回归）', () => {
    preloadTheme('dark');

    const { result } = renderHook(() => useTheme(), { wrapper: StrictMode });

    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(rootHasDarkClass()).toBe(true);
    expect(localStorage.getItem(THEME_KEY)).toBe(JSON.stringify('dark'));
  });

  it('已存 system 且系统偏好深色：isDark=true 并挂 dark class', () => {
    stubMatchMedia(true);
    preloadTheme('system');

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('system');
    expect(result.current.isDark).toBe(true);
    expect(rootHasDarkClass()).toBe(true);
  });

  it('已存 system 且系统偏好浅色：isDark=false 且不挂 dark class', () => {
    stubMatchMedia(false);
    preloadTheme('system');

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('system');
    expect(result.current.isDark).toBe(false);
    expect(rootHasDarkClass()).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBe(JSON.stringify('system'));
  });

  it('toggleTheme：dark → light（移除 class）→ 再切回 dark（重新挂 class）', () => {
    preloadTheme('dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('light');
    expect(result.current.isDark).toBe(false);
    expect(rootHasDarkClass()).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBe(JSON.stringify('light'));

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(rootHasDarkClass()).toBe(true);
    expect(localStorage.getItem(THEME_KEY)).toBe(JSON.stringify('dark'));
  });

  it('setTheme：可显式切到 dark / light 并同步 dark class 与 localStorage', () => {
    preloadTheme('light');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');

    act(() => {
      result.current.setTheme('dark');
    });

    expect(result.current.theme).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(rootHasDarkClass()).toBe(true);
    expect(localStorage.getItem(THEME_KEY)).toBe(JSON.stringify('dark'));

    act(() => {
      result.current.setTheme('light');
    });

    expect(result.current.theme).toBe('light');
    expect(result.current.isDark).toBe(false);
    expect(rootHasDarkClass()).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBe(JSON.stringify('light'));
  });

  it('每次 theme 变化都以 cs-review-theme-v1 为 key 回写 localStorage', () => {
    preloadTheme('light');
    const { result } = renderHook(() => useTheme());
    expect(localStorage.getItem(THEME_KEY)).toBe(JSON.stringify('light'));

    act(() => {
      result.current.setTheme('dark');
    });
    expect(localStorage.getItem(THEME_KEY)).toBe(JSON.stringify('dark'));

    act(() => {
      result.current.setTheme('system');
    });
    expect(localStorage.getItem(THEME_KEY)).toBe(JSON.stringify('system'));
    expect(localStorage.length).toBeGreaterThan(0);
  });

  it('存储内容非法时：降级为 light 且不崩溃', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(THEME_KEY, '{not-json');

    try {
      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('light');
      expect(result.current.isDark).toBe(false);
      expect(rootHasDarkClass()).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith('JSON 解析失败:', expect.any(SyntaxError));
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('运行环境缺少 matchMedia 时：isDark 降级为 false 且不崩溃', () => {
    delete window.matchMedia;
    preloadTheme('system');

    const { result } = renderHook(() => useTheme());

    expect(result.current.theme).toBe('system');
    expect(result.current.isDark).toBe(false);
    expect(rootHasDarkClass()).toBe(false);
  });

  it('主题为 system 时跟随系统深浅色切换（BUG-12 已修复）', () => {
    const media = installListenableMatchMedia(false);
    preloadTheme('system');

    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(false);

    act(() => {
      media.emit(true);
    });

    expect(result.current.isDark).toBe(true);
    expect(rootHasDarkClass()).toBe(true);
  });
});
