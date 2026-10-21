export default function ActionBar({
  onPrev,
  onNext,
  onSave,
  onExport,
  onAnalyze,
  onImport,
  onExportReport,
  onBatchAnalyze,
  isBatchAnalyzing = false,
  canPrev,
  canNext,
  isAnalyzing,
  isSaving,
  hasApiKey,
  onToggleTheme,
  themeLabel
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onImport} className="primary-button bg-cyan-500 text-white hover:bg-cyan-600">
          导入数据
        </button>
        <button type="button" onClick={onPrev} disabled={!canPrev} className="primary-button bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
          上一条
        </button>
        <button type="button" onClick={onNext} disabled={!canNext} className="primary-button bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
          下一条
        </button>
        <button type="button" onClick={onSave} disabled={isSaving} className="primary-button bg-cyan-500 text-white hover:bg-cyan-600">
          {isSaving ? '保存中...' : '保存'}
        </button>
        <button type="button" onClick={onExport} className="primary-button bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200">
          导出 CSV
        </button>
        <button
          type="button"
          onClick={onExportReport}
          className="primary-button border border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200"
        >
          导出报告
        </button>
        <button type="button" onClick={onAnalyze} disabled={isAnalyzing || !hasApiKey} className="primary-button border border-slate-200 bg-white text-slate-800 hover:border-cyan-300 hover:bg-cyan-500/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100 dark:hover:border-cyan-700">
          {isAnalyzing ? '分析中...' : 'AI 分析'}
        </button>
        <button
          type="button"
          onClick={onBatchAnalyze}
          disabled={isBatchAnalyzing || !hasApiKey}
          className="primary-button border border-cyan-200 bg-cyan-500/10 text-cyan-800 hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-cyan-900 dark:text-cyan-200"
        >
          {isBatchAnalyzing ? '批量分析中...' : '批量分析'}
        </button>
        <button type="button" onClick={onToggleTheme} className="primary-button border border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:bg-cyan-500/5 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-100">
          {themeLabel}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
        <span className="font-medium text-slate-700 dark:text-slate-200">快捷键</span>
        <span>Enter 下一条</span>
        <span>Ctrl+S 保存</span>
        <span>A AI 分析</span>
        <span>D 深色模式</span>
        <span>1-6 标签</span>
        <span>Alt+1-5 评分</span>
      </div>
    </div>
  );
}
