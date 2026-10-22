/**
 * 快捷键面板（按 ? 或侧边栏入口呼出）
 */
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { QUICK_SHORTCUTS } from '../../lib/constants';

const TITLE_ID = 'shortcuts-dialog-title';

const EXTRA_SHORTCUTS = [
  { key: '?', label: '打开快捷键面板' },
  { key: 'Esc', label: '关闭当前弹窗' },
];

export default function ShortcutsDialog({ open, onClose }) {
  const dialogRef = useDialogA11y({ open, onClose });

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-pop dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={TITLE_ID} className="text-lg font-semibold">
              快捷键
            </h2>
            <p className="muted mt-1">输入框内与弹窗打开时自动暂停，避免误操作。</p>
          </div>
          <button type="button" onClick={onClose} className="ghost-button" aria-label="关闭快捷键面板">
            关闭
          </button>
        </div>

        <dl className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {[...QUICK_SHORTCUTS, ...EXTRA_SHORTCUTS].map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-3 py-2">
              <dt className="text-sm text-slate-600 dark:text-slate-300">{item.label}</dt>
              <dd>
                <kbd className="kbd">{item.key}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
