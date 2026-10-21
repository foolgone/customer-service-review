import { useEffect } from 'react';

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || ['input', 'textarea', 'select'].includes(tagName);
}

export function useKeyboardShortcuts({
  onNext,
  onSave,
  onAnalyze,
  onToggleTheme,
  onToggleLabelShortcut,
  onSetScoreShortcut
}) {
  useEffect(() => {
    function handleKeyDown(event) {
      const key = event.key.toLowerCase();
      const editable = isEditableTarget(event.target);

      if ((event.ctrlKey || event.metaKey) && key === 's') {
        event.preventDefault();
        onSave?.();
        return;
      }

      // 其余 Ctrl/Cmd 组合键（Ctrl+A 全选、Ctrl+D 收藏、Ctrl+1~6 切标签页等）交还给浏览器，
      // 避免误触发 AI 分析、主题切换、标签选择等业务动作
      if (event.ctrlKey || event.metaKey) {
        return;
      }

      if (editable) {
        return;
      }

      if (event.altKey && /^[1-5]$/.test(key)) {
        event.preventDefault();
        onSetScoreShortcut?.(Number(key));
        return;
      }

      if (key === 'enter') {
        event.preventDefault();
        onNext?.();
        return;
      }

      if (key === 'a') {
        event.preventDefault();
        onAnalyze?.();
        return;
      }

      if (key === 'd') {
        event.preventDefault();
        onToggleTheme?.();
        return;
      }

      if (/^[1-6]$/.test(key)) {
        event.preventDefault();
        onToggleLabelShortcut?.(key);
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onAnalyze, onNext, onSave, onSetScoreShortcut, onToggleLabelShortcut, onToggleTheme]);
}