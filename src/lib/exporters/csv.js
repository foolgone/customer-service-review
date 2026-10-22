/**
 * CSV 明细导出
 * 与 Excel / PDF 一起归入 lib/exporters，统一「导出」职责。
 * 列：id, user, assistant, labels, score, comment, ai_labels, ai_reason, reviewed_at, duration_ms
 */

import { DEFAULT_ANNOTATION } from '../constants';

function escapeCsvValue(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export function getCsvFileName(date = new Date()) {
  return `customer-service-review-${date.toISOString().slice(0, 10)}.csv`;
}

export function conversationsToCsvRows(conversations, annotations) {
  return conversations.map((conversation) => {
    const user = conversation.turns.find((turn) => turn.role === 'user')?.content || '';
    const assistant = conversation.turns.find((turn) => turn.role === 'assistant')?.content || '';
    const annotation = annotations[conversation.id] || DEFAULT_ANNOTATION;

    return [
      conversation.id,
      user,
      assistant,
      Array.isArray(annotation.labels) ? annotation.labels.join('|') : '',
      Number.isFinite(Number(annotation.score)) ? Number(annotation.score) : 0,
      annotation.comment || '',
      Array.isArray(annotation.aiLabels) ? annotation.aiLabels.join('|') : '',
      annotation.aiReason || '',
      annotation.reviewedAt || annotation.updatedAt || '',
      annotation.durationMs || 0,
    ];
  });
}

export function exportConversationsToCsv(conversations, annotations, fileName = getCsvFileName()) {
  const header = [
    'id',
    'user',
    'assistant',
    'labels',
    'score',
    'comment',
    'ai_labels',
    'ai_reason',
    'reviewed_at',
    'duration_ms',
  ];
  const rows = conversationsToCsvRows(conversations, annotations).map((row) => row.map(escapeCsvValue).join(','));
  const csv = ['\ufeff', [header.map(escapeCsvValue).join(','), ...rows].join('\n')].join('');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
