const FIELD_DEFS = [
  { key: 'id', label: '对话 ID' },
  { key: 'user', label: '用户消息' },
  { key: 'assistant', label: '客服回复' }
];

function getConversationText(conversation, role) {
  return conversation?.turns?.find((turn) => turn.role === role)?.content || '';
}

function getPreviewRows(result) {
  return (result?.data || []).slice(0, 10).map((conversation) => ({
    id: conversation.id,
    user: getConversationText(conversation, 'user'),
    assistant: getConversationText(conversation, 'assistant')
  }));
}

export default function DataPreview({ result, stats, mapping, columns, needsMapping, onMappingChange }) {
  const previewRows = getPreviewRows(result);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-2xl bg-slate-100 px-3 py-2 text-center dark:bg-slate-950/60">
          <p className="text-lg font-semibold text-slate-900 dark:text-white">{stats.total}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">总行数</p>
        </div>
        <div className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-center">
          <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">{stats.valid}</p>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">有效对话</p>
        </div>
        <div className="rounded-2xl bg-amber-500/10 px-3 py-2 text-center">
          <p className="text-lg font-semibold text-amber-700 dark:text-amber-300">{stats.invalid}</p>
          <p className="text-xs text-amber-700/80 dark:text-amber-300/80">格式错误</p>
        </div>
        <div className="rounded-2xl bg-rose-500/10 px-3 py-2 text-center">
          <p className="text-lg font-semibold text-rose-700 dark:text-rose-300">{stats.dropped}</p>
          <p className="text-xs text-rose-700/80 dark:text-rose-300/80">缺必填字段</p>
        </div>
      </div>

      {needsMapping ? (
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">字段映射</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            把文件里的列对应到系统字段，已按列名自动识别，可手动调整。
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {FIELD_DEFS.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{field.label}</span>
                <select
                  value={mapping?.[field.key] || ''}
                  onChange={(event) => onMappingChange(field.key, event.target.value)}
                  className="soft-input appearance-none py-2 text-sm"
                >
                  <option value="">请选择列</option>
                  {columns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">数据预览</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">最多显示前 10 条</p>
        </div>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-950/60">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-medium text-slate-600 dark:text-slate-400">ID</th>
                <th className="px-3 py-2 font-medium text-slate-600 dark:text-slate-400">用户消息</th>
                <th className="px-3 py-2 font-medium text-slate-600 dark:text-slate-400">客服回复</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {previewRows.length ? (
                previewRows.map((row, index) => (
                  <tr key={`${row.id}-${index}`} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{row.id}</td>
                    <td className="max-w-[18rem] px-3 py-2 text-slate-600 dark:text-slate-300">
                      <span className="line-clamp-2">{row.user}</span>
                    </td>
                    <td className="max-w-[24rem] px-3 py-2 text-slate-600 dark:text-slate-300">
                      <span className="line-clamp-2">{row.assistant}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-slate-600 dark:text-slate-400">
                    暂无可预览的数据，请检查文件内容或字段映射
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {result?.skippedRows?.length ? (
        <details className="rounded-2xl border border-rose-200 bg-rose-500/5 px-4 py-3 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-500/10 dark:text-rose-200">
          <summary className="cursor-pointer font-medium">
            已跳过 {result.skippedRows.length} 行（缺必填字段，不会导入）
          </summary>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-2">
            {result.skippedRows.slice(0, 50).map((item) => (
              <li key={`skip-${item.row}`} className="leading-6">
                · 第 {item.row} 行：{item.reason}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {result?.errors?.length ? (
        <details className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
          <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-200">
            查看 {result.errors.length} 条解析提示
          </summary>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-2">
            {result.errors.slice(0, 50).map((message, index) => (
              <li key={`${message}-${index}`} className="leading-6">
                · {message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
