import { useRef, useState } from 'react';
import { formatFileSize } from '../../lib/utils';

const ACCEPT = '.json,.csv,.xlsx,.xls';

export default function FileUploader({ file, error, disabled = false, onSelectFile }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const handleFiles = (fileList) => {
    const nextFile = fileList && fileList[0];
    if (nextFile) {
      onSelectFile(nextFile);
    }
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={`cursor-pointer rounded-lg border-2 border-dashed px-6 py-10 text-center transition ${
          dragging
            ? 'border-blue-400 bg-blue-500/10'
            : 'border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-500/5 dark:border-slate-700 dark:bg-slate-950'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <p className="text-3xl" aria-hidden="true">
          📁
        </p>
        <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">拖拽文件到此处，或点击选择文件</p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
          支持 .json .csv .xlsx .xls ｜ 单个文件最大 10MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          disabled={disabled}
          onChange={(event) => {
            const nextFile = event.target.files?.[0];
            if (nextFile) {
              onSelectFile(nextFile);
            }
            event.target.value = '';
          }}
        />
      </div>

      {file ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950">
          <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">✓ {file.name}</span>
          <span className="shrink-0 text-xs text-slate-600 dark:text-slate-400">{formatFileSize(file.size)}</span>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">{error}</p> : null}
    </div>
  );
}
