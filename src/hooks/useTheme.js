import { useEffect, useState } from 'react';
import { readStoredTheme, writeStoredTheme } from '../lib/storage';

function getSystemPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function useTheme() {
  const [theme, setTheme] = useState('system');

  useEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && getSystemPrefersDark());
    root.classList.toggle('dark', isDark);
    writeStoredTheme(theme);
  }, [theme]);

  return {
    theme,
    isDark: theme === 'dark' || (theme === 'system' && getSystemPrefersDark()),
    setTheme,
    toggleTheme: () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  };
}
