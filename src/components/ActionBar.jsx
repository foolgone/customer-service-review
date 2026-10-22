export default function ActionBar({
  onPrev,
  onNext,
  onSave,
  onExport,
  onAnalyze,
  onImport,
  onOpenDataManager,
  onExportReport,
  onBatchAnalyze,
  onOpenSettings,
  isBatchAnalyzing = false,
  canPrev,
  canNext,
  isAnalyzing,
  isSaving,
  hasApiKey,
  onToggleTheme,
  themeLabel,
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onImport} className="primary-button bg-blue-700 text-white hover:bg-blue-800">
          导入数据
        </button>
        <button
          type="button"
          onClick={onOpenDataManager}
          className="primary-button border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
        >
          数据管理
        </button>
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          className="primary-button bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          上一条
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className="primary-button bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
        >
          下一条
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="primary-button bg-blue-700 text-white hover:bg-blue-800"
        >
          {isSaving ? '保存中...' : '保存'}
        </button>
        <button
          type="button"
          onClick={onExport}
          className="primary-button bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          导出 CSV
        </button>
        <button
          type="button"
          onClick={onExportReport}
          className="primary-button border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
        >
          导出报告
        </button>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={isAnalyzing || !hasApiKey}
          className="primary-button border border-slate-200 bg-white text-slate-800 hover:border-blue-300 hover:bg-blue-500/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-blue-700"
        >
          {isAnalyzing ? '分析中...' : 'AI 分析'}
        </button>
        <button
          type="button"
          onClick={onBatchAnalyze}
          disabled={isBatchAnalyzing || !hasApiKey}
          className="primary-button border border-blue-200 bg-blue-500/10 text-blue-800 hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-900 dark:text-blue-200"
        >
          {isBatchAnalyzing ? '批量分析中...' : '批量分析'}
        </button>
        <button
          type="button"
          onClick={onToggleTheme}
          className="primary-button border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-500/5 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        >
          {themeLabel}
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="primary-button border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-500/5 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
        >
          设置
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
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
