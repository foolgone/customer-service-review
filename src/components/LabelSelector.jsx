import { LABELS } from '../lib/constants';

export default function LabelSelector({ selectedLabels, onToggleLabel }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {LABELS.map((item) => {
        const active = selectedLabels.includes(item.value);

        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onToggleLabel(item.value)}
            className={`rounded-2xl border px-4 py-4 text-left transition ${
              active
                ? 'border-cyan-400 bg-cyan-500/10 text-cyan-800 ring-4 ring-cyan-500/10 dark:text-cyan-100'
                : 'border-slate-200 bg-white/80 text-slate-700 hover:border-cyan-300 hover:bg-cyan-500/5 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{item.label}</p>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {item.shortcut}
              </span>
              <span
                className={`h-3 w-3 rounded-full ${
                  active ? 'bg-cyan-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
