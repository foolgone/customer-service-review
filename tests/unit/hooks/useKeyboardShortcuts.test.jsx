/**
 * useKeyboardShortcuts hook 单元测试
 * 覆盖：Enter/A/D/数字标签/Alt+数字评分/Ctrl+S/Meta+S、可编辑元素忽略、
 *       回调缺省、unmount 清理、回调更新后使用最新引用。
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import { useKeyboardShortcuts } from '../../../src/hooks/useKeyboardShortcuts';

/**
 * 构造并派发 keydown 事件
 * @param {string} key event.key
 * @param {Object} options 额外修饰键（ctrlKey/metaKey/altKey 等）
 * @param {EventTarget} target 派发目标，默认 window
 * @returns {KeyboardEvent}
 */
function dispatchKey(key, options = {}, target = window) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options
  });
  target.dispatchEvent(event);
  return event;
}

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

describe('useKeyboardShortcuts', () => {
  it('Enter → 触发 onNext 并 preventDefault', () => {
    const callbacks = createCallbacks();
    renderHook(() => useKeyboardShortcuts(callbacks));

    const event = dispatchKey('Enter');

    expect(callbacks.onNext).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    expect(callbacks.onSave).not.toHaveBeenCalled();
  });

  it('A → 触发 onAnalyze；D → 触发 onToggleTheme', () => {
    const callbacks = createCallbacks();
    renderHook(() => useKeyboardShortcuts(callbacks));

    dispatchKey('a');
    expect(callbacks.onAnalyze).toHaveBeenCalledTimes(1);

    dispatchKey('d');
    expect(callbacks.onToggleTheme).toHaveBeenCalledTimes(1);

    // 大小写等价
    dispatchKey('A');
    expect(callbacks.onAnalyze).toHaveBeenCalledTimes(2);
  });

  it('数字 1-6 → 以字符串形式触发 onToggleLabelShortcut', () => {
    const callbacks = createCallbacks();
    renderHook(() => useKeyboardShortcuts(callbacks));

    ['1', '2', '3', '4', '5', '6'].forEach((key) => dispatchKey(key));

    expect(callbacks.onToggleLabelShortcut.mock.calls.map(([value]) => value)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6'
    ]);
    expect(callbacks.onToggleLabelShortcut).toHaveBeenNthCalledWith(3, '3');
  });

  it('Alt+1~5 → 以数字形式触发 onSetScoreShortcut 并 preventDefault', () => {
    const callbacks = createCallbacks();
    renderHook(() => useKeyboardShortcuts(callbacks));

    ['1', '2', '3', '4', '5'].forEach((key) => {
      const event = dispatchKey(key, { altKey: true });
      expect(event.defaultPrevented).toBe(true);
    });

    expect(callbacks.onSetScoreShortcut.mock.calls.map(([value]) => value)).toEqual([1, 2, 3, 4, 5]);
    expect(callbacks.onSetScoreShortcut).toHaveBeenNthCalledWith(3, 3);
  });

  it('Ctrl+S 与 Meta+S → 触发 onSave 并阻止浏览器默认行为', () => {
    const callbacks = createCallbacks();
    renderHook(() => useKeyboardShortcuts(callbacks));

    const ctrlSave = dispatchKey('s', { ctrlKey: true });
    expect(ctrlSave.defaultPrevented).toBe(true);
    expect(callbacks.onSave).toHaveBeenCalledTimes(1);

    const metaSave = dispatchKey('S', { metaKey: true });
    expect(metaSave.defaultPrevented).toBe(true);
    expect(callbacks.onSave).toHaveBeenCalledTimes(2);
  });

  it('焦点在 input/textarea/select/contentEditable 时：普通快捷键不触发，Ctrl+S 仍生效', () => {
    const callbacks = createCallbacks();
    renderHook(() => useKeyboardShortcuts(callbacks));

    render(
      <div>
        <input aria-label="文本输入" />
        <textarea aria-label="多行输入" />
        <select aria-label="下拉选择">
          <option value="1">1</option>
        </select>
        <div aria-label="富文本框" data-testid="contenteditable" contentEditable="true" />
      </div>
    );

    const editableElements = [
      screen.getByRole('textbox', { name: '文本输入' }),
      screen.getByRole('textbox', { name: '多行输入' }),
      screen.getByRole('combobox', { name: '下拉选择' }),
      screen.getByTestId('contenteditable')
    ];

    // jsdom 不实现 isContentEditable，这里注入浏览器中的真实形态
    Object.defineProperty(editableElements[3], 'isContentEditable', {
      configurable: true,
      value: true
    });

    editableElements.forEach((element) => {
      dispatchKey('Enter', {}, element);
      dispatchKey('a', {}, element);
      dispatchKey('1', {}, element);
      dispatchKey('3', { altKey: true }, element);
    });

    expect(callbacks.onNext).not.toHaveBeenCalled();
    expect(callbacks.onAnalyze).not.toHaveBeenCalled();
    expect(callbacks.onToggleLabelShortcut).not.toHaveBeenCalled();
    expect(callbacks.onSetScoreShortcut).not.toHaveBeenCalled();

    editableElements.forEach((element, index) => {
      const event = dispatchKey('s', { ctrlKey: true }, element);
      expect(event.defaultPrevented).toBe(true);
      expect(callbacks.onSave).toHaveBeenCalledTimes(index + 1);
    });
  });

  it('回调未提供（undefined）时按快捷键不报错', () => {
    renderHook(() => useKeyboardShortcuts({}));

    expect(() => {
      ['Enter', 'a', 'd', '1', '6'].forEach((key) => dispatchKey(key));
      ['1', '2', '3', '4', '5'].forEach((key) => dispatchKey(key, { altKey: true }));
      dispatchKey('s', { ctrlKey: true });
      dispatchKey('s', { metaKey: true });
    }).not.toThrow();
  });

  it('unmount 后 keydown 不再触发任何回调', () => {
    const callbacks = createCallbacks();
    const { unmount } = renderHook(() => useKeyboardShortcuts(callbacks));

    unmount();
    dispatchKey('Enter');
    dispatchKey('a');
    dispatchKey('d');
    dispatchKey('1');
    dispatchKey('s', { ctrlKey: true });

    expect(callbacks.onNext).not.toHaveBeenCalled();
    expect(callbacks.onAnalyze).not.toHaveBeenCalled();
    expect(callbacks.onToggleTheme).not.toHaveBeenCalled();
    expect(callbacks.onToggleLabelShortcut).not.toHaveBeenCalled();
    expect(callbacks.onSave).not.toHaveBeenCalled();
  });

  it('回调更新后：使用最新一轮回调，不再调用旧回调', () => {
    const first = createCallbacks();
    const second = createCallbacks();

    const { rerender } = renderHook(({ callbacks }) => useKeyboardShortcuts(callbacks), {
      initialProps: { callbacks: first }
    });

    rerender({ callbacks: second });
    dispatchKey('Enter');

    expect(first.onNext).not.toHaveBeenCalled();
    expect(second.onNext).toHaveBeenCalledTimes(1);
  });

  it('未绑定的按键不触发任何回调，也不阻止默认行为', () => {
    const callbacks = createCallbacks();
    renderHook(() => useKeyboardShortcuts(callbacks));

    const event = dispatchKey('x');

    expect(event.defaultPrevented).toBe(false);
    Object.values(callbacks).forEach((callback) => {
      expect(callback).not.toHaveBeenCalled();
    });
  });

  // BUG-02 修复后：Ctrl/Cmd 组合键（Ctrl+S 之外）交还浏览器，不再误触发业务动作
  it('Ctrl+A 不再触发 onAnalyze，也不阻止浏览器全选（BUG-02 已修复）', () => {
    const callbacks = createCallbacks();
    renderHook(() => useKeyboardShortcuts(callbacks));

    const event = dispatchKey('a', { ctrlKey: true });

    expect(event.defaultPrevented).toBe(false);
    expect(callbacks.onAnalyze).not.toHaveBeenCalled();
  });

  it('Ctrl+D / Ctrl+2 等组合键同样不再触发主题切换与标签快捷键', () => {
    const callbacks = createCallbacks();
    renderHook(() => useKeyboardShortcuts(callbacks));

    const themeEvent = dispatchKey('d', { ctrlKey: true });
    const labelEvent = dispatchKey('2', { metaKey: true });

    expect(themeEvent.defaultPrevented).toBe(false);
    expect(labelEvent.defaultPrevented).toBe(false);
    expect(callbacks.onToggleTheme).not.toHaveBeenCalled();
    expect(callbacks.onToggleLabelShortcut).not.toHaveBeenCalled();
  });
});
