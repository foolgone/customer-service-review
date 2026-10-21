/**
 * src/lib/constants.js 单元测试
 * 覆盖：标签、评分等级、快捷键、存储键、默认标注、质检员信息、DeepSeek 默认配置
 */
import { describe, it, expect } from 'vitest';
import {
  LABELS,
  SCORE_LEVELS,
  QUICK_SHORTCUTS,
  STORAGE_KEYS,
  DEFAULT_ANNOTATION,
  REVIEWER_PROFILE,
  DEEPSEEK_DEFAULT_MODEL,
  DEEPSEEK_ENDPOINT
} from '../../../src/lib/constants.js';

describe('LABELS', () => {
  it('共 6 项，value 唯一且 shortcut 依次为 1-6', () => {
    expect(LABELS).toHaveLength(6);
    const values = LABELS.map((item) => item.value);
    expect(new Set(values).size).toBe(6);
    expect(LABELS.map((item) => item.shortcut)).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('每项都含 label / description / color 字段', () => {
    LABELS.forEach((item) => {
      expect(typeof item.label).toBe('string');
      expect(item.label.length).toBeGreaterThan(0);
      expect(typeof item.description).toBe('string');
      expect(typeof item.color).toBe('string');
      expect(item.color.length).toBeGreaterThan(0);
    });
  });

  it('包含全部业务标签值', () => {
    expect(LABELS.map((item) => item.value)).toEqual([
      'accurate',
      'off_topic',
      'hallucination',
      'impolite',
      'incomplete',
      'risky'
    ]);
  });
});

describe('SCORE_LEVELS', () => {
  it('共 5 项，value 从 5 递减到 1，shortcut 为 Alt+1..Alt+5', () => {
    expect(SCORE_LEVELS).toHaveLength(5);
    expect(SCORE_LEVELS.map((item) => item.value)).toEqual([5, 4, 3, 2, 1]);
    expect(SCORE_LEVELS.map((item) => item.shortcut)).toEqual([
      'Alt+1',
      'Alt+2',
      'Alt+3',
      'Alt+4',
      'Alt+5'
    ]);
  });

  it('每项都含 label 与 description', () => {
    SCORE_LEVELS.forEach((item) => {
      expect(typeof item.label).toBe('string');
      expect(typeof item.description).toBe('string');
    });
  });
});

describe('QUICK_SHORTCUTS', () => {
  it('非空且每项含 key / label', () => {
    expect(Array.isArray(QUICK_SHORTCUTS)).toBe(true);
    expect(QUICK_SHORTCUTS.length).toBeGreaterThan(0);
    QUICK_SHORTCUTS.forEach((item) => {
      expect(typeof item.key).toBe('string');
      expect(typeof item.label).toBe('string');
    });
  });
});

describe('STORAGE_KEYS', () => {
  it('固定值保持不变（避免破坏已有本地数据）', () => {
    expect(STORAGE_KEYS).toEqual({
      annotations: 'cs-review-annotations-v1',
      theme: 'cs-review-theme-v1'
    });
  });
});

describe('DEFAULT_ANNOTATION', () => {
  it('字段齐全，labels/aiLabels 为数组、score 为 3', () => {
    expect(Array.isArray(DEFAULT_ANNOTATION.labels)).toBe(true);
    expect(DEFAULT_ANNOTATION.labels).toEqual([]);
    expect(Array.isArray(DEFAULT_ANNOTATION.aiLabels)).toBe(true);
    expect(DEFAULT_ANNOTATION.aiLabels).toEqual([]);
    expect(DEFAULT_ANNOTATION.score).toBe(3);
    expect(DEFAULT_ANNOTATION.comment).toBe('');
    expect(DEFAULT_ANNOTATION.aiReason).toBe('');
    expect(DEFAULT_ANNOTATION.aiAt).toBe('');
    expect(DEFAULT_ANNOTATION.reviewedAt).toBe('');
    expect(DEFAULT_ANNOTATION.updatedAt).toBe('');
    expect(DEFAULT_ANNOTATION.startedAt).toBe('');
    expect(DEFAULT_ANNOTATION.durationMs).toBe(0);
  });
});

describe('REVIEWER_PROFILE', () => {
  it('包含 name / team / status', () => {
    expect(typeof REVIEWER_PROFILE.name).toBe('string');
    expect(typeof REVIEWER_PROFILE.team).toBe('string');
    expect(REVIEWER_PROFILE.status).toBe('在线');
  });
});

describe('DeepSeek 默认配置', () => {
  it('默认模型为 deepseek-chat', () => {
    expect(DEEPSEEK_DEFAULT_MODEL).toBe('deepseek-chat');
  });

  it('默认接口地址为官方 chat/completions', () => {
    expect(DEEPSEEK_ENDPOINT).toBe('https://api.deepseek.com/chat/completions');
  });
});
