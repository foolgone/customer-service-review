/**
 * src/hooks/useDialogA11y.js 单元测试（BUG-22 回归）
 * 覆盖：初始焦点、Esc 关闭/禁用关闭、Tab 与 Shift+Tab 焦点循环、
 * 无焦点元素容错、关闭与卸载后清理监听。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { useDialogA11y } from '../../../src/hooks/useDialogA11y';

function DialogHarness({
  open = true,
  onClose = vi.fn(),
  disableClose = false,
  initialFocusRef,
  attachInitialRef = false,
  empty = false
}) {
  const containerRef = useDialogA11y({ open, onClose, disableClose, initialFocusRef });

  return (
    <div ref={containerRef} data-testid="dialog">
      {empty ? (
        <p>没有可聚焦元素</p>
      ) : (
        <>
          <button type="button">第一个</button>
          <input ref={attachInitialRef ? initialFocusRef : undefined} aria-label="中间输入" />
          <button type="button" disabled>
            禁用按钮
          </button>
          <button type="button">最后一个</button>
        </>
      )}
    </div>
  );
}

function firstButton() {
  return screen.getByRole('button', { name: '第一个' });
}

function lastButton() {
  return screen.getByRole('button', { name: '最后一个' });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useDialogA11y 初始焦点', () => {
  it('打开时焦点落到容器内第一个可聚焦元素', () => {
    render(<DialogHarness />);

    expect(document.activeElement).toBe(firstButton());
  });

  it('显式 initialFocusRef 优先于第一个可聚焦元素', () => {
    const inputRef = createRef();
    render(<DialogHarness initialFocusRef={inputRef} attachInitialRef />);

    expect(document.activeElement).toBe(screen.getByLabelText('中间输入'));
  });

  it('open=false 时不抢占焦点、不监听 Esc', () => {
    const onClose = vi.fn();
    render(<DialogHarness open={false} onClose={onClose} />);

    expect(document.activeElement).toBe(document.body);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('useDialogA11y 关闭行为', () => {
  it('按 Esc 调用 onClose 并阻止事件继续传播', () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const stopPropagation = vi.spyOn(event, 'stopPropagation');
    window.dispatchEvent(event);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(stopPropagation).toHaveBeenCalled();
  });

  it('disableClose=true 时 Esc 不关闭、也不阻止传播', () => {
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} disableClose />);

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    const stopPropagation = vi.spyOn(event, 'stopPropagation');
    window.dispatchEvent(event);

    expect(onClose).not.toHaveBeenCalled();
    expect(stopPropagation).not.toHaveBeenCalled();
  });

  it('未提供 onClose 时按 Esc 不抛错', () => {
    render(<DialogHarness onClose={undefined} />);

    expect(() => fireEvent.keyDown(window, { key: 'Escape' })).not.toThrow();
  });

  it('关闭后（open=false）Esc 不再触发关闭', () => {
    const onClose = vi.fn();
    const { rerender } = render(<DialogHarness onClose={onClose} />);

    rerender(<DialogHarness open={false} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('卸载后移除监听', () => {
    const onClose = vi.fn();
    const { unmount } = render(<DialogHarness onClose={onClose} />);

    unmount();
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('useDialogA11y 焦点循环', () => {
  it('在最后一个可聚焦元素按 Tab → 回到第一个', () => {
    render(<DialogHarness />);
    lastButton().focus();

    fireEvent.keyDown(lastButton(), { key: 'Tab' });

    expect(document.activeElement).toBe(firstButton());
  });

  it('在第一个可聚焦元素按 Shift+Tab → 跳到最后一个（禁用的按钮不参与）', () => {
    render(<DialogHarness />);
    firstButton().focus();

    fireEvent.keyDown(firstButton(), { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(lastButton());
    expect(screen.getByRole('button', { name: '禁用按钮' })).toBeDisabled();
  });

  it('在中间元素按 Tab → 不干预浏览器默认行为', () => {
    render(<DialogHarness />);
    const input = screen.getByLabelText('中间输入');
    input.focus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(input);
  });

  it('容器内没有可聚焦元素时按 Tab 不报错', () => {
    render(<DialogHarness empty />);

    expect(() => fireEvent.keyDown(window, { key: 'Tab' })).not.toThrow();
  });
});
