import { useEffect, useState } from 'react';
import { getTheme, writeStoredTheme } from '../lib/storage';

/**
 * 初始主题：优先读已保存的值（缺省 light，非法值由 safeJsonParse 降级并告警）。
 * 不能用「先渲染 'system' 再在 effect 里 setTheme(已存储值)」的写法：
 * 持久化 effect 会先以默认值回写 localStorage，把用户已保存的主题覆盖掉
 * （StrictMode 的 effect 重跑会让它稳定复现，表现为「刷新后主题丢失」）。
 */
export function readInitialTheme() {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return getTheme();
}

function getSystemPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useTheme() {
  const [theme, setTheme] = useState(readInitialTheme);
  const [systemPrefersDark, setSystemPrefersDark] = useState(getSystemPrefersDark);

  // 主题为 system 时跟随操作系统深浅色变化（BUG-12）
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event) => setSystemPrefersDark(event.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else if (mediaQuery.removeListener) {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    writeStoredTheme(theme);
  }, [isDark, theme]);

  return {
    theme,
    isDark,
    setTheme,
    toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
  };
}
