/**
 * src/lib/analytics.js 单元测试
 * 覆盖：质检概览统计（计数/比率/均分/时长）、AI 采纳率、标签与评分分布、
 *      历史标签排序、最近审核记录、7 日趋势、标注过滤规则、格式化函数
 */
import { describe, it, expect } from 'vitest';
import { buildAnalytics, formatDurationLabel, formatPercent } from '../../../src/lib/analytics.js';
import { LABELS, DEFAULT_ANNOTATION } from '../../../src/lib/constants.js';
// 真实业务结构 fixture（15 条对话）
import conversations from '../../../public/data/conversations.json';

const OLD_ISO = '2024-05-01T10:00:00.000Z';

function makeAnnotation(overrides = {}) {
  return {
    labels: ['accurate'],
    comment: '',
    score: 5,
    aiLabels: [],
    aiReason: '',
    aiAt: '',
    reviewedAt: OLD_ISO,
    updatedAt: OLD_ISO,
    startedAt: '2024-05-01T09:58:00.000Z',
    durationMs: 120000,
    ...overrides
  };
}

function dateOffsetIso(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

function dateLabel(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

describe('buildAnalytics：基础计数', () => {
  it('空输入 → 所有计数与比率均为 0，分布与趋势保留固定结构', () => {
    const result = buildAnalytics([], {});

    expect(result.reviewedCount).toBe(0);
    expect(result.totalCount).toBe(0);
    expect(result.pendingCount).toBe(0);
    expect(result.todayReviewCount).toBe(0);
    expect(result.accuracyRate).toBe(0);
    expect(result.riskyRate).toBe(0);
    expect(result.hallucinationRate).toBe(0);
    expect(result.aiAdoptionRate).toBe(0);
    expect(result.avgScore).toBe(0);
    expect(result.avgDurationMs).toBe(0);
    expect(result.accurateCount).toBe(0);
    expect(result.riskyCount).toBe(0);
    expect(result.hallucinationCount).toBe(0);
    expect(result.impoliteCount).toBe(0);
    expect(result.recentReviews).toEqual([]);

    expect(result.labelBreakdown).toHaveLength(6);
    result.labelBreakdown.forEach((item) => expect(item.value).toBe(0));
    expect(result.scoreDistribution).toHaveLength(5);
    result.scoreDistribution.forEach((item) => expect(item.value).toBe(0));
    expect(result.historicalLabels).toHaveLength(6);
    result.historicalLabels.forEach((item) => expect(item.rate).toBe(0));
    expect(result.todaySeries).toHaveLength(7);
    result.todaySeries.forEach((item) => expect(item.count).toBe(0));
  });

  it('已有 2 条标注 → reviewedCount 2、totalCount 15、pendingCount 13', () => {
    const annotations = {
      '001': makeAnnotation(),
      '002': makeAnnotation({ labels: ['risky'], score: 1 })
    };

    const result = buildAnalytics(conversations, annotations);

    expect(result.reviewedCount).toBe(2);
    expect(result.totalCount).toBe(15);
    expect(result.pendingCount).toBe(13);
    expect(result.todayReviewCount).toBe(0);
  });

  it('全部标注完成 → pendingCount 为 0（不为负）', () => {
    const annotations = Object.fromEntries(
      conversations.map((conversation) => [conversation.id, makeAnnotation()])
    );

    const result = buildAnalytics(conversations, annotations);

    expect(result.reviewedCount).toBe(15);
    expect(result.pendingCount).toBe(0);
  });

  it('标注中的会话 id 不在对话列表 → 不计入 reviewedCount', () => {
    const result = buildAnalytics(conversations, { 'not-exist': makeAnnotation() });

    expect(result.reviewedCount).toBe(0);
    expect(result.totalCount).toBe(15);
    expect(result.pendingCount).toBe(15);
  });

  it('annotations 为 undefined → 视为空标注', () => {
    const result = buildAnalytics(conversations, undefined);

    expect(result.reviewedCount).toBe(0);
    expect(result.pendingCount).toBe(15);
  });
});

describe('todayReviewCount', () => {
  it('reviewedAt 为今天 → 计入今日审核；很早以前 → 不计入', () => {
    const annotations = {
      '001': makeAnnotation({ reviewedAt: new Date().toISOString() }),
      '002': makeAnnotation({ reviewedAt: OLD_ISO })
    };

    expect(buildAnalytics(conversations, annotations).todayReviewCount).toBe(1);
  });

  it('reviewedAt 为空、updatedAt 为今天 → 也计入今日审核', () => {
    const annotations = {
      '001': makeAnnotation({ reviewedAt: '', updatedAt: new Date().toISOString(), labels: [] })
    };

    expect(buildAnalytics(conversations, annotations).todayReviewCount).toBe(1);
  });

  it('多个今日标注 → 全部计入', () => {
    const todayIso = new Date().toISOString();
    const annotations = {
      '001': makeAnnotation({ reviewedAt: todayIso }),
      '002': makeAnnotation({ reviewedAt: todayIso }),
      '003': makeAnnotation({ reviewedAt: OLD_ISO })
    };

    expect(buildAnalytics(conversations, annotations).todayReviewCount).toBe(2);
  });
});

describe('accuracyRate / riskyRate / hallucinationRate 与计数', () => {
  it('百分比四舍五入取整，且各标签计数正确', () => {
    const annotations = {
      '001': makeAnnotation({ labels: ['accurate', 'risky'], score: 5 }),
      '002': makeAnnotation({ labels: ['accurate'], score: 4 }),
      '003': makeAnnotation({ labels: ['hallucination', 'impolite'], score: 3 })
    };

    const result = buildAnalytics(conversations, annotations);

    expect(result.reviewedCount).toBe(3);
    expect(result.accurateCount).toBe(2);
    expect(result.riskyCount).toBe(1);
    expect(result.hallucinationCount).toBe(1);
    expect(result.impoliteCount).toBe(1);
    expect(result.accuracyRate).toBe(67); // 2/3 → 66.67 → 67
    expect(result.riskyRate).toBe(33); // 1/3 → 33.33 → 33
    expect(result.hallucinationRate).toBe(33);
  });

  it('无审核记录 → 比率为 0（避免除零）', () => {
    const result = buildAnalytics(conversations, {});

    expect(result.accuracyRate).toBe(0);
    expect(result.riskyRate).toBe(0);
    expect(result.hallucinationRate).toBe(0);
  });
});

describe('aiAdoptionRate', () => {
  it('AI 标签与人工标签集合完全一致才算采纳（顺序无关、自动去重）', () => {
    const annotations = {
      // 采纳：顺序不同
      '001': makeAnnotation({ labels: ['accurate', 'risky'], aiLabels: ['risky', 'accurate'] }),
      // 采纳：AI 标签重复
      '002': makeAnnotation({ labels: ['accurate'], aiLabels: ['accurate', 'accurate'] }),
      // 未采纳：集合不同
      '003': makeAnnotation({ labels: ['accurate'], aiLabels: ['accurate', 'risky'] }),
      // 分母排除：AI 标签为空
      '004': makeAnnotation({ labels: ['accurate'], aiLabels: [] }),
      // 分母排除：没有 aiLabels 字段
      '005': makeAnnotation({ labels: ['accurate'] })
    };

    const result = buildAnalytics(conversations, annotations);

    expect(result.reviewedCount).toBe(5);
    expect(result.aiAdoptionRate).toBe(67); // 2 / 3 → 67
  });

  it('AI 标签不是数组 → 不计入分母', () => {
    const annotations = {
      '001': makeAnnotation({ aiLabels: 'accurate' }),
      '002': makeAnnotation({ aiLabels: [] })
    };

    expect(buildAnalytics(conversations, annotations).aiAdoptionRate).toBe(0);
  });

  it('完全没有 AI 记录 → 0', () => {
    const annotations = {
      '001': makeAnnotation(),
      '002': makeAnnotation({ labels: ['risky'] })
    };

    expect(buildAnalytics(conversations, annotations).aiAdoptionRate).toBe(0);
  });
});

describe('avgScore / avgDurationMs', () => {
  it('avgScore 取一位小数', () => {
    const annotations = {
      '001': makeAnnotation({ score: 5 }),
      '002': makeAnnotation({ score: 4 }),
      '003': makeAnnotation({ score: 4 })
    };

    expect(buildAnalytics(conversations, annotations).avgScore).toBe(4.3); // 13/3 = 4.333
  });

  it('avgScore 无记录 → 0', () => {
    expect(buildAnalytics(conversations, {}).avgScore).toBe(0);
  });

  it('avgDurationMs 只统计 durationMs > 0 的记录并四舍五入', () => {
    const annotations = {
      '001': makeAnnotation({ durationMs: 120000 }),
      '002': makeAnnotation({ durationMs: 60000 }),
      '003': makeAnnotation({ durationMs: 0 }),
      '004': makeAnnotation({ durationMs: -5 })
    };

    const result = buildAnalytics(conversations, annotations);

    expect(result.avgDurationMs).toBe(90000); // (120000 + 60000) / 2
    expect(result.reviewedCount).toBe(4);
  });

  it('avgDurationMs 四舍五入到整数', () => {
    const annotations = {
      '001': makeAnnotation({ durationMs: 1000 }),
      '002': makeAnnotation({ durationMs: 2002 })
    };

    expect(buildAnalytics(conversations, annotations).avgDurationMs).toBe(1501); // 1501
  });

  it('全部 durationMs <= 0 → 0', () => {
    const annotations = {
      '001': makeAnnotation({ durationMs: 0 }),
      '002': makeAnnotation({ durationMs: -1 })
    };

    expect(buildAnalytics(conversations, annotations).avgDurationMs).toBe(0);
  });
});

describe('labelBreakdown / scoreDistribution', () => {
  it('标签分布固定按 LABELS 顺序共 6 项，计数正确且带快捷/颜色', () => {
    const annotations = {
      '001': makeAnnotation({ labels: ['accurate', 'risky'], score: 5 }),
      '002': makeAnnotation({ labels: ['accurate'], score: 3 })
    };

    const result = buildAnalytics(conversations, annotations);

    expect(result.labelBreakdown).toHaveLength(6);
    expect(result.labelBreakdown.map((item) => item.value)).toEqual([2, 0, 0, 0, 0, 1]);
    expect(result.labelBreakdown.map((item) => item.name)).toEqual(LABELS.map((item) => item.label));
    result.labelBreakdown.forEach((item, index) => {
      expect(item.shortcut).toBe(LABELS[index].shortcut);
      expect(item.color).toBe(LABELS[index].color);
    });
  });

  it('评分分布固定 5 项、按 5→1 排列', () => {
    const annotations = {
      '001': makeAnnotation({ score: 5 }),
      '002': makeAnnotation({ score: 3 })
    };

    const result = buildAnalytics(conversations, annotations);

    expect(result.scoreDistribution).toHaveLength(5);
    expect(result.scoreDistribution.map((item) => item.name)).toEqual([
      '5 分',
      '4 分',
      '3 分',
      '2 分',
      '1 分'
    ]);
    expect(result.scoreDistribution.map((item) => item.value)).toEqual([1, 0, 1, 0, 0]);
  });

  it('未知标签不计入任何分布项', () => {
    const annotations = {
      '001': makeAnnotation({ labels: ['accurate', 'unknown-label'] })
    };

    const result = buildAnalytics(conversations, annotations);

    expect(result.labelBreakdown.map((item) => item.value)).toEqual([1, 0, 0, 0, 0, 0]);
    expect(result.accurateCount).toBe(1);
  });
});

describe('historicalLabels', () => {
  it('按 value 降序排序，rate = round(value / reviewedCount * 100)', () => {
    const annotations = {
      '001': makeAnnotation({ labels: ['accurate', 'risky'] }),
      '002': makeAnnotation({ labels: ['accurate'] })
    };

    const result = buildAnalytics(conversations, annotations);

    expect(result.historicalLabels).toHaveLength(6);
    expect(result.historicalLabels.map((item) => item.value)).toEqual([2, 1, 0, 0, 0, 0]);
    expect(result.historicalLabels[0].name).toBe('回复准确');
    expect(result.historicalLabels[0].rate).toBe(100);
    expect(result.historicalLabels[1].name).toBe('风险回复');
    expect(result.historicalLabels[1].rate).toBe(50);
    expect(result.historicalLabels[2].rate).toBe(0);
  });
});

describe('recentReviews', () => {
  it('按审核时间倒序最多 5 条，并映射预览/标签/评分/时长/是否采纳', () => {
    const annotations = {};
    const reviewedAtById = {};
    for (let index = 1; index <= 7; index += 1) {
      const id = String(index).padStart(3, '0');
      reviewedAtById[id] = dateOffsetIso(index);
      annotations[id] = makeAnnotation({
        reviewedAt: reviewedAtById[id],
        durationMs: index === 1 ? 90000 : index === 2 ? 45000 : 0,
        labels: ['accurate'],
        aiLabels: index === 1 ? ['accurate'] : []
      });
    }

    const result = buildAnalytics(conversations, annotations);

    expect(result.recentReviews).toHaveLength(5);
    expect(result.recentReviews.map((item) => item.id)).toEqual(['001', '002', '003', '004', '005']);

    const latest = result.recentReviews[0];
    expect(latest.preview).toBe(conversations[0].turns[0].content.slice(0, 30));
    expect(latest.labels).toEqual(['accurate']);
    expect(latest.score).toBe(5);
    expect(latest.comment).toBe('');
    expect(latest.durationLabel).toBe('1m 30s');
    expect(latest.isAccepted).toBe(true);
    expect(typeof latest.timeLabel).toBe('string');
    expect(latest.timeLabel.length).toBeGreaterThan(0);
    expect(latest.timeLabel).not.toBe('刚刚');
    expect(latest.reviewedAt).toBe(reviewedAtById['001']);

    expect(result.recentReviews[1].durationLabel).toBe('45s');
    expect(result.recentReviews[1].isAccepted).toBe(false); // aiLabels 为空
    expect(result.recentReviews[2].durationLabel).toBe('0s');
  });

  it('对话没有用户消息 → preview 为 "无用户消息"', () => {
    const customConversations = [
      { id: 'c1', turns: [{ role: 'assistant', content: '只有客服回复' }] }
    ];
    const annotations = { c1: makeAnnotation({ reviewedAt: new Date().toISOString() }) };

    const result = buildAnalytics(customConversations, annotations);

    expect(result.recentReviews[0].preview).toBe('无用户消息');
  });

  it('reviewedAt 非法 → timeLabel 回退为 "刚刚"', () => {
    const annotations = {
      '001': makeAnnotation({ reviewedAt: 'bad-date', labels: ['accurate'] })
    };

    const result = buildAnalytics(conversations, annotations);

    expect(result.recentReviews[0].timeLabel).toBe('刚刚');
  });

  it('无审核记录 → 最近记录为空数组', () => {
    expect(buildAnalytics(conversations, {}).recentReviews).toEqual([]);
  });
});

describe('todaySeries', () => {
  it('长度为 7，最后一项为今天（M/D），并按天统计数量', () => {
    const annotations = {
      '001': makeAnnotation({ reviewedAt: dateOffsetIso(0) }),
      '002': makeAnnotation({ reviewedAt: dateOffsetIso(3) }),
      '003': makeAnnotation({ reviewedAt: dateOffsetIso(10) })
    };

    const result = buildAnalytics(conversations, annotations);

    expect(result.todaySeries).toHaveLength(7);
    expect(result.todaySeries[6].date).toBe(dateLabel(0));
    expect(result.todaySeries[6].count).toBe(1);
    expect(result.todaySeries[3].date).toBe(dateLabel(3));
    expect(result.todaySeries[3].count).toBe(1);
    expect(result.todaySeries[0].date).toBe(dateLabel(6));
    // 10 天前的记录不在这 7 天内
    expect(result.todaySeries.reduce((sum, item) => sum + item.count, 0)).toBe(2);
  });
});

describe('标注过滤规则（实际行为断言）', () => {
  it('无 timestamp 但有 labels → 仍计入 reviewedCount', () => {
    const annotations = { '001': { labels: ['accurate'] } };
    expect(buildAnalytics(conversations, annotations).reviewedCount).toBe(1);
  });

  it('无 timestamp 但有 comment → 仍计入 reviewedCount', () => {
    const annotations = { '001': { labels: [], comment: '有备注' } };
    expect(buildAnalytics(conversations, annotations).reviewedCount).toBe(1);
  });

  it('无 timestamp 但 score 为 3（默认分）→ 仍计入 reviewedCount', () => {
    const annotations = { '001': { score: 3 } };
    expect(buildAnalytics(conversations, annotations).reviewedCount).toBe(1);
  });

  it('默认标注对象（score 3、labels 空）→ 计入 reviewedCount', () => {
    const annotations = { '001': { ...DEFAULT_ANNOTATION } };
    expect(buildAnalytics(conversations, annotations).reviewedCount).toBe(1);
  });

  it('空对象或 score 为 0 的标注 → 不计入 reviewedCount', () => {
    expect(buildAnalytics(conversations, { '001': {} }).reviewedCount).toBe(0);
    expect(buildAnalytics(conversations, { '001': { score: 0 } }).reviewedCount).toBe(0);
  });

  it('reviewedAt 为非法字符串时回退到合法的 updatedAt（BUG-08 已修复）', () => {
    const annotations = {
      '001': makeAnnotation({ reviewedAt: 'bad-date', updatedAt: new Date().toISOString() })
    };

    const result = buildAnalytics(conversations, annotations);

    expect(result.reviewedCount).toBe(1);
    expect(result.todayReviewCount).toBe(1);
  });

  it('labels 为字符串时按分隔符归一化，统计不崩溃（BUG-03 已修复）', () => {
    const annotations = {
      '001': makeAnnotation({ labels: 'accurate|risky' })
    };

    const result = buildAnalytics(conversations, annotations);

    expect(result.reviewedCount).toBe(1);
    expect(result.accurateCount).toBe(1);
    expect(result.riskyCount).toBe(1);
  });
});

describe('formatDurationLabel', () => {
  it('0 或负数 → "0s"', () => {
    expect(formatDurationLabel(0)).toBe('0s');
    expect(formatDurationLabel(-100)).toBe('0s');
    expect(formatDurationLabel()).toBe('0s');
  });

  it('只有秒 → "Ns"', () => {
    expect(formatDurationLabel(45000)).toBe('45s');
    expect(formatDurationLabel(999)).toBe('0s');
  });

  it('有分钟 → "Nm Ns"', () => {
    expect(formatDurationLabel(90000)).toBe('1m 30s');
    expect(formatDurationLabel(3599000)).toBe('59m 59s');
    expect(formatDurationLabel(3600000)).toBe('60m 0s');
  });
});

describe('formatPercent', () => {
  it('数字 → 直接拼接 %', () => {
    expect(formatPercent(55)).toBe('55%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(100)).toBe('100%');
  });

  it('非数字 / NaN / undefined → "0%"', () => {
    expect(formatPercent(NaN)).toBe('0%');
    expect(formatPercent(undefined)).toBe('0%');
    expect(formatPercent('abc')).toBe('0%');
    expect(formatPercent('45')).toBe('0%');
    expect(formatPercent(Infinity)).toBe('0%');
  });
});
