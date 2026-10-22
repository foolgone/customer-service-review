import { LABELS } from '../lib/constants';

/**
 * 问题标签选择器
 * 紧凑行式：一行一个标签 + 快捷键，适配右侧 380px 标注栏（旧的多列网格会把中文挤成竖排）。
 */
export default function LabelSelector({ selectedLabels, onToggleLabel }) {
  return (
    <div className="grid gap-1.5">
      {LABELS.map((item) => {
        const active = selectedLabels.includes(item.value);

        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onToggleLabel(item.value)}
            className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left transition ${
              active
                ? 'border-blue-400 bg-blue-500/10 text-blue-800 ring-4 ring-blue-500/10 dark:text-blue-100'
                : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-500/5 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200'
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                aria-hidden="true"
              />
              <span className="truncate text-sm font-medium">{item.label}</span>
            </span>
            <kbd className="kbd shrink-0">{item.shortcut}</kbd>
          </button>
        );
      })}
    </div>
  );
}
