import { useEffect, useRef, useState } from 'react';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { AI_MODEL_OPTIONS, DEFAULT_SETTINGS, loadSettings, normalizeSettings } from '../../lib/settings';
import { clearAnnotations, exportAllData, getConfig, getImportHistory, importAllData } from '../../lib/storage';

const TITLE_ID = 'settings-panel-title';
const CONCURRENCY_OPTIONS = [1, 2, 3, 4, 5];

function downloadJson(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getBackupFileName(date = new Date()) {
  return `质检标注备份-${date.toISOString().slice(0, 10)}.json`;
}

export default function SettingsPanel({ open, settings = DEFAULT_SETTINGS, onClose, onSave, onDataRestored }) {
  const [apiKey, setApiKey] = useState(settings.apiKey || '');
  const [model, setModel] = useState(settings.model || DEFAULT_SETTINGS.model);
  const [concurrency, setConcurrency] = useState(settings.concurrency || DEFAULT_SETTINGS.concurrency);
  const [message, setMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef(null);
  const dialogRef = useDialogA11y({ open, onClose });

  // 打开（或重新挂载）时同步表单草稿；打开期间父级设置因自身保存而变化时不重置草稿与提示
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setApiKey(settings.apiKey || '');
      setModel(settings.model || DEFAULT_SETTINGS.model);
      setConcurrency(settings.concurrency || DEFAULT_SETTINGS.concurrency);
      setMessage({ type: '', text: '' });
    }

    wasOpenRef.current = open;
  }, [open, settings.apiKey, settings.model, settings.concurrency]);

  if (!open) {
    return null;
  }

  const handleSave = () => {
    const next = normalizeSettings({ apiKey, model, concurrency });
    onSave?.(next);
    setApiKey(next.apiKey);
    setMessage({ type: 'success', text: '设置已保存' });
  };

  // 只清除 Key，不连带提交未保存的模型/并发草稿（BUG-29）
  const handleClearKey = () => {
    const base = normalizeSettings({ ...settings, apiKey: '' });
    setApiKey('');
    setModel(base.model);
    setConcurrency(base.concurrency);
    onSave?.(base);
    setMessage({ type: 'success', text: '已清除 API Key' });
  };

  const handleExportBackup = () => {
    try {
      downloadJson(exportAllData(), getBackupFileName());
      setMessage({ type: 'success', text: '标注备份已导出' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : '备份导出失败' });
    }
  };

  const handleImportBackup = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = importAllData(data, true);

      if (!result.restored) {
        setMessage({
          type: 'error',
          text: result.reason === 'invalid' ? '备份格式无效，请选择本应用导出的备份文件' : '备份中没有可恢复的数据',
        });
        return;
      }

      onDataRestored?.();

      // BUG-31：本面板发起的恢复成功后，用恢复结果重同步表单，避免随后「保存设置」用旧草稿覆盖配置
      const restoredSettings = loadSettings();
      setApiKey(restoredSettings.apiKey);
      setModel(restoredSettings.model);
      setConcurrency(restoredSettings.concurrency);

      setMessage({ type: 'success', text: `备份已恢复（${result.fields.join('、')}）` });
    } catch {
      setMessage({ type: 'error', text: '备份文件不是有效的 JSON，恢复失败' });
    }
  };

  const handleClearAnnotations = () => {
    if (!window.confirm('确定要清空本地全部标注吗？此操作不可撤销。')) {
      return;
    }

    clearAnnotations();
    onDataRestored?.();
    setMessage({ type: 'success', text: '本地标注已清空' });
  };

  const storedConfig = getConfig();
  const importHistoryCount = getImportHistory().length;
  const apiKeyStatus = apiKey ? '已配置' : '未配置';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6"
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
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/60 bg-white shadow-[0_40px_120px_-40px_rgba(15,23,42,0.6)] dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">
              Settings
            </p>
            <h2 id={TITLE_ID} className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">
              设置
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">AI 服务配置与本地数据管理。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:text-white"
          >
            关闭
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">AI 服务</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                API Key {apiKeyStatus}
              </span>
            </div>

            <div className="mt-3 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                  DeepSeek API Key
                </span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="sk-..."
                  autoComplete="off"
                  className="soft-input text-sm"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">模型</span>
                  <select
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    className="soft-input appearance-none py-2 text-sm"
                  >
                    {AI_MODEL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                    批量分析默认并发
                  </span>
                  <select
                    value={concurrency}
                    onChange={(event) => setConcurrency(Number(event.target.value))}
                    className="soft-input appearance-none py-2 text-sm"
                  >
                    {CONCURRENCY_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className="primary-button bg-blue-700 text-white hover:bg-blue-800"
                >
                  保存设置
                </button>
                <button
                  type="button"
                  onClick={handleClearKey}
                  className="primary-button border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                >
                  清除 API Key
                </button>
              </div>

              <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs leading-6 text-amber-800 dark:text-amber-200">
                提示：API Key 仅保存在本机浏览器 localStorage（配置项 `cs-review-config-v1`），不会上传到任何服务器，
                也不会被打进前端构建产物。请勿在公用电脑上保存。
              </p>
            </div>
          </section>

          <section className="border-t border-slate-200 pt-5 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">数据管理</h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              标注与配置都在本机浏览器，可导出备份或恢复。
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportBackup}
                className="primary-button border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
              >
                导出标注备份
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="primary-button border border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
              >
                导入备份
              </button>
              <button
                type="button"
                onClick={handleClearAnnotations}
                className="primary-button border border-rose-200 bg-rose-500/10 text-rose-700 hover:bg-rose-500/15 dark:border-rose-900 dark:text-rose-200"
              >
                清空本地标注
              </button>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportBackup} />
            </div>

            <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
              当前配置版本：{storedConfig?.autoSave ? '自动保存开启' : '自动保存关闭'} ｜ 导入历史 {importHistoryCount}{' '}
              条
            </p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              备份只包含标注、主题与 AI 配置（不含 API Key）
            </p>
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
          <span
            className={`min-h-[1rem] text-xs ${
              message.type === 'error'
                ? 'text-rose-600 dark:text-rose-300'
                : message.type === 'success'
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : 'text-slate-400 dark:text-slate-600'
            }`}
          >
            {message.text || '修改后点击「保存设置」生效'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="primary-button border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
