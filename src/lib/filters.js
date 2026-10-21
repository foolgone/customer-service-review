/**
 * 数据管理与筛选逻辑（纯函数，便于单测）
 * 支持：关键词搜索、标签筛选、评分筛选、审核/AI 状态筛选
 */

import { isHumanReviewed } from './analytics';
import { toLabelArray } from './labels';

export const STATUS_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'reviewed', label: '已审核' },
  { value: 'pending', label: '未审核' },
  { value: 'ai', label: '有 AI 建议' }
];

export const DEFAULT_FILTERS = {
  keyword: '',
  labels: [],
  scores: [],
  status: 'all'
};

function getConversationText(conversation, role) {
  return conversation?.turns?.find((turn) => turn.role === role)?.content || '';
}

/**
 * 归一化筛选条件
 * @param {Object} filters - 原始筛选条件
 * @returns {Object} 归一化后的筛选条件
 */
export function normalizeFilters(filters = {}) {
  return {
    keyword: typeof filters.keyword === 'string' ? filters.keyword : '',
    labels: Array.isArray(filters.labels) ? filters.labels.filter((item) => typeof item === 'string') : [],
    scores: Array.isArray(filters.scores) ? filters.scores.map(Number).filter((item) => Number.isFinite(item)) : [],
    status: STATUS_OPTIONS.some((item) => item.value === filters.status) ? filters.status : DEFAULT_FILTERS.status
  };
}

/**
 * 是否有生效中的筛选条件
 * @param {Object} filters - 筛选条件
 * @returns {boolean} 是否生效
 */
export function hasActiveFilters(filters = {}) {
  const normalized = normalizeFilters(filters);

  return Boolean(normalized.keyword.trim()) || normalized.labels.length > 0 || normalized.scores.length > 0 || normalized.status !== 'all';
}

/**
 * 按条件筛选对话
 * @param {Array} conversations - 对话列表
 * @param {Object} annotations - 标注表
 * @param {Object} filters - 筛选条件
 * @returns {Array} 命中的对话
 */
export function filterConversations(conversations = [], annotations = {}, filters = {}) {
  const normalized = normalizeFilters(filters);
  const keyword = normalized.keyword.trim().toLowerCase();
  const labelFilter = new Set(normalized.labels);
  const scoreFilter = new Set(normalized.scores);

  return conversations.filter((conversation) => {
    const annotation = annotations?.[conversation.id] || {};
    const labels = toLabelArray(annotation.labels);

    if (keyword) {
      const haystack = [
        conversation.id,
        getConversationText(conversation, 'user'),
        getConversationText(conversation, 'assistant')
      ]
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(keyword)) {
        return false;
      }
    }

    if (labelFilter.size && !labels.some((label) => labelFilter.has(label))) {
      return false;
    }

    if (scoreFilter.size) {
      const score = Number(annotation.score) || 0;
      if (!scoreFilter.has(score)) {
        return false;
      }
    }

    const reviewed = isHumanReviewed(annotation);
    const hasAi = Array.isArray(annotation.aiLabels) && annotation.aiLabels.length > 0;

    if (normalized.status === 'reviewed' && !reviewed) {
      return false;
    }

    if (normalized.status === 'pending' && reviewed) {
      return false;
    }

    if (normalized.status === 'ai' && !hasAi) {
      return false;
    }

    return true;
  });
}

/**
 * 汇总当前数据集状态
 * @param {Array} conversations - 对话列表
 * @param {Object} annotations - 标注表
 * @returns {Object} { total, reviewed, pending, withAi, problem }
 */
export function summarizeConversations(conversations = [], annotations = {}) {
  let reviewed = 0;
  let withAi = 0;
  let problem = 0;

  conversations.forEach((conversation) => {
    const annotation = annotations?.[conversation.id] || {};
    const labels = toLabelArray(annotation.labels);
    const hasAi = Array.isArray(annotation.aiLabels) && annotation.aiLabels.length > 0;

    if (isHumanReviewed(annotation)) {
      reviewed += 1;
    }

    if (hasAi) {
      withAi += 1;
    }

    if (labels.some((label) => label !== 'accurate')) {
      problem += 1;
    }
  });

  return {
    total: conversations.length,
    reviewed,
    pending: Math.max(conversations.length - reviewed, 0),
    withAi,
    problem
  };
}

/**
 * 分页切片
 * @param {Array} items - 列表
 * @param {number} page - 页码（从 1 开始）
 * @param {number} pageSize - 每页数量
 * @returns {Object} { items, page, pageCount, total }
 */
export function paginate(items = [], page = 1, pageSize = 20) {
  const total = items.length;
  const pageCount = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(Math.max(Math.round(Number(page) || 1), 1), pageCount);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageCount,
    total
  };
}
