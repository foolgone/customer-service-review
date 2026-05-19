import { useEffect, useMemo, useState } from 'react';
import { LABELS } from '../lib/constants';

const TAB_LABELS = [
  { value: 'suggestion', label: 'AI 建议' },
  { value: 'reason', label: 'AI 理由' }
];

const LABEL_MAP = new Map(LABELS.map((item) => [item.value, item.label]));

function getLabelName(value) {
  return LABEL_MAP.get(value) || value;
}

export default function AnalysisPanel({ analysisState, isAnalyzing, hasApiKey, onAnalyze }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('suggestion');

  useEffect(() => {
    if (analysisState.status === 'success') {
      setExpanded(true);
    }
  }, [analysisState.status]);

  const title = useMemo(() => {
    if (analysisState.status === 'success') {
      return '已得到 AI 建议';
    }

    if (analysisState.status === 'analyzing') {
      return 'AI 正在分析';
    }

    if (analysisState.status === 'error') {
      return 'AI 分析失败';
    }

    return 'AI 辅助分析';
  }, [analysisState.status]);

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white/75 p-5 shadow-glow backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/75">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">AI 仅输出建议，不会覆盖人工标注。</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:border-cyan-700 dark:hover:text-cyan-300"
          >
            {expanded ? '收起' : '展开'}
          </button>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={isAnalyzing || !hasApiKey}
            className="rounded-full bg-cyan-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAnalyzing ? '分析中...' : '重新分析'}
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {TAB_LABELS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`rounded-full px-4 py-2 text-xs font-medium transition ${
                  activeTab === tab.value
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {analysisState.status === 'success' ? (
            <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
              {activeTab === 'suggestion' ? (
                <div className="rounded-2xl border border-cyan-200 bg-cyan-500/5 p-4 dark:border-cyan-900/60 dark:bg-cyan-500/10">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700 dark:text-cyan-300">建议标签</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {analysisState.labels.length ? (
                      analysisState.labels.map((label) => (
                        <span key={label} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-cyan-700 dark:bg-slate-900 dark:text-cyan-200">
                          {getLabelName(label)}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">模型未返回建议标签</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/70">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">判断理由</p>
                  <p className="mt-2 leading-7 text-slate-700 dark:text-slate-200">
                    {analysisState.reason || '模型未返回理由，请检查返回内容是否包含 reason / analysis / explanation。'}
                  </p>
                </div>
              )}

              <p className="text-xs text-slate-500 dark:text-slate-400">仅作为辅助建议，不会修改当前人工标注。</p>
            </div>
          ) : analysisState.status === 'error' ? (
            <p className="mt-2 text-sm text-rose-600 dark:text-rose-300">{analysisState.error}</p>
          ) : analysisState.status === 'analyzing' ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">正在调用 DeepSeek 进行分析...</p>
          ) : (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">点击分析后这里会展示建议标签和理由。</p>
          )}
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
          <span>折叠模式 · AI 仅保留摘要</span>
          <span>{analysisState.status === 'success' ? `已生成 ${analysisState.labels.length || 0} 个建议标签` : '按需展开查看'}</span>
        </div>
      )}
    </section>
  );
}