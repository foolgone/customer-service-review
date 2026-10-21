/**
 * src/lib/ai/ 边界与契约补充测试
 * 开发已自带 batch.test.js / providers.test.js 覆盖主路径，本文件补充：
 * - batch：空/非数组入参、非 Error 抛出、顺序保持、进度字段、并发数归一化边界
 * - providers：默认全局 fetch、无参调用、未知标签过滤、reason 回退、错误透传
 * - index：统一出口的导出一致性
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  runBatchAnalysis,
  normalizeConcurrency,
  DEFAULT_BATCH_CONCURRENCY,
  MAX_BATCH_CONCURRENCY
} from '../../../../src/lib/ai/batch.js';
import {
  createDeepSeekProvider,
  createProvider,
  listProviders,
  AI_PROVIDERS
} from '../../../../src/lib/ai/providers.js';
import * as aiIndex from '../../../../src/lib/ai/index.js';
import * as batchModule from '../../../../src/lib/ai/batch.js';
import * as providersModule from '../../../../src/lib/ai/providers.js';
import { buildDeepSeekPrompt } from '../../../../src/lib/deepseek.js';
import { DEEPSEEK_DEFAULT_MODEL, DEEPSEEK_ENDPOINT } from '../../../../src/lib/constants.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeJsonResponse({ ok = true, status = 200, content = '{"labels":["accurate"],"reason":"ok"}' } = {}) {
  return {
    ok,
    status,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => 'error-body'
  };
}

describe('runBatchAnalysis 边界行为', () => {
  it('空数组 → 全部计数为 0 且不触发进度回调', async () => {
    const onProgress = vi.fn();
    const outcome = await runBatchAnalysis({ items: [], analyze: async () => ({ ok: true }), onProgress });

    expect(outcome).toEqual({ results: [], successCount: 0, failedCount: 0, skippedCount: 0, cancelled: false });
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('items 非数组（null / 字符串 / 对象）→ 视为空列表而不是抛错', async () => {
    const analyze = vi.fn(async () => ({ ok: true }));

    for (const items of [null, 'not-array', { length: 2 }]) {
      const outcome = await runBatchAnalysis({ items, analyze });
      expect(outcome.results).toEqual([]);
      expect(outcome.successCount).toBe(0);
    }
    expect(analyze).not.toHaveBeenCalled();
  });

  it('analyze 抛出非 Error 值 → 记录为字符串错误且不影响其他项', async () => {
    const outcome = await runBatchAnalysis({
      items: [{ id: 'a' }, { id: 'b' }],
      analyze: async (item) => {
        if (item.id === 'a') {
          throw '字符串错误';
        }
        return { ok: true };
      }
    });

    expect(outcome.failedCount).toBe(1);
    const failed = outcome.results.find((entry) => entry.status === 'error');
    expect(failed.error).toBe('字符串错误');
  });

  it('缺少 onProgress 时不报错', async () => {
    const outcome = await runBatchAnalysis({
      items: [{ id: 'a' }],
      analyze: async () => ({ ok: true })
    });
    expect(outcome.successCount).toBe(1);
  });

  it('并发完成顺序打乱时，results 仍按原始索引排列', async () => {
    const items = [{ id: 'slow' }, { id: 'fast' }, { id: 'medium' }];
    const delays = { slow: 30, fast: 1, medium: 10 };

    const outcome = await runBatchAnalysis({
      items,
      concurrency: 3,
      analyze: async (item) => {
        await new Promise((resolve) => setTimeout(resolve, delays[item.id]));
        return { id: item.id };
      }
    });

    expect(outcome.results.map((entry) => entry.index)).toEqual([0, 1, 2]);
    expect(outcome.results.map((entry) => entry.item.id)).toEqual(['slow', 'fast', 'medium']);
    expect(outcome.results.map((entry) => entry.result.id)).toEqual(['slow', 'fast', 'medium']);
  });

  it('onProgress 回调包含完整字段（completed / total / index / status / result / error）', async () => {
    const entries = [];
    await runBatchAnalysis({
      items: [{ id: 'a' }],
      analyze: async () => ({ labels: ['accurate'] }),
      onProgress: (entry) => entries.push(entry)
    });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      completed: 1,
      total: 1,
      index: 0,
      status: 'success',
      result: { labels: ['accurate'] },
      error: undefined
    });
  });

  it('analyze 为同步返回值（非 Promise）也能正常完成', async () => {
    const outcome = await runBatchAnalysis({
      items: [{ id: 'a' }],
      analyze: () => ({ sync: true })
    });

    expect(outcome.successCount).toBe(1);
    expect(outcome.results[0].result).toEqual({ sync: true });
  });

  it('concurrency 传 0 时按归一化后的 1 串行执行', async () => {
    let active = 0;
    let peak = 0;

    await runBatchAnalysis({
      items: [{ id: 'a' }, { id: 'b' }],
      concurrency: 0,
      analyze: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return { ok: true };
      }
    });

    expect(peak).toBe(1);
  });

  it('未传 signal → cancelled=false；传入已取消 signal 且无数据 → cancelled=true', async () => {
    const normal = await runBatchAnalysis({ items: [{ id: 'a' }], analyze: async () => ({}) });
    expect(normal.cancelled).toBe(false);

    const controller = new AbortController();
    controller.abort();
    const empty = await runBatchAnalysis({ items: [], analyze: async () => ({}), signal: controller.signal });
    expect(empty.cancelled).toBe(true);
  });
});

describe('normalizeConcurrency 边界', () => {
  it('数字字符串可解析，Infinity 回落默认值', () => {
    expect(normalizeConcurrency('3')).toBe(3);
    expect(normalizeConcurrency('2.4')).toBe(2);
    expect(normalizeConcurrency(Infinity)).toBe(DEFAULT_BATCH_CONCURRENCY);
  });

  it('刚好等于上下限时保持原值', () => {
    expect(normalizeConcurrency(1)).toBe(1);
    expect(normalizeConcurrency(MAX_BATCH_CONCURRENCY)).toBe(MAX_BATCH_CONCURRENCY);
  });

  it('默认并发数与上限常量符合契约', () => {
    expect(DEFAULT_BATCH_CONCURRENCY).toBe(3);
    expect(MAX_BATCH_CONCURRENCY).toBe(5);
  });
});

describe('createDeepSeekProvider 补充契约', () => {
  it('完全无参调用 → 抛配置错误', () => {
    expect(() => createDeepSeekProvider()).toThrow('请先配置 DeepSeek API Key');
  });

  it('未注入 fetchImpl 时使用全局 fetch，默认 endpoint / model 生效', async () => {
    const fetchMock = vi.fn(async () => makeJsonResponse());
    vi.stubGlobal('fetch', fetchMock);

    const provider = createDeepSeekProvider({ apiKey: 'sk-global' });
    const result = await provider.analyze({ userContent: 'u', assistantContent: 'a' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(DEEPSEEK_ENDPOINT);
    const body = JSON.parse(options.body);
    expect(body.model).toBe(DEEPSEEK_DEFAULT_MODEL);
    expect(result).toEqual({ labels: ['accurate'], reason: 'ok' });
  });

  it('analyze 无参调用 → 用空字符串构造 prompt，不抛错', async () => {
    const fetchImpl = vi.fn(async () => makeJsonResponse());
    const provider = createDeepSeekProvider({ apiKey: 'sk-test', fetchImpl });

    await provider.analyze();

    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(body.messages[1].content).toBe(buildDeepSeekPrompt('', ''));
  });

  it('未知标签被过滤、reason 支持 analysis 字段回退', async () => {
    const fetchImpl = vi.fn(async () =>
      makeJsonResponse({ content: '{"labels":["accurate","unknown_label"],"analysis":"从 analysis 回退的理由"}' })
    );
    const provider = createDeepSeekProvider({ apiKey: 'sk-test', fetchImpl });

    const result = await provider.analyze({ userContent: 'u', assistantContent: 'a' });
    expect(result.labels).toEqual(['accurate']);
    expect(result.reason).toBe('从 analysis 回退的理由');
  });

  it('fetch 网络异常 → 错误向上抛出', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('network down');
    });
    const provider = createDeepSeekProvider({ apiKey: 'sk-test', fetchImpl });

    await expect(provider.analyze({ userContent: 'u', assistantContent: 'a' })).rejects.toThrow('network down');
  });

  it('provider 暴露传入的 model，默认 model 为 deepseek-chat', () => {
    expect(createDeepSeekProvider({ apiKey: 'k' }).model).toBe(DEEPSEEK_DEFAULT_MODEL);
    expect(createDeepSeekProvider({ apiKey: 'k', model: 'deepseek-reasoner' }).model).toBe('deepseek-reasoner');
  });
});

describe('Provider 注册表补充契约', () => {
  it('createProvider 默认创建 deepseek 且支持默认 model', () => {
    const provider = createProvider('deepseek', { apiKey: 'k' });
    expect(provider.id).toBe('deepseek');
    expect(provider.model).toBe(DEEPSEEK_DEFAULT_MODEL);
  });

  it('listProviders 每次返回新的数组，修改不影响注册表', () => {
    const first = listProviders();
    first.push({ id: 'fake' });
    expect(listProviders()).toHaveLength(1);
    expect(AI_PROVIDERS.fake).toBeUndefined();
  });
});

describe('src/lib/ai/index.js 统一出口', () => {
  it('批量能力与 providers 的导出与源模块是同一引用', () => {
    expect(aiIndex.runBatchAnalysis).toBe(batchModule.runBatchAnalysis);
    expect(aiIndex.normalizeConcurrency).toBe(batchModule.normalizeConcurrency);
    expect(aiIndex.DEFAULT_BATCH_CONCURRENCY).toBe(batchModule.DEFAULT_BATCH_CONCURRENCY);
    expect(aiIndex.MAX_BATCH_CONCURRENCY).toBe(batchModule.MAX_BATCH_CONCURRENCY);
    expect(aiIndex.createDeepSeekProvider).toBe(providersModule.createDeepSeekProvider);
    expect(aiIndex.createProvider).toBe(providersModule.createProvider);
    expect(aiIndex.listProviders).toBe(providersModule.listProviders);
    expect(aiIndex.AI_PROVIDERS).toBe(providersModule.AI_PROVIDERS);
  });
});
