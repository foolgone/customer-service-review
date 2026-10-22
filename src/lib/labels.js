/**
 * 标签体系的统一工具
 * 避免「问题标签」「标签归一化」「中文名映射」在多个模块各维护一份（BUG-24）
 */

import { LABELS } from './constants';

export const LABEL_NAME_MAP = new Map(LABELS.map((item) => [item.value, item.label]));

// 非「准确」类标签即视为需要关注的问题标签
export const PROBLEM_LABELS = new Set(LABELS.map((item) => item.value).filter((value) => value !== 'accurate'));

/**
 * 把多选标签归一化成数组，兼容字符串等脏数据（'a|b'）与非法类型
 * @param {any} value - 原始 labels/aiLabels
 * @returns {string[]} 标签数组
 */
export function toLabelArray(value) {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string');
  }

  if (typeof value === 'string' && value.trim()) {
    return value
      .split('|')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

/**
 * 标签值转中文展示名
 * @param {string} label - 标签值
 * @returns {string} 中文名（未知值原样返回）
 */
export function getLabelName(label) {
  return LABEL_NAME_MAP.get(label) || label;
}

/**
 * 标签数组转中文展示串
 * @param {any} value - 原始 labels
 * @param {string} [separator] - 分隔符
 * @returns {string} 展示串
 */
export function formatLabelList(value, separator = '、') {
  return toLabelArray(value)
    .map((label) => getLabelName(label))
    .join(separator);
}

/**
 * 是否为问题标签
 * @param {string} label - 标签值
 * @returns {boolean} 是否属于问题标签
 */
export function isProblemLabel(label) {
  return PROBLEM_LABELS.has(label);
}
