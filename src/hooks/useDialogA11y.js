/**
 * 模态对话框可访问性（BUG-22）
 * 提供：Esc 关闭、初始焦点、Tab 焦点循环、dialog 语义所需的行为支撑。
 * 组件的遮罩容器自行声明 role="dialog" aria-modal="true" aria-labelledby。
 */

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * @param {Object} options
 * @param {boolean} options.open - 是否打开
 * @param {Function} options.onClose - 关闭回调
 * @param {boolean} [options.disableClose] - 是否禁止 Esc 关闭
 * @param {Object} [options.initialFocusRef] - 初始焦点元素 ref（默认第一个可聚焦元素）
 * @returns {Object} containerRef - 挂到对话框内容容器上
 */
export function useDialogA11y({ open, onClose, disableClose = false, initialFocusRef } = {}) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const container = containerRef.current;
    const focusTarget = initialFocusRef?.current || container?.querySelector(FOCUSABLE_SELECTOR);
    focusTarget?.focus?.();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        if (!disableClose) {
          event.stopPropagation();
          onClose?.();
        }
        return;
      }

      if (event.key !== 'Tab' || !container) {
        return;
      }

      const focusable = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
      if (!focusable.length) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, disableClose, onClose, initialFocusRef]);

  return containerRef;
}
