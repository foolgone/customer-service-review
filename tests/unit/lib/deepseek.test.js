/**
 * src/lib/deepseek.js 单元测试
 * 覆盖：提示词构造、AI 响应解析（JSON/围栏/夹带文字/异常）、API 调用
 *      （鉴权、请求体、成功/失败/空内容/网络错误）
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildDeepSeekPrompt,
  parseDeepSeekResponse,
  analyzeWithDeepSeek
} from '../../../src/lib/deepseek.js';
import { DEEPSEEK_ENDPOINT, DEEPSEEK_DEFAULT_MODEL } from '../../../src/lib/constants.js';

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

describe('buildDeepSeekPrompt', () => {
  it('包含用户原文、客服原文与 6 个标签说明', () => {
    const prompt = buildDeepSeekPrompt('我的快递没收到', '已为您联系快递核实');

    expect(prompt).toContain('我的快递没收到');
    expect(prompt).toContain('已为您联系快递核实');
    expect(prompt).toContain('客服质检专家');
    ['accurate', 'off_topic', 'hallucination', 'impolite', 'incomplete', 'risky'].forEach(
      (label) => expect(prompt).toContain(label)
    );
  });

  it('提示词要求只返回 labels/reason 的 JSON 结构', () => {
    const prompt = buildDeepSeekPrompt('u', 'a');
    expect(prompt).toContain('"labels"');
    expect(prompt).toContain('"reason"');
  });
});

describe('parseDeepSeekResponse', () => {
  it('标准 JSON → 解析出 labels 与 reason', () => {
    expect(
      parseDeepSeekResponse('{"labels":["accurate","risky"],"reason":"回复准确"}')
    ).toEqual({ labels: ['accurate', 'risky'], reason: '回复准确' });
  });

  it('```json 围栏包裹 → 可正确解析', () => {
    const content = '```json\n{"labels":["accurate"],"reason":"ok"}\n```';
    expect(parseDeepSeekResponse(content)).toEqual({ labels: ['accurate'], reason: 'ok' });
  });

  it('无语言标识的 ``` 围栏 → 也可正确解析', () => {
    const content = '```\n{"labels":["risky"],"reason":"风险"}\n```';
    expect(parseDeepSeekResponse(content)).toEqual({ labels: ['risky'], reason: '风险' });
  });

  it('前后夹带解释文字 → 提取第一个 { 到最后一个 } 后解析', () => {
    const content = '分析如下：{"labels":["risky"],"reason":"风险内容"} 以上为建议。';
    expect(parseDeepSeekResponse(content)).toEqual({ labels: ['risky'], reason: '风险内容' });
  });

  it('未知标签与非字符串标签被过滤', () => {
    const content = '{"labels":["accurate","unknown-label",123,"risky"],"reason":"x"}';
    expect(parseDeepSeekResponse(content)).toEqual({ labels: ['accurate', 'risky'], reason: 'x' });
  });

  it('labels 不是数组 → 返回空数组', () => {
    expect(parseDeepSeekResponse('{"labels":"accurate","reason":"x"}').labels).toEqual([]);
    expect(parseDeepSeekResponse('{"reason":"x"}').labels).toEqual([]);
  });

  it('reason 缺失时回退 analysis / explanation / comment', () => {
    expect(parseDeepSeekResponse('{"labels":[],"analysis":"分析原因"}').reason).toBe('分析原因');
    expect(parseDeepSeekResponse('{"labels":[],"explanation":"解释内容"}').reason).toBe('解释内容');
    expect(parseDeepSeekResponse('{"labels":[],"comment":"评论内容"}').reason).toBe('评论内容');
  });

  it('reason 优先于其他回退字段', () => {
    const content = '{"labels":[],"reason":"首选","analysis":"次选"}';
    expect(parseDeepSeekResponse(content).reason).toBe('首选');
  });

  it('reason 为空白字符串 → 继续回退到后续字段', () => {
    const content = '{"labels":[],"reason":"   ","comment":"兜底"}';
    expect(parseDeepSeekResponse(content).reason).toBe('兜底');
  });

  it('没有可用 reason 字段 → 返回空字符串', () => {
    expect(parseDeepSeekResponse('{"labels":[]}').reason).toBe('');
    expect(parseDeepSeekResponse('{"labels":[],"reason":123}').reason).toBe('');
    expect(parseDeepSeekResponse('{"labels":[],"reason":"   "}').reason).toBe('');
  });

  it('非法 JSON → 抛出解析错误', () => {
    expect(() => parseDeepSeekResponse('not a json')).toThrow();
    expect(() => parseDeepSeekResponse('{"labels":')).toThrow();
  });
});

describe('analyzeWithDeepSeek：参数校验', () => {
  it('未传 apiKey → reject「请先配置 DeepSeek API Key」，不发起请求', async () => {
    const fetchMock = stubFetch();

    await expect(
      analyzeWithDeepSeek({ userContent: 'u', assistantContent: 'a' })
    ).rejects.toThrow('请先配置 DeepSeek API Key');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('apiKey 为空字符串 → 同样 reject，不发起请求', async () => {
    const fetchMock = stubFetch();

    await expect(
      analyzeWithDeepSeek({ apiKey: '', userContent: 'u', assistantContent: 'a' })
    ).rejects.toThrow('请先配置 DeepSeek API Key');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('analyzeWithDeepSeek：成功调用', () => {
  it('请求 URL / method / Authorization / body 结构正确，返回 {labels, reason}', async () => {
    const fetchMock = stubFetch(async () =>
      okResponse('{"labels":["accurate"],"reason":"回复准确"}')
    );

    const result = await analyzeWithDeepSeek({
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
    expect(typeof body.messages[0].content).toBe('string');
    expect(body.messages[0].content.length).toBeGreaterThan(0);
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toContain('用户的问题');
    expect(body.messages[1].content).toContain('客服的回复');
  });

  it('传入自定义 model → 请求体中 model 使用自定义值', async () => {
    const fetchMock = stubFetch(async () =>
      okResponse('{"labels":[],"reason":""}')
    );

    await analyzeWithDeepSeek({
      apiKey: 'sk-test-key',
      userContent: 'u',
      assistantContent: 'a',
      model: 'deepseek-reasoner'
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('deepseek-reasoner');
  });
});

describe('analyzeWithDeepSeek：异常分支', () => {
  it('response.ok 为 false → 抛错并包含状态码与响应文本', async () => {
    const fetchMock = stubFetch(async () => ({
      ok: false,
      status: 502,
      text: async () => 'Bad Gateway'
    }));

    await expect(
      analyzeWithDeepSeek({ apiKey: 'sk-test-key', userContent: 'u', assistantContent: 'a' })
    ).rejects.toThrow('DeepSeek 请求失败：502 Bad Gateway');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('choices 为空数组 → 抛「DeepSeek 返回内容为空」', async () => {
    stubFetch(async () => ({ ok: true, status: 200, json: async () => ({ choices: [] }) }));

    await expect(
      analyzeWithDeepSeek({ apiKey: 'sk-test-key', userContent: 'u', assistantContent: 'a' })
    ).rejects.toThrow('DeepSeek 返回内容为空');
  });

  it('响应缺少 choices → 抛「DeepSeek 返回内容为空」', async () => {
    stubFetch(async () => ({ ok: true, status: 200, json: async () => ({}) }));

    await expect(
      analyzeWithDeepSeek({ apiKey: 'sk-test-key', userContent: 'u', assistantContent: 'a' })
    ).rejects.toThrow('DeepSeek 返回内容为空');
  });

  it('content 为空字符串 → 抛「DeepSeek 返回内容为空」', async () => {
    stubFetch(async () => okResponse(''));

    await expect(
      analyzeWithDeepSeek({ apiKey: 'sk-test-key', userContent: 'u', assistantContent: 'a' })
    ).rejects.toThrow('DeepSeek 返回内容为空');
  });

  it('fetch 网络异常 → 错误向上抛出', async () => {
    stubFetch(async () => {
      throw new Error('network down');
    });

    await expect(
      analyzeWithDeepSeek({ apiKey: 'sk-test-key', userContent: 'u', assistantContent: 'a' })
    ).rejects.toThrow('network down');
  });

  it('模型返回非法 JSON → 解析错误向上抛出', async () => {
    stubFetch(async () => okResponse('模型没有按要求输出'));

    await expect(
      analyzeWithDeepSeek({ apiKey: 'sk-test-key', userContent: 'u', assistantContent: 'a' })
    ).rejects.toThrow();
  });
});
