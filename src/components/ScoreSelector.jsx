import { SCORE_LEVELS } from '../lib/constants';

export default function ScoreSelector({ selectedScore, onChangeScore }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/70 p-5 shadow-glow backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/70">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">质量评分</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">1-5 分支持快捷键 Alt + 1~5。</p>
        </div>
        <div className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-300">
          当前评分：{selectedScore} 分
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-5">
        {SCORE_LEVELS.map((level) => {
          const active = selectedScore === level.value;

          return (
            <button
              key={level.value}
              type="button"
              onClick={() => onChangeScore(level.value)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                active
                  ? 'border-cyan-400 bg-cyan-500/10 text-cyan-800 ring-4 ring-cyan-500/10 dark:text-cyan-100'
                  : 'border-slate-200 bg-white/80 text-slate-700 hover:border-cyan-300 hover:bg-cyan-500/5 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{level.label}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{level.description}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  {level.shortcut}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}