/**
 * src/lib/ai/batch.js 单元测试
 * 覆盖：并发上限、成功/失败计数、错误隔离、进度回调、取消（skipped）、并发数归一化
 */
import { describe, it, expect } from 'vitest';
import {
  runBatchAnalysis,
  normalizeConcurrency,
  DEFAULT_BATCH_CONCURRENCY,
  MAX_BATCH_CONCURRENCY
} from '../../../../src/lib/ai/batch.js';

function makeItems(count) {
  return Array.from({ length: count }, (_, index) => ({ id: `item-${index + 1}` }));
}

describe('normalizeConcurrency', () => {
  it('非法输入回落到默认并发数', () => {
    expect(normalizeConcurrency(undefined)).toBe(DEFAULT_BATCH_CONCURRENCY);
    expect(normalizeConcurrency('abc')).toBe(DEFAULT_BATCH_CONCURRENCY);
    expect(normalizeConcurrency(NaN)).toBe(DEFAULT_BATCH_CONCURRENCY);
  });

  it('过小取 1、过大取上限、小数四舍五入', () => {
    expect(normalizeConcurrency(0)).toBe(1);
    expect(normalizeConcurrency(-5)).toBe(1);
    expect(normalizeConcurrency(99)).toBe(MAX_BATCH_CONCURRENCY);
    expect(normalizeConcurrency(2.6)).toBe(3);
  });
});

describe('runBatchAnalysis', () => {
  it('全部成功 → 计数正确且每项都有结果', async () => {
    const items = makeItems(5);
    const outcome = await runBatchAnalysis({
      items,
      analyze: async (item) => ({ id: item.id, ok: true })
    });

    expect(outcome.successCount).toBe(5);
    expect(outcome.failedCount).toBe(0);
    expect(outcome.skippedCount).toBe(0);
    expect(outcome.cancelled).toBe(false);
    expect(outcome.results).toHaveLength(5);
    expect(outcome.results.every((entry) => entry.status === 'success')).toBe(true);
  });

  it('单项抛错不影响其它项，并记录错误信息', async () => {
    const items = makeItems(3);
    const outcome = await runBatchAnalysis({
      items,
      analyze: async (item) => {
        if (item.id === 'item-2') {
          throw new Error('模拟失败');
        }
        return { ok: true };
      }
    });

    expect(outcome.successCount).toBe(2);
    expect(outcome.failedCount).toBe(1);
    const failed = outcome.results.find((entry) => entry.status === 'error');
    expect(failed.item.id).toBe('item-2');
    expect(failed.error).toBe('模拟失败');
  });

  it('并发数受控：同时在跑的项不超过 concurrency', async () => {
    let active = 0;
    let peak = 0;
    const items = makeItems(10);

    await runBatchAnalysis({
      items,
      concurrency: 2,
      analyze: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return { ok: true };
      }
    });

    expect(peak).toBeLessThanOrEqual(2);
    expect(peak).toBeGreaterThan(1);
  });

  it('开始前已取消 → 全部标记 skipped', async () => {
    const controller = new AbortController();
    controller.abort();

    const outcome = await runBatchAnalysis({
      items: makeItems(2),
      analyze: async () => ({ ok: true }),
      signal: controller.signal
    });

    expect(outcome.cancelled).toBe(true);
    expect(outcome.skippedCount).toBe(2);
    expect(outcome.successCount).toBe(0);
  });

  it('运行中取消 → 已开始的项完成、排队项跳过', async () => {
    const controller = new AbortController();
    const items = makeItems(4);
    let started = 0;

    const outcome = await runBatchAnalysis({
      items,
      concurrency: 1,
      signal: controller.signal,
      analyze: async () => {
        started += 1;
        if (started === 1) {
          controller.abort();
        }
        return { ok: true };
      }
    });

    expect(outcome.cancelled).toBe(true);
    expect(outcome.successCount).toBe(1);
    expect(outcome.skippedCount).toBe(3);
  });

  it('每完成一项回调一次进度，completed 单调递增到 total', async () => {
    const entries = [];
    const outcome = await runBatchAnalysis({
      items: makeItems(3),
      analyze: async () => ({ ok: true }),
      onProgress: (entry) => entries.push(entry)
    });

    expect(entries).toHaveLength(3);
    expect(entries.every((entry) => entry.total === 3)).toBe(true);
    expect(entries.map((entry) => entry.completed).sort((left, right) => left - right)).toEqual([1, 2, 3]);
    expect(outcome.results).toHaveLength(3);
  });

  it('缺少 analyze 函数 → 直接报错', async () => {
    await expect(runBatchAnalysis({ items: makeItems(1) })).rejects.toThrow('缺少 analyze');
  });
});
