/**
 * JSON 解析器单元测试：src/lib/parsers/json.js
 */
import { describe, it, expect } from 'vitest';
import { parseJSON } from '../../../../src/lib/parsers/json';
import { createFile, createJsonFile, makeConversation, JSON_MIME } from '../../../helpers/file';

describe('parseJSON', () => {
  it('给定对话数组格式 → 解析成功且数据完成标准化', async () => {
    const file = createJsonFile([
      makeConversation('001'),
      makeConversation('002', { metadata: { source: 'json' } })
    ]);

    const result = await parseJSON(file);

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe('001');
    expect(result.data[0].turns[0]).toEqual({
      role: 'user',
      content: '用户问题',
      timestamp: null
    });
    expect(result.data[1].metadata).toEqual({ source: 'json' });
  });

  it('给定单对象 {id, turns} → 解析为一条对话', async () => {
    const result = await parseJSON(createJsonFile(makeConversation('single')));

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('single');
  });

  it('给定包装格式 {conversations: [...]} → 解析成功', async () => {
    const result = await parseJSON(
      createJsonFile({ conversations: [makeConversation('a'), makeConversation('b')] })
    );

    expect(result.success).toBe(true);
    expect(result.data.map(conv => conv.id)).toEqual(['a', 'b']);
  });

  it('给定包装格式 {data: [...]} → 解析成功', async () => {
    const result = await parseJSON(createJsonFile({ data: [makeConversation('c')] }));

    expect(result.success).toBe(true);
    expect(result.data.map(conv => conv.id)).toEqual(['c']);
  });

  it('给定空数组 → 解析成功但数据为空', async () => {
    const result = await parseJSON(createJsonFile([]));

    expect(result).toEqual({ success: true, data: [], errors: [] });
  });

  it('给定非法 JSON 文本 → 失败且错误含「JSON 格式错误」', async () => {
    const file = createFile('{ "id": "001", ', 'broken.json', JSON_MIME);

    const result = await parseJSON(file);

    expect(result.success).toBe(false);
    expect(result.data).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('JSON 格式错误');
  });

  it('给定不支持的包装对象 {foo:"bar"} → 失败且提示格式不符合要求', async () => {
    const result = await parseJSON(createJsonFile({ foo: 'bar' }));

    expect(result.success).toBe(false);
    expect(result.data).toEqual([]);
    expect(result.errors[0]).toContain('JSON 格式不符合要求');
  });

  it('给定单对象但缺少 turns → 交给验证器报「缺少对话内容（turns）」（BUG-07 已修复）', async () => {
    const result = await parseJSON(createJsonFile({ id: 'only-id' }));

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
    expect(result.errors).toEqual(['第 1 条对话：缺少对话内容（turns）']);
  });

  it('给定单对象但 turns 为空数组 → 作为对话校验并报第 1 条错误', async () => {
    const result = await parseJSON(createJsonFile({ id: 'empty-turns', turns: [] }));

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
    expect(result.errors).toEqual(['第 1 条对话：对话内容不能为空']);
  });

  it('给定原始值 JSON（123 / null / "hello"）→ 失败且提示「JSON 数据格式错误」', async () => {
    for (const raw of ['123', 'null', '"hello"']) {
      const result = await parseJSON(createFile(raw, 'raw.json', JSON_MIME));

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(['JSON 数据格式错误']);
    }
  });

  it('给定数组中部分非法对话 → success 仍为 true，errors 标注第 N 条，data 仅含合法项', async () => {
    const file = createJsonFile([
      makeConversation('ok-1'),
      { id: 'bad' }, // 缺少 turns
      { id: 123, turns: [{ role: 'user', content: '你好' }] }, // id 非字符串
      makeConversation('ok-2')
    ]);

    const result = await parseJSON(file);

    expect(result.success).toBe(true);
    expect(result.data.map(conv => conv.id)).toEqual(['ok-1', 'ok-2']);
    expect(result.errors).toEqual([
      '第 2 条对话：缺少对话内容（turns）',
      '第 3 条对话：对话 ID 必须是字符串'
    ]);
  });

  it('给定文件读取抛错 → 失败且错误含「解析失败」', async () => {
    const file = {
      name: 'unreadable.json',
      text: async () => {
        throw new Error('boom');
      }
    };

    const result = await parseJSON(file);

    expect(result).toEqual({
      success: false,
      data: [],
      errors: ['解析失败：boom']
    });
  });
});
