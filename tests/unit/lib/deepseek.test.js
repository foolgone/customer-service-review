/**
 * src/lib/deepseek.js 单元测试
 * 覆盖：提示词构造、AI 响应解析（JSON / 围栏 / 夹带文字 / 异常）。
 * 请求发送与错误分支在 src/lib/ai/providers.js 与 ai/analyze.js 的测试中覆盖。
 */
import { describe, it, expect } from 'vitest';
import { buildDeepSeekPrompt, parseDeepSeekResponse } from '../../../src/lib/deepseek.js';

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
