/**
 * useKeyboardShortcuts 的 enabled 开关（BUG-20 修复的回归用例）
 * 覆盖：禁用时不触发任何回调、不阻止默认行为；重新启用后恢复
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from '../../../src/hooks/useKeyboardShortcuts.js';

function createCallbacks() {
  return {
    onNext: vi.fn(),
    onSave: vi.fn(),
    onAnalyze: vi.fn(),
    onToggleTheme: vi.fn(),
    onToggleLabelShortcut: vi.fn(),
    onSetScoreShortcut: vi.fn()
  };
}

function dispatchKey(key, modifiers = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers });
  window.dispatchEvent(event);
  return event;
}

describe('useKeyboardShortcuts enabled 开关', () => {
  it('enabled=false → 所有快捷键都不触发回调，也不阻止默认行为', () => {
    const callbacks = createCallbacks();
    renderHook(() => useKeyboardShortcuts({ ...callbacks, enabled: false }));

    const events = [
      dispatchKey('Enter'),
      dispatchKey('s', { ctrlKey: true }),
      dispatchKey('a'),
      dispatchKey('d'),
      dispatchKey('3'),
      dispatchKey('1', { altKey: true })
    ];

    events.forEach((event) => expect(event.defaultPrevented).toBe(false));
    Object.values(callbacks).forEach((callback) => expect(callback).not.toHaveBeenCalled());
  });

  it('enabled 从 false 切到 true → 恢复响应', () => {
    const callbacks = createCallbacks();
    const { rerender } = renderHook(({ enabled }) => useKeyboardShortcuts({ ...callbacks, enabled }), {
      initialProps: { enabled: false }
    });

    dispatchKey('Enter');
    expect(callbacks.onNext).not.toHaveBeenCalled();

    rerender({ enabled: true });
    const event = dispatchKey('Enter');

    expect(event.defaultPrevented).toBe(true);
    expect(callbacks.onNext).toHaveBeenCalledTimes(1);
  });
});
