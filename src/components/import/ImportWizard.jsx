import { useEffect, useMemo, useState } from 'react';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { parseFile, reMapCSVData, reMapExcelData, validateFile } from '../../lib/parsers';
import DataPreview from './DataPreview';
import FileUploader from './FileUploader';

const TITLE_ID = 'import-wizard-title';

const STEP_ITEMS = [
  { key: 'upload', label: '选择文件' },
  { key: 'preview', label: '预览与映射' },
  { key: 'confirm', label: '确认导入' }
];

const FORMAT_LABELS = { json: 'JSON', csv: 'CSV', xlsx: 'Excel', xls: 'Excel' };
const MAPPING_FORMATS = new Set(['csv', 'xlsx', 'xls']);

function getFormatKey(fileName) {
  return (fileName || '').split('.').pop()?.toLowerCase() || '';
}

function computeStats(result) {
  const valid = result?.data?.length || 0;
  const invalid = (result?.errors || []).filter((item) => /^第 \d+ /.test(item)).length;
  const total = Array.isArray(result?.rows) ? result.rows.length : valid + invalid;
  const skipped = Array.isArray(result?.skippedRows) ? result.skippedRows.length : null;

  return {
    total,
    valid,
    invalid,
    dropped: skipped ?? Math.max(total - valid - invalid, 0)
  };
}

