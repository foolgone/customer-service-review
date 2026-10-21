/**
 * src/lib/ai/providers.js 单元测试
 * 覆盖：DeepSeek Provider 请求构造、响应解析、错误分支，以及 Provider 注册表
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createDeepSeekProvider,
  createProvider,
  listProviders,
  AI_PROVIDERS
} from '../../../../src/lib/ai/providers.js';
import { buildDeepSeekPrompt } from '../../../../src/lib/deepseek.js';

function createFetchMock({ ok = true, status = 200, content = '{"labels":["accurate"],"reason":"回复准确"}', text = '' } = {}) {
  return vi.fn(async () => ({
    ok,
    status,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => text
  }));
}

describe('createDeepSeekProvider', () => {
  it('缺少 apiKey → 抛错', () => {
    expect(() => createDeepSeekProvider({})).toThrow('请先配置 DeepSeek API Key');
  });

  it('正常调用 → 请求构造正确且解析出 labels / reason', async () => {
    const fetchImpl = createFetchMock();
    const provider = createDeepSeekProvider({ apiKey: 'sk-test', fetchImpl });

    expect(provider.id).toBe('deepseek');
    expect(provider.label).toBe('DeepSeek');

    const result = await provider.analyze({ userContent: '能退款吗', assistantContent: '可以退款' });

    expect(result).toEqual({ labels: ['accurate'], reason: '回复准确' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toContain('api.deepseek.com');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer sk-test');
    expect(options.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(options.body);
    expect(body.model).toBe('deepseek-chat');
    expect(body.temperature).toBe(0);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].content).toBe(buildDeepSeekPrompt('能退款吗', '可以退款'));
  });

  it('自定义 model / endpoint 会生效', async () => {
    const fetchImpl = createFetchMock();
    const provider = createDeepSeekProvider({
      apiKey: 'sk-test',
      model: 'deepseek-reasoner',
      endpoint: 'https://example.com/v1/chat',
      fetchImpl
    });

    await provider.analyze({ userContent: 'u', assistantContent: 'a' });

    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://example.com/v1/chat');
    expect(JSON.parse(options.body).model).toBe('deepseek-reasoner');
  });

  it('HTTP 非 2xx → 抛出含状态码与响应文本的错误', async () => {
    const fetchImpl = createFetchMock({ ok: false, status: 401, text: 'unauthorized' });
    const provider = createDeepSeekProvider({ apiKey: 'sk-bad', fetchImpl });

    await expect(provider.analyze({ userContent: 'u', assistantContent: 'a' })).rejects.toThrow(
      'DeepSeek 请求失败：401 unauthorized'
    );
  });

  it('返回内容为空 → 抛错', async () => {
    const fetchImpl = createFetchMock({ content: '' });
    const provider = createDeepSeekProvider({ apiKey: 'sk-test', fetchImpl });

    await expect(provider.analyze({ userContent: 'u', assistantContent: 'a' })).rejects.toThrow(
      'DeepSeek 返回内容为空'
    );
  });

  it('模型返回非法 JSON → 抛错（沿用 parseDeepSeekResponse 解析）', async () => {
    const fetchImpl = createFetchMock({ content: '我无法判断' });
    const provider = createDeepSeekProvider({ apiKey: 'sk-test', fetchImpl });

    await expect(provider.analyze({ userContent: 'u', assistantContent: 'a' })).rejects.toThrow();
  });
});

describe('Provider 注册表', () => {
  it('listProviders 返回不含 create 的元信息', () => {
    const providers = listProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({ id: 'deepseek', label: 'DeepSeek', defaultModel: 'deepseek-chat' });
    expect(providers[0].create).toBeUndefined();
  });

  it('createProvider 按 id 创建实例；未知 id 报错', () => {
    const provider = createProvider('deepseek', { apiKey: 'sk-test', fetchImpl: createFetchMock() });
    expect(provider.id).toBe('deepseek');

    expect(() => createProvider('unknown', { apiKey: 'sk-test' })).toThrow('不支持的 AI 服务商：unknown');
  });

  it('AI_PROVIDERS 中的 create 与具名导出一致', () => {
    expect(AI_PROVIDERS.deepseek.create).toBe(createDeepSeekProvider);
  });
});
