/**
 * src/lib/ai/analyze.js 单元测试
 * 单条分析统一入口：走 Provider 抽象，验证参数校验、请求构造、错误分支与依赖注入。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { analyzeConversation } from '../../../../src/lib/ai/analyze.js';
import { DEEPSEEK_ENDPOINT, DEEPSEEK_DEFAULT_MODEL } from '../../../../src/lib/constants.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function stubFetch(implementation) {
  const fetchMock = vi.fn(implementation);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function okResponse(content) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] })
  };
}

describe('analyzeConversation：参数校验', () => {
  it('未传 apiKey → reject「请先配置 DeepSeek API Key」，不发起请求', async () => {
    const fetchMock = stubFetch();

    await expect(analyzeConversation({ userContent: 'u', assistantContent: 'a' })).rejects.toThrow(
      '请先配置 DeepSeek API Key'
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('apiKey 为空字符串 → 同样 reject，不发起请求', async () => {
    const fetchMock = stubFetch();

    await expect(
      analyzeConversation({ apiKey: '', userContent: 'u', assistantContent: 'a' })
    ).rejects.toThrow('请先配置 DeepSeek API Key');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('未知 providerId → 抛出不支持的服务商', async () => {
    await expect(
      analyzeConversation({ apiKey: 'sk-test', providerId: 'openai', userContent: 'u', assistantContent: 'a' })
    ).rejects.toThrow('不支持的 AI 服务商：openai');
  });
});

describe('analyzeConversation：成功调用', () => {
  it('请求 URL / method / Authorization / body 结构正确，返回 {labels, reason}', async () => {
    const fetchMock = stubFetch(async () => okResponse('{"labels":["accurate"],"reason":"回复准确"}'));

    const result = await analyzeConversation({
      apiKey: 'sk-test-key',
      userContent: '用户的问题',
      assistantContent: '客服的回复'
    });

    expect(result).toEqual({ labels: ['accurate'], reason: '回复准确' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(DEEPSEEK_ENDPOINT);
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.headers.Authorization).toBe('Bearer sk-test-key');

    const body = JSON.parse(options.body);
    expect(body.model).toBe(DEEPSEEK_DEFAULT_MODEL);
    expect(body.model).toBe('deepseek-chat');
    expect(body.temperature).toBe(0);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toContain('用户的问题');
    expect(body.messages[1].content).toContain('客服的回复');
  });

  it('传入自定义 model → 请求体中 model 使用自定义值', async () => {
    const fetchMock = stubFetch(async () => okResponse('{"labels":[],"reason":""}'));

    await analyzeConversation({
      apiKey: 'sk-test-key',
      userContent: 'u',
      assistantContent: 'a',
      model: 'deepseek-reasoner'
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('deepseek-reasoner');
  });

  it('支持注入 fetchImpl（App 不传，测试/其他调用方可替换）', async () => {
    const fetchImpl = vi.fn(async () => okResponse('{"labels":["risky"],"reason":"风险"}'));

    const result = await analyzeConversation({
      apiKey: 'sk-test',
      userContent: 'u',
      assistantContent: 'a',
      fetchImpl
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.labels).toEqual(['risky']);
  });
});

describe('analyzeConversation：异常分支', () => {
  it('response.ok 为 false → 抛错并包含状态码与响应文本', async () => {
    const fetchMock = stubFetch(async () => ({
      ok: false,
      status: 502,
      text: async () => 'Bad Gateway'
    }));

    await expect(
      analyzeConversation({ apiKey: 'sk-test-key', userContent: 'u', assistantContent: 'a' })
    ).rejects.toThrow('DeepSeek 请求失败：502 Bad Gateway');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('choices 为空数组 → 抛「DeepSeek 返回内容为空」', async () => {
    stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ choices: [] }) }));

    await expect(
      analyzeConversation({ apiKey: 'sk-test-key', userContent: 'u', assistantContent: 'a' })
    ).rejects.toThrow('DeepSeek 返回内容为空');
  });

  it('content 为空字符串 → 抛「DeepSeek 返回内容为空」', async () => {
    stubFetch(async () => okResponse(''));

    await expect(
      analyzeConversation({ apiKey: 'sk-test-key', userContent: 'u', assistantContent: 'a' })
    ).rejects.toThrow('DeepSeek 返回内容为空');
  });

  it('fetch 网络异常 → 错误向上抛出', async () => {
    stubFetch(async () => {
      throw new Error('network down');
    });

    await expect(
      analyzeConversation({ apiKey: 'sk-test-key', userContent: 'u', assistantContent: 'a' })
    ).rejects.toThrow('network down');
  });

  it('模型返回非法 JSON → 解析错误向上抛出', async () => {
    stubFetch(async () => okResponse('模型没有按要求输出'));

    await expect(
      analyzeConversation({ apiKey: 'sk-test-key', userContent: 'u', assistantContent: 'a' })
    ).rejects.toThrow();
  });
});