export default function ImportWizard({ open, onClose, onImport }) {
  const [step, setStep] = useState('upload');
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState(null);
  const [mapping, setMapping] = useState(null);
  const [importing, setImporting] = useState(false);
  const dialogRef = useDialogA11y({ open, onClose, disableClose: importing });

  const format = getFormatKey(file?.name);
  const needsMapping = MAPPING_FORMATS.has(format);
  const formatLabel = FORMAT_LABELS[format] || (format ? format.toUpperCase() : '-');
  const columns = useMemo(() => {
    const firstRow = result?.rows?.[0];
    return firstRow && typeof firstRow === 'object' ? Object.keys(firstRow) : [];
  }, [result]);
  const stats = useMemo(() => computeStats(result), [result]);
  const stepIndex = STEP_ITEMS.findIndex((item) => item.key === step);

  useEffect(() => {
    if (!open) {
      return;
    }

    setStep('upload');
    setFile(null);
    setError('');
    setParsing(false);
    setResult(null);
    setMapping(null);
    setImporting(false);
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSelectFile = async (nextFile) => {
    setError('');
    setFile(nextFile);
    setResult(null);
    setMapping(null);

    const validation = validateFile(nextFile);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setParsing(true);

    try {
      const parsed = await parseFile(nextFile);
      if (!parsed.success) {
        setError(parsed.errors?.[0] || '解析失败，请检查文件内容');
        return;
      }

      setResult(parsed);
      setMapping(parsed.fieldMapping || null);
      setStep('preview');

      if (!parsed.data?.length) {
        setError('文件解析完成，但没有可用的对话数据，请检查字段映射。');
      }
    } finally {
      setParsing(false);
    }
  };

  const handleMappingChange = (field, column) => {
    const nextMapping = { ...(mapping || {}), [field]: column || null };
    setMapping(nextMapping);

    const missing = ['id', 'user', 'assistant'].filter((key) => !nextMapping[key]);
    if (missing.length) {
      setError('请完整选择对话 ID、用户消息、客服回复三个字段');
      setResult((previous) =>
        previous
          ? { ...previous, data: [], errors: ['请完整选择对话 ID、用户消息、客服回复三个字段'], fieldMapping: nextMapping }
          : previous
      );
      return;
    }

    const remapped = needsMapping && format === 'csv' ? reMapCSVData(result.rows, nextMapping) : reMapExcelData(result.rows, nextMapping);
    setError(remapped.data?.length ? '' : '当前字段映射下没有可导入的对话，请检查列选择');
    setResult((previous) =>
      previous
        ? {
            ...previous,
            data: remapped.data || [],
            skippedRows: remapped.skippedRows || [],
            errors: remapped.errors || [],
            fieldMapping: nextMapping
          }
        : previous
    );
  };

  const handleConfirmImport = () => {
    if (!result || !stats.valid) {
      return;
    }

    setImporting(true);
    onImport({
      conversations: result.data,
      meta: {
        fileName: file.name,
        format: formatLabel,
        total: stats.total,
        valid: stats.valid,
        invalid: stats.invalid + stats.dropped
      }
    });
  };

  const goBack = () => {
    setError('');
    setStep(step === 'confirm' ? 'preview' : 'upload');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget && !importing) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border border-white/60 bg-white shadow-[0_40px_120px_-40px_rgba(15,23,42,0.6)] dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-600 dark:text-cyan-300">Import</p>
              <h2 id={TITLE_ID} className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">导入对话数据</h2>
              <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-400">
                支持 JSON / CSV / Excel，导入后直接替换当前待审核列表。
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={importing}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300 dark:hover:text-white"
            >
              关闭
            </button>
          </div>

          <ol className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {STEP_ITEMS.map((item, index) => (
              <li key={item.key} className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                    index <= stepIndex
                      ? 'bg-cyan-500 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {index + 1}
                </span>
                <span className={index === stepIndex ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}>
                  {item.label}
                </span>
                {index < STEP_ITEMS.length - 1 ? <span className="text-slate-300 dark:text-slate-600">›</span> : null}
              </li>
            ))}
          </ol>
        </div>

        <div className="min-h-[18rem] flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {step === 'upload' ? (
            <div className="space-y-4">
              <FileUploader file={file} error={error} disabled={parsing} onSelectFile={handleSelectFile} />
              {parsing ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">正在解析文件...</p>
              ) : (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  选择文件后会自动解析并进入预览；文件只在本机浏览器内解析，不会上传到服务器。
                </p>
              )}
            </div>
          ) : null}

          {step === 'preview' ? (
            <div className="space-y-4">
              <DataPreview
                result={result}
                stats={stats}
                mapping={mapping}
                columns={columns}
                needsMapping={needsMapping}
                onMappingChange={handleMappingChange}
              />
              {error ? <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
            </div>
          ) : null}

          {step === 'confirm' ? (
            <div className="space-y-5">
              <div className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-600 dark:text-slate-400">文件</dt>
                    <dd className="mt-1 truncate font-medium text-slate-900 dark:text-white" title={file?.name}>{file?.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-600 dark:text-slate-400">格式</dt>
                    <dd className="mt-1 font-medium text-slate-900 dark:text-white">{formatLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-600 dark:text-slate-400">有效对话</dt>
                    <dd className="mt-1 font-medium text-slate-900 dark:text-white">{stats.valid} 条</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-600 dark:text-slate-400">跳过</dt>
                    <dd className="mt-1 font-medium text-slate-900 dark:text-white">{stats.invalid + stats.dropped} 条</dd>
                  </div>
                </dl>
              </div>

              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                <li className="flex gap-2">
                  <span className="text-cyan-500">·</span>
                  导入后当前待审核列表会被替换为这 {stats.valid} 条对话，进度回到第 1 条。
                </li>
                <li className="flex gap-2">
                  <span className="text-cyan-500">·</span>
                  已有人工标注按对话 ID 保留，不会被清除；换一批数据后旧标注仍留在本地。
                </li>
                <li className="flex gap-2">
                  <span className="text-cyan-500">·</span>
                  导入数据保存在当前页面内存中，刷新浏览器后需要重新导入。
                </li>
              </ul>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6">
          <button
            type="button"
            onClick={step === 'upload' ? onClose : goBack}
            disabled={importing}
            className="primary-button border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200"
          >
            {step === 'upload' ? '取消' : '上一步'}
          </button>

          <div className="flex items-center gap-2">
            {step === 'upload' ? (
              <span className="text-xs text-slate-600 dark:text-slate-400">{parsing ? '解析中...' : '等待选择文件'}</span>
            ) : null}

            {step === 'preview' ? (
              <button
                type="button"
                onClick={() => setStep('confirm')}
                disabled={!stats.valid}
                className="primary-button bg-cyan-500 text-white hover:bg-cyan-600"
              >
                下一步
              </button>
            ) : null}

            {step === 'confirm' ? (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={importing || !stats.valid}
                className="primary-button bg-cyan-500 text-white hover:bg-cyan-600"
              >
                {importing ? '导入中...' : `确认导入 ${stats.valid} 条`}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
