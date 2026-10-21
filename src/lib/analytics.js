import { LABELS, SCORE_LEVELS } from './constants';
import { toLabelArray } from './labels';

const LABEL_VALUE_MAP = new Map(LABELS.map((item) => [item.value, item]));

function getTimestamp(annotation) {
  const candidates = [annotation.reviewedAt, annotation.updatedAt, annotation.aiAt, annotation.startedAt];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const timestamp = new Date(candidate).getTime();
    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }

  return 0;
}

function getDayStart(timestamp) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatDuration(ms) {
  if (!ms || ms <= 0) {
    return '0s';
  }

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  if (!minutes) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

function formatDateTime(timestamp) {
  const parsed = new Date(timestamp);

  if (Number.isNaN(parsed.getTime())) {
    return '刚刚';
  }

  return parsed.toLocaleString('zh-CN', { hour12: false });
}

function sameLabelSet(leftLabels = [], rightLabels = []) {
  const left = [...new Set(leftLabels)].sort().join('|');
  const right = [...new Set(rightLabels)].sort().join('|');
  return left === right;
}

function buildConversationMap(conversations = []) {
  return new Map(conversations.map((conversation) => [conversation.id, conversation]));
}

function getUserPreview(conversation) {
  return conversation?.turns?.find((turn) => turn.role === 'user')?.content?.slice(0, 30) || '无用户消息';
}

/**
 * 是否已被人工作出结论（用于「已标注 / 已审核」口径，BUG-14）
 * 纯 AI 建议（只有 aiLabels/aiReason/aiAt）不算人工审核。
 * @param {Object} annotation - 标注对象
 * @returns {boolean} 是否存在人工结论
 */
export function isHumanReviewed(annotation) {
  const labels = toLabelArray(annotation?.labels);
  return labels.length > 0 || Boolean(annotation?.reviewedAt);
}

export function buildAnalytics(conversations, annotations) {
  const conversationMap = buildConversationMap(conversations);
  const records = Object.entries(annotations || {})
    .map(([id, annotation]) => ({
      id,
      ...annotation,
      labels: toLabelArray(annotation?.labels),
      timestamp: getTimestamp(annotation || {})
    }))
    .filter((record) => conversationMap.has(record.id))
    .filter((record) => isHumanReviewed(record));

  const reviewedCount = records.length;
  const totalCount = conversations.length;
  const pendingCount = Math.max(totalCount - reviewedCount, 0);
  const todayStart = getDayStart(Date.now());
  const todayReviewCount = records.filter((record) => getTimestamp(record) >= todayStart).length;

  const labelCounts = Object.fromEntries(LABELS.map((item) => [item.value, 0]));
  const scoreCounts = Object.fromEntries(SCORE_LEVELS.map((item) => [String(item.value), 0]));

  records.forEach((record) => {
    (record.labels || []).forEach((label) => {
      if (labelCounts[label] !== undefined) {
        labelCounts[label] += 1;
      }
    });

    if (scoreCounts[String(record.score)] !== undefined) {
      scoreCounts[String(record.score)] += 1;
    }
  });

  const labelBreakdown = LABELS.map((item) => ({
    name: item.label,
    value: labelCounts[item.value] || 0,
    shortcut: item.shortcut,
    color: item.color
  }));

  const scoreDistribution = SCORE_LEVELS.map((item) => ({
    name: item.label,
    value: scoreCounts[String(item.value)] || 0,
    shortcut: item.shortcut
  }));

  const accurateCount = records.filter((record) => (record.labels || []).includes('accurate')).length;
  const riskyCount = records.filter((record) => (record.labels || []).includes('risky')).length;
  const hallucinationCount = records.filter((record) => (record.labels || []).includes('hallucination')).length;
  const impoliteCount = records.filter((record) => (record.labels || []).includes('impolite')).length;

  const scoreSum = records.reduce((sum, record) => sum + (Number(record.score) || 0), 0);
  const avgScore = reviewedCount ? Number((scoreSum / reviewedCount).toFixed(1)) : 0;

  const durationRecords = records.filter((record) => Number(record.durationMs) > 0);
  const avgDurationMs = durationRecords.length
    ? Math.round(durationRecords.reduce((sum, record) => sum + Number(record.durationMs), 0) / durationRecords.length)
    : 0;

  const aiRecords = records.filter((record) => Array.isArray(record.aiLabels) && record.aiLabels.length);
  const aiAcceptedCount = aiRecords.filter((record) => sameLabelSet(record.labels, record.aiLabels)).length;
  const aiAdoptionRate = aiRecords.length ? Math.round((aiAcceptedCount / aiRecords.length) * 100) : 0;

  const accuracyRate = reviewedCount ? Math.round((accurateCount / reviewedCount) * 100) : 0;
  const riskyRate = reviewedCount ? Math.round((riskyCount / reviewedCount) * 100) : 0;
  const hallucinationRate = reviewedCount ? Math.round((hallucinationCount / reviewedCount) * 100) : 0;

  const todaySeries = Array.from({ length: 7 }, (_, index) => {
    const current = new Date();
    current.setDate(current.getDate() - (6 - index));
    const dayStart = getDayStart(current.getTime());
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const count = records.filter((record) => getTimestamp(record) >= dayStart && getTimestamp(record) < dayEnd).length;

    return {
      date: `${current.getMonth() + 1}/${current.getDate()}`,
      count
    };
  });

  const recentReviews = records
    .slice()
    .sort((left, right) => getTimestamp(right) - getTimestamp(left))
    .slice(0, 5)
    .map((record) => {
      const conversation = conversationMap.get(record.id);

      return {
        id: record.id,
        preview: getUserPreview(conversation),
        labels: record.labels || [],
        aiLabels: record.aiLabels || [],
        score: Number(record.score) || 0,
        comment: record.comment || '',
        reviewedAt: record.reviewedAt || record.updatedAt || '',
        timeLabel: formatDateTime(record.reviewedAt || record.updatedAt || Date.now()),
        durationLabel: formatDuration(record.durationMs),
        isAccepted: sameLabelSet(record.labels, record.aiLabels)
      };
    });

  const historicalLabels = labelBreakdown
    .slice()
    .sort((left, right) => right.value - left.value)
    .map((item) => ({
      ...item,
      rate: reviewedCount ? Math.round((item.value / reviewedCount) * 100) : 0
    }));

  return {
    reviewedCount,
    totalCount,
    pendingCount,
    todayReviewCount,
    accuracyRate,
    riskyRate,
    hallucinationRate,
    aiAdoptionRate,
    avgScore,
    avgDurationMs,
    scoreDistribution,
    labelBreakdown,
    historicalLabels,
    recentReviews,
    todaySeries,
    accurateCount,
    riskyCount,
    hallucinationCount,
    impoliteCount
  };
}

export function formatDurationLabel(ms) {
  if (!ms || ms <= 0) {
    return '0s';
  }

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  if (!minutes) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

export function formatPercent(value) {
  return `${Number.isFinite(value) ? value : 0}%`;
}
