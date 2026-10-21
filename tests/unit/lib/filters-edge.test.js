/**
 * src/lib/filters.js 边界与契约补充测试
 * 开发已有 filters.test.js 覆盖主路径，本文件补：
 * - 归一化的脏数据与非法类型
 * - 关键词 trim / 大小写 / 特殊字符 / 仅客服回复命中
 * - 标签字符串兼容、aiLabels 非数组的防御行为
 * - 统计口径（reviewedAt-only、labels-only、未知 ID、缺 turns）
 * - 分页边界（字符串页码、小数页码、越界、每页 1 条）
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  STATUS_OPTIONS,
  normalizeFilters,
  hasActiveFilters,
  filterConversations,
  summarizeConversations,
  paginate
} from '../../../src/lib/filters.js';

const conversations = [
  {
    id: '001',
    turns: [
      { role: 'user', content: '蓝牙耳机左耳没声音，能退款吗' },
      { role: 'assistant', content: '7 天内可申请退款（政策 A）' }
    ]
  },
  {
    id: 'ABC-002',
    turns: [
      { role: 'user', content: 'My package shows delivered' },
      { role: 'assistant', content: '建议先查门卫和快递柜' }
    ]
  },
  { id: '003', turns: [{ role: 'assistant', content: '只有客服消息的对话' }] },
  { id: '004' }
];

const annotations = {
  '001': { labels: ['accurate'], score: 5, reviewedAt: '2026-10-21T08:00:00.000Z' },
  'ABC-002': { labels: 'risky|incomplete', score: 2 },
  '003': { labels: [], score: 3, aiLabels: ['accurate'], aiReason: '准确' },
  '004': { reviewedAt: '2026-10-21T09:00:00.000Z' }
};

describe('normalizeFilters 脏数据', () => {
  it('非字符串 keyword 归空、非数组 labels/scores 归空、非法 status 回落 all', () => {
    expect(normalizeFilters({ keyword: 123, labels: 'risky', scores: '5', status: 'deprecated' })).toEqual({
      keyword: '',
      labels: [],
      scores: [],
      status: DEFAULT_FILTERS.status
    });
    expect(normalizeFilters({ keyword: null })).toEqual(DEFAULT_FILTERS);
  });

  it('labels 过滤非字符串、scores 数字字符串转换并过滤 NaN/Infinity', () => {
    const normalized = normalizeFilters({ labels: ['risky', 1, null, 'accurate'], scores: ['2', 'abc', NaN, Infinity, 3] });

    expect(normalized.labels).toEqual(['risky', 'accurate']);
    expect(normalized.scores).toEqual([2, 3]);
  });

  it('不修改入参', () => {
    const input = { keyword: ' x ', labels: ['risky'], scores: [5] };
    normalizeFilters(input);
    expect(input).toEqual({ keyword: ' x ', labels: ['risky'], scores: [5] });
  });
});

describe('hasActiveFilters 边界', () => {
  it('仅空白关键词不生效；仅有 status=all 不生效', () => {
    expect(hasActiveFilters({ keyword: '   ', labels: [], scores: [], status: 'all' })).toBe(false);
  });

  it('任一条件生效即为 true（含评分 0）', () => {
    expect(hasActiveFilters({ status: 'ai' })).toBe(true);
    expect(hasActiveFilters({ scores: [0] })).toBe(true);
    expect(hasActiveFilters({ keyword: ' ', labels: ['risky'] })).toBe(true);
  });
});

describe('filterConversations 边界', () => {
  it('关键词去除首尾空格、大小写不敏感，且能命中对话 ID', () => {
    expect(filterConversations(conversations, annotations, { keyword: '  退款  ' }).map((item) => item.id)).toEqual(['001']);
    expect(filterConversations(conversations, annotations, { keyword: 'abc-002' }).map((item) => item.id)).toEqual(['ABC-002']);
    expect(filterConversations(conversations, annotations, { keyword: 'PACKAGE' }).map((item) => item.id)).toEqual(['ABC-002']);
  });

  it('关键词按字面匹配（正则特殊字符不报错）', () => {
    expect(filterConversations(conversations, annotations, { keyword: '（政策 A）' }).map((item) => item.id)).toEqual(['001']);
    expect(filterConversations(conversations, annotations, { keyword: '.*' })).toEqual([]);
  });

  it('仅命中客服回复、缺 turns 的对话也可被关键词/ID 搜索', () => {
    expect(filterConversations(conversations, annotations, { keyword: '只有客服消息' }).map((item) => item.id)).toEqual(['003']);
    expect(filterConversations(conversations, annotations, { keyword: '004' }).map((item) => item.id)).toEqual(['004']);
  });

  it('标签为字符串（旧数据）时也能命中标签筛选', () => {
    expect(filterConversations(conversations, annotations, { labels: ['risky'] }).map((item) => item.id)).toEqual(['ABC-002']);
  });

  it('评分缺失/非数字按 0 处理，不会命中 1-5 分筛选；筛选 0 分可命中未评分记录', () => {
    expect(filterConversations(conversations, annotations, { scores: [5] }).map((item) => item.id)).toEqual(['001']);
    expect(filterConversations(conversations, { '004': { score: 'abc' } }, { scores: [1] })).toEqual([]);
    expect(filterConversations(conversations, {}, { scores: [0] }).map((item) => item.id)).toEqual([
      '001',
      'ABC-002',
      '003',
      '004'
    ]);
  });

  it('状态筛选：labels-only 也算已审核；仅 reviewedAt 也算已审核；纯 AI 建议算未审核', () => {
    const reviewed = filterConversations(conversations, annotations, { status: 'reviewed' }).map((item) => item.id);
    expect(reviewed).toEqual(['001', 'ABC-002', '004']);

    const pending = filterConversations(conversations, annotations, { status: 'pending' }).map((item) => item.id);
    expect(pending).toEqual(['003']);

    const ai = filterConversations(conversations, annotations, { status: 'ai' }).map((item) => item.id);
    expect(ai).toEqual(['003']);
  });

  it('aiLabels 非数组（如旧备份中的字符串）时按「无 AI 建议」处理（防御行为）', () => {
    const result = filterConversations(conversations, { '001': { aiLabels: 'accurate' } }, { status: 'ai' });
    expect(result).toEqual([]);
  });

  it('组合筛选无交集时返回空数组', () => {
    expect(
      filterConversations(conversations, annotations, { keyword: '蓝牙', labels: ['risky'], scores: [2] })
    ).toEqual([]);
  });

  it('conversations 缺省 → 空数组；传 null（非 undefined）会抛 TypeError（当前实现只对 undefined 兜底）', () => {
    expect(filterConversations()).toEqual([]);
    expect(filterConversations(undefined, annotations, {})).toEqual([]);
    expect(() => filterConversations(null, annotations, {})).toThrow(TypeError);
  });
});

describe('summarizeConversations 口径', () => {
  it('统计值与标注口径一致（labels 字符串/仅 reviewedAt/缺 turns 均正确计数）', () => {
    expect(summarizeConversations(conversations, annotations)).toEqual({
      total: 4,
      reviewed: 3,
      pending: 1,
      withAi: 1,
      problem: 1
    });
  });

  it('annotations 中不属于当前数据集的记录不计入统计', () => {
    const result = summarizeConversations(conversations, {
      ...annotations,
      ghost: { labels: ['risky'], score: 1, reviewedAt: '2026-10-21T10:00:00.000Z' }
    });

    expect(result.total).toBe(4);
    expect(result.reviewed).toBe(3);
    expect(result.problem).toBe(1);
  });

  it('未知/空标签不计入问题对话，aiLabels 非数组不计入有 AI 建议', () => {
    const result = summarizeConversations(
      conversations,
      { '001': { labels: [], aiLabels: 'accurate' }, 'ABC-002': { labels: ['unknown'] } }
    );

    expect(result.withAi).toBe(0);
    expect(result.problem).toBe(1);
  });

  it('空数据 / 缺省入参 → 全 0', () => {
    expect(summarizeConversations()).toEqual({ total: 0, reviewed: 0, pending: 0, withAi: 0, problem: 0 });
    expect(summarizeConversations([], {})).toEqual({ total: 0, reviewed: 0, pending: 0, withAi: 0, problem: 0 });
  });
});

describe('paginate 边界', () => {
  const items = Array.from({ length: 31 }, (_, index) => index + 1);

  it('每页 15 条：总页数、末页条数与边界页码', () => {
    expect(paginate(items, 1, 15)).toMatchObject({ page: 1, pageCount: 3, total: 31 });
    expect(paginate(items, 1, 15).items).toHaveLength(15);
    expect(paginate(items, 3, 15).items).toEqual([31]);
    expect(paginate(items, 999, 15).page).toBe(3);
  });

  it('字符串/小数/负数页码自动归一', () => {
    expect(paginate(items, '2', 15).page).toBe(2);
    expect(paginate(items, 2.4, 15).page).toBe(2);
    expect(paginate(items, -3, 15).page).toBe(1);
    expect(paginate(items, 'abc', 15).page).toBe(1);
  });

  it('空列表 → 1 页 0 条', () => {
    expect(paginate([], 1, 15)).toEqual({ items: [], page: 1, pageCount: 1, total: 0 });
  });

  it('items 缺省 → 空结果；传 null（非 undefined）会抛 TypeError（当前实现只对 undefined 兜底）', () => {
    expect(paginate()).toEqual({ items: [], page: 1, pageCount: 1, total: 0 });
    expect(() => paginate(null, 1, 15)).toThrow(TypeError);
  });
});

describe('常量契约', () => {
  it('STATUS_OPTIONS 含四种状态且默认筛选为空条件', () => {
    expect(STATUS_OPTIONS.map((item) => item.value)).toEqual(['all', 'reviewed', 'pending', 'ai']);
    expect(DEFAULT_FILTERS).toEqual({ keyword: '', labels: [], scores: [], status: 'all' });
  });
});
