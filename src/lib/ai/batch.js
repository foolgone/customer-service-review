/**
 * 并发批量分析执行器
 * 职责：把一个「单项分析函数」安全地并发套用到一批数据上，提供进度、取消与错误隔离。
 * 不关心具体 AI 供应商，方便后续替换 Provider。
 */

import pLimit from 'p-limit';

export const DEFAULT_BATCH_CONCURRENCY = 3;
export const MAX_BATCH_CONCURRENCY = 5;

/**
 * 归一化并发数
 * @param {any} value - 外部传入的并发数
 * @returns {number} 1 ~ MAX_BATCH_CONCURRENCY 之间的整数
 */
export function normalizeConcurrency(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_BATCH_CONCURRENCY;
  }

  return Math.min(Math.max(Math.round(parsed), 1), MAX_BATCH_CONCURRENCY);
}

/**
 * 并发执行批量分析
 * @param {Object} options
 * @param {Array} options.items - 待分析项（原样传给 analyze）
 * @param {Function} options.analyze - async (item, index) => result
 * @param {number} [options.concurrency] - 并发数，默认 3
 * @param {Function} [options.onProgress] - 每完成一项回调一次
 * @param {AbortSignal} [options.signal] - 取消信号，已取消的项标记为 skipped
 * @returns {Promise<Object>} { results, successCount, failedCount, skippedCount, cancelled }
 */
export async function runBatchAnalysis({
  items = [],
  analyze,
  concurrency = DEFAULT_BATCH_CONCURRENCY,
  onProgress,
  signal,
} = {}) {
  if (typeof analyze !== 'function') {
    throw new Error('runBatchAnalysis 缺少 analyze 函数');
  }

  const list = Array.isArray(items) ? items : [];
  const limit = pLimit(normalizeConcurrency(concurrency));
  const results = new Array(list.length);

  let completed = 0;
  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  const report = (entry) => {
    completed += 1;
    onProgress?.({
      completed,
      total: list.length,
      index: entry.index,
      status: entry.status,
      result: entry.result,
      error: entry.error,
    });
  };

  const tasks = list.map((item, index) =>
    limit(async () => {
      if (signal?.aborted) {
        skippedCount += 1;
        results[index] = { index, item, status: 'skipped' };
        report(results[index]);
        return results[index];
      }

      try {
        const result = await analyze(item, index);
        successCount += 1;
        results[index] = { index, item, status: 'success', result };
      } catch (error) {
        failedCount += 1;
        results[index] = {
          index,
          item,
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        };
      }

      report(results[index]);
      return results[index];
    }),
  );

  await Promise.all(tasks);

  return {
    results: results.filter(Boolean),
    successCount,
    failedCount,
    skippedCount,
    cancelled: Boolean(signal?.aborted),
  };
}
