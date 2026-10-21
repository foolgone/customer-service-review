/**
 * 数据验证模块单元测试：src/lib/parsers/validator.js
 *
 * 断言原则：以当前源码的实际行为为准（不为了让测试通过而修改源码）。
 * 若实际行为与预期规格不一致，会在用例名/注释与最终汇报中标注「疑似缺陷」。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validateConversation,
  validateFile,
  validateFieldMapping,
  normalizeConversation,
  validateConversations,
  checkDuplicates,
  validateAIResult,
  normalizeAIResult
} from '../../../../src/lib/parsers/validator';
import { createFile, makeConversation, JSON_MIME } from '../../../helpers/file';

// ---------------------------------------------------------------------------
// validateConversation
// ---------------------------------------------------------------------------
describe('validateConversation', () => {
  it('给定 null → 返回无效并报「对话数据必须是对象」', () => {
    const result = validateConversation(null);

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['对话数据必须是对象']);
  });

  it('给定非对象原始值（字符串/数字/undefined）→ 均报「对话数据必须是对象」', () => {
    for (const value of ['对话', 123, undefined]) {
      const result = validateConversation(value);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['对话数据必须是对象']);
    }
  });

  it('给定缺少 id 的对象 → 报「缺少对话 ID」', () => {
    const result = validateConversation({ turns: [{ role: 'user', content: '你好' }] });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['缺少对话 ID']);
  });

  it('给定 id 为空字符串 → 报「缺少对话 ID」', () => {
    const result = validateConversation({ id: '', turns: [{ role: 'user', content: '你好' }] });

    expect(result.errors).toEqual(['缺少对话 ID']);
  });

  it('给定 id 为非字符串（数字）→ 报「对话 ID 必须是字符串」', () => {
    const result = validateConversation({ id: 42, turns: [{ role: 'user', content: '你好' }] });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['对话 ID 必须是字符串']);
  });

  it('给定缺少 turns → 报「缺少对话内容（turns）」', () => {
    const result = validateConversation({ id: 'conv-1' });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['缺少对话内容（turns）']);
  });

  it('给定 turns 非数组（字符串/对象）→ 报「对话内容（turns）必须是数组」', () => {
    for (const turns of ['不是数组', { 0: { role: 'user', content: '你好' } }]) {
      const result = validateConversation({ id: 'conv-1', turns });
      expect(result.errors).toEqual(['对话内容（turns）必须是数组']);
    }
  });

  it('给定 turns 为空数组 → 报「对话内容不能为空」', () => {
    const result = validateConversation({ id: 'conv-1', turns: [] });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['对话内容不能为空']);
  });

  it('给定 turn 非对象（null/字符串）→ 报对应轮次「数据必须是对象」', () => {
    const result = validateConversation({ id: 'conv-1', turns: [null, '文本'] });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      '第 1 轮对话：数据必须是对象',
      '第 2 轮对话：数据必须是对象'
    ]);
  });

  it('给定 turn 缺少 role → 报「缺少角色（role）」', () => {
    const result = validateConversation({ id: 'conv-1', turns: [{ content: '你好' }] });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['第 1 轮对话：缺少角色（role）']);
  });

  it('给定 role 非法（system）→ 报「角色必须是 user 或 assistant」', () => {
    const result = validateConversation({
      id: 'conv-1',
      turns: [{ role: 'system', content: '你好' }]
    });

    expect(result.errors).toEqual(["第 1 轮对话：角色必须是 'user' 或 'assistant'"]);
  });

  it('给定 turn 缺少 content（undefined/null）→ 报「缺少内容（content）」', () => {
    for (const content of [undefined, null]) {
      const result = validateConversation({
        id: 'conv-1',
        turns: [{ role: 'user', content }]
      });
      expect(result.errors).toEqual(['第 1 轮对话：缺少内容（content）']);
    }
  });

  it('给定 content 非字符串（数字/对象）→ 报「内容必须是字符串」', () => {
    for (const content of [123, { text: '你好' }]) {
      const result = validateConversation({
        id: 'conv-1',
        turns: [{ role: 'user', content }]
      });
      expect(result.errors).toEqual(['第 1 轮对话：内容必须是字符串']);
    }
  });

  it('给定 content 全空白 → 报「内容不能为空」', () => {
    const result = validateConversation({
      id: 'conv-1',
      turns: [{ role: 'user', content: '   \n\t ' }]
    });

    expect(result.errors).toEqual(['第 1 轮对话：内容不能为空']);
  });

  it('给定合法对话 → 返回 { valid: true, errors: [] }', () => {
    const result = validateConversation(makeConversation('conv-1'));

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('给定多轮中多个错误 → 错误累积且带「第 N 轮对话」前缀', () => {
    const result = validateConversation({
      id: 'conv-1',
      turns: [
        { role: 'user', content: '正常内容' },
        { role: 'system', content: 42 },
        { content: '   ' }
      ]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual([
      "第 2 轮对话：角色必须是 'user' 或 'assistant'",
      '第 2 轮对话：内容必须是字符串',
      '第 3 轮对话：缺少角色（role）',
      '第 3 轮对话：内容不能为空'
    ]);
  });

  it('给定同时缺少 id 和 turns → 两个错误同时返回', () => {
    const result = validateConversation({});

    expect(result.errors).toEqual(['缺少对话 ID', '缺少对话内容（turns）']);
  });
});

// ---------------------------------------------------------------------------
// validateFile
// ---------------------------------------------------------------------------
describe('validateFile', () => {
  // 说明：validateFile 只读取 name/type/size 三个属性，因此可用普通对象模拟文件，
  // 以免受 jsdom File 构造函数对 size 的限制（size 由内容长度决定，无法构造 10MB+ 的轻量文件）。
  const fakeFile = (overrides = {}) => ({
    name: 'conversations.json',
    type: JSON_MIME,
    size: 1024,
    ...overrides
  });

  it('给定合法 JSON 文件 → 返回 { valid: true, error: null }', () => {
    const result = validateFile(createFile('[]', 'data.json', JSON_MIME));

    expect(result).toEqual({ valid: true, error: null });
  });

  it('给定空文件名 → 报「文件名不能为空」', () => {
    expect(validateFile(fakeFile({ name: '' }))).toEqual({
      valid: false,
      error: '文件名不能为空'
    });
  });

  it('给定文件名全空白 → 报「文件名不能为空」', () => {
    expect(validateFile(fakeFile({ name: '   ' })).error).toBe('文件名不能为空');
  });

  it('给定无扩展名文件名 → 报不支持的文件扩展名', () => {
    expect(validateFile(fakeFile({ name: 'conversations' })).error).toContain(
      '不支持的文件扩展名：.conversations'
    );
  });

  it('给定以点结尾、扩展名为空的文件名 → 报扩展名为 (无)', () => {
    expect(validateFile(fakeFile({ name: 'conversations.' })).error).toContain(
      '不支持的文件扩展名：.(无)'
    );
  });

  it('给定非法扩展名 .pdf → 报错并列出支持的扩展名', () => {
    const result = validateFile(fakeFile({ name: 'report.pdf', type: 'application/pdf' }));

    expect(result.valid).toBe(false);
    expect(result.error).toContain('不支持的文件扩展名：.pdf');
    expect(result.error).toContain('json, csv, xlsx, xls, txt');
  });

  it('给定大写扩展名 .JSON → 大小写不敏感，校验通过', () => {
    expect(validateFile(fakeFile({ name: 'DATA.JSON' }))).toEqual({
      valid: true,
      error: null
    });
  });

  it('给定文件大小超过默认 10MB → 报「文件过大」并给出实际/上限 MB', () => {
    const result = validateFile(fakeFile({ size: 11 * 1024 * 1024 }));

    expect(result.valid).toBe(false);
    expect(result.error).toContain('文件过大');
    expect(result.error).toContain('11.00 MB');
    expect(result.error).toContain('10.00 MB');
  });

  it('给定文件大小恰好等于上限 10MB → 校验通过', () => {
    expect(validateFile(fakeFile({ size: 10 * 1024 * 1024 })).valid).toBe(true);
  });

  it('给定 options.maxSize 缩小阈值 → 按自定义阈值报文件过大', () => {
    const result = validateFile(fakeFile({ size: 2048 }), { maxSize: 1024 });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('文件过大');
  });

  it('给定自定义 allowedExtensions/allowedTypes → 按自定义白名单放行', () => {
    const file = fakeFile({ name: 'report.pdf', type: 'application/pdf', size: 10 });
    const result = validateFile(file, {
      allowedExtensions: ['pdf'],
      allowedTypes: ['application/pdf'],
      maxSize: 1024
    });

    expect(result).toEqual({ valid: true, error: null });
  });

  it('给定自定义 allowedExtensions → 原有扩展名被拒绝且提示自定义白名单', () => {
    const result = validateFile(fakeFile({ name: 'data.json' }), {
      allowedExtensions: ['pdf']
    });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('不支持的文件扩展名：.json');
    expect(result.error).toContain('支持：pdf');
  });

  it('给定扩展名合法但 MIME 不在白名单 → 当前实现仅告警、仍校验通过（MIME 不作权威判断）', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = validateFile(fakeFile({ name: 'data.json', type: 'application/pdf' }));

    expect(result).toEqual({ valid: true, error: null });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('按扩展名处理');
  });

  it('显式传入 allowedTypes 且 MIME 不在白名单 → 严格拦截（BUG-04 已修复）', () => {
    const result = validateFile(
      { name: 'data.json', type: 'application/json', size: 10 },
      { allowedTypes: ['text/csv'] }
    );

    expect(result.valid).toBe(false);
    expect(result.error).toContain('不支持的文件类型：application/json');
  });

  it('给定允许内 MIME（text/plain + .txt）→ 校验通过且不告警', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = validateFile(fakeFile({ name: 'notes.txt', type: 'text/plain' }));

    expect(result.valid).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('给定 type 为空 → 跳过 MIME 告警直接通过', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = validateFile(fakeFile({ name: 'data.json', type: '' }));

    expect(result.valid).toBe(true);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('给定文件名与扩展名同时非法 → 校验顺序为「文件名 → 扩展名」，先报文件名', () => {
    const result = validateFile(fakeFile({ name: '   ', size: 20 * 1024 * 1024 }));

    expect(result.error).toBe('文件名不能为空');
  });

  it('给定超大文件但扩展名非法 → 先报扩展名错误（大小检查在扩展名之后）', () => {
    const result = validateFile(
      fakeFile({ name: 'report.pdf', type: 'application/pdf', size: 20 * 1024 * 1024 })
    );

    expect(result.error).toContain('不支持的文件扩展名：.pdf');
  });

  it('给定 file 为 null → 返回校验失败而非抛异常（BUG-13 已修复）', () => {
    expect(validateFile(null)).toEqual({ valid: false, error: '未选择文件' });
  });
});

// ---------------------------------------------------------------------------
// validateFieldMapping
// ---------------------------------------------------------------------------
describe('validateFieldMapping', () => {
  it('给定三字段齐全 → valid 且无错误', () => {
    expect(validateFieldMapping({ id: '编号', user: '用户', assistant: '客服' })).toEqual({
      valid: true,
      errors: []
    });
  });

  it('给定空对象 → 逐项报三个缺失字段', () => {
    expect(validateFieldMapping({})).toEqual({
      valid: false,
      errors: [
        '缺少必填字段映射：id',
        '缺少必填字段映射：user',
        '缺少必填字段映射：assistant'
      ]
    });
  });

  it('给定仅含 id 的映射 → 只报缺失的 user/assistant', () => {
    expect(validateFieldMapping({ id: '编号' }).errors).toEqual([
      '缺少必填字段映射：user',
      '缺少必填字段映射：assistant'
    ]);
  });

  it('给定字段值为空字符串 → 视为缺失', () => {
    expect(validateFieldMapping({ id: '', user: '用户', assistant: '客服' }).valid).toBe(false);
  });

  it('给定映射含额外字段 → 忽略额外字段，仍为合法', () => {
    expect(validateFieldMapping({ id: 'a', user: 'b', assistant: 'c', extra: 'x' }).valid).toBe(
      true
    );
  });
});

// ---------------------------------------------------------------------------
// normalizeConversation
// ---------------------------------------------------------------------------
describe('normalizeConversation', () => {
  it('给定缺少 id 的对话 → 自动补全 conv- 开头的字符串 id', () => {
    const normalized = normalizeConversation(makeConversation('conv-temp'));

    delete normalized.id;
    const again = normalizeConversation(normalized);
    expect(again.id).toMatch(/^conv-\d+-[a-z0-9]+$/);
    expect(typeof again.id).toBe('string');
  });

  it('给定数字 id → 转换为字符串', () => {
    const conversation = { id: 123, turns: [{ role: 'user', content: '你好' }] };

    const normalized = normalizeConversation(conversation);

    expect(normalized.id).toBe('123');
  });

  it('给定 turns 缺失 → 置为 [] 并返回 null（入参被原地修改）', () => {
    const conversation = { id: 'conv-1' };

    const normalized = normalizeConversation(conversation);

    expect(normalized).toBeNull();
    expect(conversation.turns).toEqual([]);
  });

  it('给定 turns 非数组 → 置为 [] 并返回 null', () => {
    const conversation = { id: 'conv-1', turns: '不是数组' };

    expect(normalizeConversation(conversation)).toBeNull();
    expect(conversation.turns).toEqual([]);
  });

  it('给定 turns 含非对象项 → 过滤后仅保留对象轮次', () => {
    const conversation = {
      id: 'conv-1',
      turns: [null, '文本', 42, { role: 'user', content: '你好' }]
    };

    const normalized = normalizeConversation(conversation);

    expect(normalized.turns).toEqual([{ role: 'user', content: '你好', timestamp: null }]);
  });

  it('给定 content 前后有空白 → 输出 trimmed 内容', () => {
    const conversation = {
      id: 'conv-1',
      turns: [{ role: 'assistant', content: '  您好，请问有什么可以帮您？  ' }]
    };

    expect(normalizeConversation(conversation).turns[0].content).toBe(
      '您好，请问有什么可以帮您？'
    );
  });

  it('给定 role/timestamp 缺失 → role 默认 user、timestamp 默认 null', () => {
    const normalized = normalizeConversation({
      id: 'conv-1',
      turns: [{ content: '你好' }]
    });

    expect(normalized.turns[0]).toEqual({ role: 'user', content: '你好', timestamp: null });
  });

  it('给定 timestamp → 原样保留', () => {
    const normalized = normalizeConversation({
      id: 'conv-1',
      turns: [{ role: 'user', content: '你好', timestamp: 1717000000000 }]
    });

    expect(normalized.turns[0].timestamp).toBe(1717000000000);
  });

  it('给定空/纯空白/0 的 content → 被过滤；数字内容保留为字符串', () => {
    const normalized = normalizeConversation({
      id: 'conv-1',
      turns: [
        { role: 'user', content: '' },
        { role: 'user', content: '   ' },
        { role: 'user', content: 0 },
        { role: 'user', content: 123 }
      ]
    });

    expect(normalized.turns).toEqual([{ role: 'user', content: '123', timestamp: null }]);
  });

  it('给定所有轮次内容为空 → 返回 null', () => {
    const conversation = {
      id: 'conv-1',
      turns: [
        { role: 'user', content: '' },
        { role: 'assistant', content: '   ' }
      ]
    };

    expect(normalizeConversation(conversation)).toBeNull();
  });

  it('给定 metadata → 做浅拷贝，不与原对象共享引用', () => {
    const metadata = { source: 'json', nested: { a: 1 } };
    const conversation = { id: 'conv-1', turns: [{ role: 'user', content: '你好' }], metadata };

    const normalized = normalizeConversation(conversation);

    expect(normalized.metadata).toEqual(metadata);
    expect(normalized.metadata).not.toBe(metadata);
    expect(normalized.metadata.nested).toBe(metadata.nested); // 浅拷贝
  });

  it('给定无 metadata → 不新增 metadata 字段', () => {
    const normalized = normalizeConversation({
      id: 'conv-1',
      turns: [{ role: 'user', content: '你好' }]
    });

    expect('metadata' in normalized).toBe(false);
  });

  it('给定对话对象 → 原地修改并返回同一引用', () => {
    const conversation = {
      id: 'conv-1',
      turns: [{ role: 'user', content: ' 你好 ' }]
    };

    const normalized = normalizeConversation(conversation);

    expect(normalized).toBe(conversation);
    expect(conversation.turns[0].content).toBe('你好');
  });
});

// ---------------------------------------------------------------------------
// validateConversations
// ---------------------------------------------------------------------------
describe('validateConversations', () => {
  it('给定非数组入参（null/字符串/对象）→ invalid 含 index:-1 与「数据必须是数组」', () => {
    for (const value of [null, '数据', {}]) {
      const result = validateConversations(value);

      expect(result.valid).toEqual([]);
      expect(result.invalid).toEqual([
        { index: -1, conversation: null, errors: ['数据必须是数组'] }
      ]);
    }
  });

  it('给定全合法数组 → 全部进入 valid，invalid 为空', () => {
    const result = validateConversations([makeConversation('a'), makeConversation('b')]);

    expect(result.invalid).toEqual([]);
    expect(result.valid).toHaveLength(2);
  });

  it('给定全合法数组 → valid 中的对话已完成 normalize（补 timestamp:null）', () => {
    const first = makeConversation('a', { metadata: { source: 'json' } });
    const result = validateConversations([first]);

    expect(result.valid[0].turns[0]).toEqual({ role: 'user', content: '用户问题', timestamp: null });
    expect(result.valid[0].metadata).toEqual({ source: 'json' });
    expect(result.valid[0]).toBe(first); // 原地标准化，保持引用
  });

  it('给定合法但内容为空白的对话 → invalid 报「标准化后对话无效（可能是内容为空）」', () => {
    // 通过 getter 让 content 在前 4 次读取（validateConversation 校验）返回合法值，
    // 之后（normalizeConversation 标准化）返回纯空白，从而覆盖「校验通过但标准化为空」分支。
    let reads = 0;
    const turn = { role: 'user' };
    Object.defineProperty(turn, 'content', {
      enumerable: true,
      get() {
        reads += 1;
        return reads <= 4 ? '看似合法' : '   ';
      }
    });
    const volatileConversation = { id: 'volatile', turns: [turn] };

    const result = validateConversations([volatileConversation]);

    expect(result.valid).toEqual([]);
    expect(result.invalid).toEqual([
      {
        index: 0,
        conversation: volatileConversation,
        errors: ['标准化后对话无效（可能是内容为空）']
      }
    ]);
  });

  it('给定合法与非法混合 → 保留 valid，非法项带 index 与 errors', () => {
    const bad = { id: 'bad' };
    const result = validateConversations([makeConversation('ok-1'), bad, makeConversation('ok-2')]);

    expect(result.valid.map(conv => conv.id)).toEqual(['ok-1', 'ok-2']);
    expect(result.invalid).toEqual([
      { index: 1, conversation: bad, errors: ['缺少对话内容（turns）'] }
    ]);
  });

  it('给定空数组 → valid/invalid 均为空数组', () => {
    expect(validateConversations([])).toEqual({ valid: [], invalid: [] });
  });
});

// ---------------------------------------------------------------------------
// checkDuplicates
// ---------------------------------------------------------------------------
describe('checkDuplicates', () => {
  it('给定无重复 id → unique 全保留、duplicates 为空', () => {
    const result = checkDuplicates([
      makeConversation('a'),
      makeConversation('b'),
      makeConversation('c')
    ]);

    expect(result.unique.map(conv => conv.id)).toEqual(['a', 'b', 'c']);
    expect(result.duplicates).toEqual([]);
  });

  it('给定重复 id → unique 保留首次出现、duplicates 记录 id 与出现次数', () => {
    const first = makeConversation('dup');
    const second = makeConversation('dup');
    const other = makeConversation('only');

    const result = checkDuplicates([first, other, second, second]);

    expect(result.unique.map(conv => conv.id)).toEqual(['dup', 'only']);
    expect(result.unique[0]).toBe(first); // 首次出现的引用
    expect(result.duplicates).toEqual([{ id: 'dup', count: 3 }]);
  });

  it('给定多个不同重复 id → duplicates 逐项返回', () => {
    const result = checkDuplicates([
      makeConversation('a'),
      makeConversation('a'),
      makeConversation('b'),
      makeConversation('b')
    ]);

    expect(result.duplicates).toEqual([
      { id: 'a', count: 2 },
      { id: 'b', count: 2 }
    ]);
  });

  it('给定空数组 → unique/duplicates 均为空', () => {
    expect(checkDuplicates([])).toEqual({ unique: [], duplicates: [] });
  });

  it('给定缺少 id 的对话 → 全部归为 undefined 重复（当前实现的边界行为）', () => {
    const result = checkDuplicates([{ turns: [] }, { turns: [] }]);

    expect(result.unique).toHaveLength(1);
    expect(result.duplicates).toEqual([{ id: undefined, count: 2 }]);
  });
});

// ---------------------------------------------------------------------------
// validateAIResult
// ---------------------------------------------------------------------------
describe('validateAIResult', () => {
  it('给定 null/字符串/数字 → 报「不是对象」', () => {
    for (const value of [null, '结果', 42]) {
      expect(validateAIResult(value)).toEqual({
        valid: false,
        error: 'AI 返回数据格式错误：不是对象'
      });
    }
  });

  it('给定数组（typeof 为 object）→ 报缺少 labels（当前实现行为）', () => {
    expect(validateAIResult([])).toEqual({
      valid: false,
      error: 'AI 返回数据缺少 labels 字段'
    });
  });

  it('给定缺少 labels → 报「缺少 labels 字段」', () => {
    expect(validateAIResult({ reason: '无标签' }).error).toBe('AI 返回数据缺少 labels 字段');
  });

  it('给定 labels 非数组 → 报「labels 必须是数组」', () => {
    expect(validateAIResult({ labels: 'accurate' }).error).toBe(
      'AI 返回的 labels 必须是数组'
    );
  });

  it('给定未知标签 → 报「未知标签」并带出标签值', () => {
    expect(validateAIResult({ labels: ['accurate', 'unknown_label'] }).error).toBe(
      'AI 返回了未知标签：unknown_label'
    );
  });

  it('给定 confidence 非数字 → 报置信度错误', () => {
    for (const confidence of ['80', null, {}]) {
      expect(validateAIResult({ labels: [], confidence }).error).toBe(
        'AI 置信度必须是 0-100 之间的数字'
      );
    }
  });

  it('给定 confidence 超出 0-100 → 报置信度错误', () => {
    expect(validateAIResult({ labels: [], confidence: -1 }).error).toBe(
      'AI 置信度必须是 0-100 之间的数字'
    );
    expect(validateAIResult({ labels: [], confidence: 101 }).error).toBe(
      'AI 置信度必须是 0-100 之间的数字'
    );
  });

  it('给定 confidence 边界值 0/100 → 合法', () => {
    expect(validateAIResult({ labels: [], confidence: 0 }).valid).toBe(true);
    expect(validateAIResult({ labels: [], confidence: 100 }).valid).toBe(true);
  });

  it('给定 severity 非法 → 报「low/medium/high」', () => {
    expect(validateAIResult({ labels: [], severity: 'urgent' }).error).toBe(
      'AI 严重程度必须是 low/medium/high'
    );
    expect(validateAIResult({ labels: [], severity: null }).error).toBe(
      'AI 严重程度必须是 low/medium/high'
    );
  });

  it('给定 confidence/severity 缺省 → 合法', () => {
    expect(validateAIResult({ labels: ['accurate'] })).toEqual({ valid: true, error: null });
  });

  it('给定全部合法（含合法标签与 severity）→ valid:true', () => {
    const result = validateAIResult({
      labels: ['accurate', 'incomplete'],
      confidence: 88,
      severity: 'medium'
    });

    expect(result).toEqual({ valid: true, error: null });
  });
});

// ---------------------------------------------------------------------------
// normalizeAIResult
// ---------------------------------------------------------------------------
describe('normalizeAIResult', () => {
  it('给定空对象 → 补全全部缺省值', () => {
    expect(normalizeAIResult({})).toEqual({
      labels: [],
      reason: '',
      confidence: 0,
      severity: 'low',
      suggestions: [],
      positiveAspects: []
    });
  });

  it('给定 positive_aspects（下划线命名）→ 映射到 positiveAspects', () => {
    expect(normalizeAIResult({ positive_aspects: ['回复及时'] }).positiveAspects).toEqual([
      '回复及时'
    ]);
  });

  it('给定 positiveAspects（驼峰命名）→ 保留', () => {
    expect(normalizeAIResult({ positiveAspects: ['态度友好'] }).positiveAspects).toEqual([
      '态度友好'
    ]);
  });

  it('给定两种命名同时存在 → 以下划线命名为准', () => {
    expect(
      normalizeAIResult({ positive_aspects: ['下划线'], positiveAspects: ['驼峰'] }).positiveAspects
    ).toEqual(['下划线']);
  });

  it('给定已有字段 → 原样透传，且丢弃未知字段', () => {
    const normalized = normalizeAIResult({
      labels: ['risky'],
      reason: '回复存在风险',
      confidence: 85,
      severity: 'high',
      suggestions: ['补充说明'],
      extra: '丢弃'
    });

    expect(normalized).toEqual({
      labels: ['risky'],
      reason: '回复存在风险',
      confidence: 85,
      severity: 'high',
      suggestions: ['补充说明'],
      positiveAspects: []
    });
    expect('extra' in normalized).toBe(false);
  });

  it('给定 confidence 为 0 → 保持 0（不因 || 被替换）', () => {
    expect(normalizeAIResult({ confidence: 0 }).confidence).toBe(0);
  });

  it('给定 falsy 值（reason 空串等）→ 保持缺省值', () => {
    const normalized = normalizeAIResult({ reason: '', labels: null, suggestions: null });

    expect(normalized.reason).toBe('');
    expect(normalized.labels).toEqual([]);
    expect(normalized.suggestions).toEqual([]);
  });
});
