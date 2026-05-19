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