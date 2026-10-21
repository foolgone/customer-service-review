/**
 * src/lib/filters.js 单元测试
 * 覆盖：筛选条件归一化、关键词/标签/评分/状态筛选、汇总统计、分页
 */
import { describe, it, expect } from 'vitest';
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
      { role: 'assistant', content: '7 天内可申请退款' }
    ]
  },
  {
    id: '002',
    turns: [
      { role: 'user', content: '包裹显示签收但没收到' },
      { role: 'assistant', content: '建议先查门卫和快递柜' }
    ]
  },
  {
    id: '003',
    turns: [
      { role: 'user', content: '优惠券怎么用不了' },
      { role: 'assistant', content: '满 200 可用' }
    ]
  }
];

const annotations = {
  '001': { labels: ['accurate'], score: 5, reviewedAt: '2026-10-21T08:00:00.000Z' },
  '002': { labels: ['risky', 'incomplete'], score: 2 },
  '003': { labels: [], score: 3, aiLabels: ['accurate'], aiReason: '准确' }
};

describe('normalizeFilters / hasActiveFilters', () => {
  it('空输入 → 默认筛选条件', () => {
    expect(normalizeFilters()).toEqual(DEFAULT_FILTERS);
    expect(normalizeFilters({ labels: 'risky', scores: ['x'] }).labels).toEqual([]);
    expect(normalizeFilters({ scores: ['2', 3] }).scores).toEqual([2, 3]);
  });

  it('非法 status 回落 all', () => {
    expect(normalizeFilters({ status: 'weird' }).status).toBe('all');
    expect(STATUS_OPTIONS.some((item) => item.value === 'reviewed')).toBe(true);
  });

  it('是否生效：关键词/标签/评分/状态任一生效即为 true', () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ keyword: '   ' })).toBe(false);
    expect(hasActiveFilters({ keyword: '退款' })).toBe(true);
    expect(hasActiveFilters({ labels: ['risky'] })).toBe(true);
    expect(hasActiveFilters({ scores: [5] })).toBe(true);
    expect(hasActiveFilters({ status: 'pending' })).toBe(true);
  });
});

describe('filterConversations', () => {
  it('无筛选 → 返回全部', () => {
    expect(filterConversations(conversations, annotations, {})).toHaveLength(3);
  });

  it('关键词命中用户/客服消息与 id，大小写不敏感', () => {
    expect(filterConversations(conversations, annotations, { keyword: '退款' }).map((item) => item.id)).toEqual(['001']);
    expect(filterConversations(conversations, annotations, { keyword: '优惠券' }).map((item) => item.id)).toEqual(['003']);
    expect(filterConversations(conversations, annotations, { keyword: '002' }).map((item) => item.id)).toEqual(['002']);
    expect(filterConversations(conversations, annotations, { keyword: '快递柜' }).map((item) => item.id)).toEqual(['002']);
  });

  it('标签筛选命中任一标签即可', () => {
    expect(filterConversations(conversations, annotations, { labels: ['risky'] }).map((item) => item.id)).toEqual(['002']);
    expect(filterConversations(conversations, annotations, { labels: ['accurate', 'incomplete'] }).map((item) => item.id)).toEqual(['001', '002']);
  });

  it('评分筛选', () => {
    expect(filterConversations(conversations, annotations, { scores: [5] }).map((item) => item.id)).toEqual(['001']);
    expect(filterConversations(conversations, annotations, { scores: [2, 3] }).map((item) => item.id)).toEqual(['002', '003']);
  });

  it('状态筛选：已审核 / 未审核 / 有 AI 建议', () => {
    // 001 有标签+reviewedAt；002 有标签（risky/incomplete）即视为已审核；003 只有 AI 建议
    expect(filterConversations(conversations, annotations, { status: 'reviewed' }).map((item) => item.id)).toEqual(['001', '002']);
    expect(filterConversations(conversations, annotations, { status: 'pending' }).map((item) => item.id)).toEqual(['003']);
    expect(filterConversations(conversations, annotations, { status: 'ai' }).map((item) => item.id)).toEqual(['003']);
  });

  it('组合条件取交集', () => {
    const result = filterConversations(conversations, annotations, {
      keyword: '签收',
      labels: ['risky'],
      scores: [2],
      status: 'reviewed'
    });

    expect(result.map((item) => item.id)).toEqual(['002']);
  });

  it('无标注数据也不抛错', () => {
    expect(filterConversations(conversations, {}, {})).toHaveLength(3);
    expect(filterConversations(conversations, {}, { status: 'reviewed' })).toHaveLength(0);
  });
});

describe('summarizeConversations', () => {
  it('统计总数/已审核/待审核/有 AI 建议/问题对话', () => {
    expect(summarizeConversations(conversations, annotations)).toEqual({
      total: 3,
      reviewed: 2,
      pending: 1,
      withAi: 1,
      problem: 1
    });
  });

  it('空数据 → 全 0', () => {
    expect(summarizeConversations([], {})).toEqual({ total: 0, reviewed: 0, pending: 0, withAi: 0, problem: 0 });
  });
});

describe('paginate', () => {
  it('按页切片并返回页码信息', () => {
    const items = Array.from({ length: 45 }, (_, index) => index + 1);

    expect(paginate(items, 1, 20)).toMatchObject({ page: 1, pageCount: 3, total: 45 });
    expect(paginate(items, 1, 20).items).toHaveLength(20);
    expect(paginate(items, 3, 20).items).toHaveLength(5);
    expect(paginate(items, 3, 20).items[0]).toBe(41);
  });

  it('页码越界自动收敛', () => {
    const items = [1, 2, 3];

    expect(paginate(items, 9, 2).page).toBe(2);
    expect(paginate(items, 0, 2).page).toBe(1);
    expect(paginate([], 1, 20)).toMatchObject({ page: 1, pageCount: 1, total: 0 });
  });
});
