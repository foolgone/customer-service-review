/**
 * src/lib/labels.js 单元测试
 * 覆盖：标签归一化（数组/字符串/非法）、中文名映射、问题标签判定、格式化输出
 */
import { describe, it, expect } from 'vitest';
import {
  LABEL_NAME_MAP,
  PROBLEM_LABELS,
  toLabelArray,
  getLabelName,
  formatLabelList,
  isProblemLabel
} from '../../../src/lib/labels.js';

describe('toLabelArray', () => {
  it('数组 → 过滤非字符串项', () => {
    expect(toLabelArray(['accurate', 1, null, 'risky'])).toEqual(['accurate', 'risky']);
  });

  it("字符串 → 按 '|' 拆分", () => {
    expect(toLabelArray('accurate|risky')).toEqual(['accurate', 'risky']);
    expect(toLabelArray(' accurate | incomplete ')).toEqual(['accurate', 'incomplete']);
  });

  it('空值/非法类型 → 空数组', () => {
    expect(toLabelArray(undefined)).toEqual([]);
    expect(toLabelArray(null)).toEqual([]);
    expect(toLabelArray(123)).toEqual([]);
    expect(toLabelArray('')).toEqual([]);
    expect(toLabelArray('   ')).toEqual([]);
  });
});

describe('标签名与问题标签', () => {
  it('LABEL_NAME_MAP 覆盖全部标签值', () => {
    expect(LABEL_NAME_MAP.get('accurate')).toBe('回复准确');
    expect(LABEL_NAME_MAP.size).toBeGreaterThanOrEqual(6);
  });

  it('getLabelName 未知值原样返回', () => {
    expect(getLabelName('accurate')).toBe('回复准确');
    expect(getLabelName('unknown')).toBe('unknown');
  });

  it('PROBLEM_LABELS 不含 accurate，包含其余标签', () => {
    expect(PROBLEM_LABELS.has('accurate')).toBe(false);
    ['off_topic', 'hallucination', 'impolite', 'incomplete', 'risky'].forEach((label) => {
      expect(PROBLEM_LABELS.has(label)).toBe(true);
      expect(isProblemLabel(label)).toBe(true);
    });
    expect(isProblemLabel('accurate')).toBe(false);
  });

  it('formatLabelList 输出中文并用顿号连接', () => {
    expect(formatLabelList(['risk' + 'y', 'incomplete'])).toBe('风险回复、未解决问题');
    expect(formatLabelList('accurate|risky')).toBe('回复准确、风险回复');
    expect(formatLabelList(['unknown-label'])).toBe('unknown-label');
    expect(formatLabelList([])).toBe('');
    expect(formatLabelList(['accurate', 'risky'], ' / ')).toBe('回复准确 / 风险回复');
  });
});
