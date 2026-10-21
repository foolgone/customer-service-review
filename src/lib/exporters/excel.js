/**
 * Excel 导出器
 * 产物包含三个 Sheet：质检明细、统计汇总、问题对话
 */

import * as XLSX from 'xlsx';
import { formatDurationLabel } from '../analytics';
import { PROBLEM_LABELS, formatLabelList, toLabelArray } from '../labels';

function getConversationText(conversation, role) {
  return conversation?.turns?.find((turn) => turn.role === role)?.content || '';
}

function getScore(annotation) {
  const score = Number(annotation?.score);
  return Number.isFinite(score) && score > 0 ? score : '';
}

function getDurationSeconds(annotation) {
  const duration = Number(annotation?.durationMs);
  return Number.isFinite(duration) && duration > 0 ? Math.round(duration / 1000) : '';
}

/**
 * 构造质检明细行
 * @param {Array} conversations - 对话列表
 * @param {Object} annotations - 标注表
 * @returns {Array<Object>} 行数据
 */
export function buildDetailRows(conversations = [], annotations = {}) {
  return conversations.map((conversation) => {
    const annotation = annotations[conversation.id] || {};

    return {
      对话ID: conversation.id,
      用户消息: getConversationText(conversation, 'user'),
      客服回复: getConversationText(conversation, 'assistant'),
      人工标签: formatLabelList(annotation.labels),
      质检评分: getScore(annotation),
      备注: annotation.comment || '',
      AI建议标签: formatLabelList(annotation.aiLabels),
      AI建议理由: annotation.aiReason || '',
      审核时间: annotation.reviewedAt || '',
      审核耗时秒: getDurationSeconds(annotation)
    };
  });
}

/**
 * 构造统计汇总行（二维数组）
 * @param {Object} analytics - buildAnalytics 的返回值
 * @returns {Array<Array>} 行数据
 */
export function buildStatRows(analytics = {}) {
  const total = Number(analytics.totalCount) || 0;
  const reviewed = Number(analytics.reviewedCount) || 0;
  const completionRate = total ? Math.round((reviewed / total) * 100) : 0;

  const rows = [
    ['指标', '数值'],
    ['总对话数', total],
    ['已审核', reviewed],
    ['待审核', Number(analytics.pendingCount) || 0],
    ['审核完成率', `${completionRate}%`],
    ['回复准确率', `${Number(analytics.accuracyRate) || 0}%`],
    ['风险回复率', `${Number(analytics.riskyRate) || 0}%`],
    ['幻觉率', `${Number(analytics.hallucinationRate) || 0}%`],
    ['AI 建议采纳率', `${Number(analytics.aiAdoptionRate) || 0}%`],
    ['平均评分', Number(analytics.avgScore) || 0],
    ['平均审核耗时', formatDurationLabel(Number(analytics.avgDurationMs) || 0)],
    [],
    ['标签', '次数', '占比']
  ];

  (analytics.historicalLabels || []).forEach((item) => {
    rows.push([item.name, Number(item.value) || 0, `${Number(item.rate) || 0}%`]);
  });

  rows.push([], ['评分', '数量']);
  (analytics.scoreDistribution || []).forEach((item) => {
    rows.push([item.name, Number(item.value) || 0]);
  });

  return rows;
}

/**
 * 构造问题对话行：只保留命中非 accurate 标签的对话
 * @param {Array} conversations - 对话列表
 * @param {Object} annotations - 标注表
 * @returns {Array<Object>} 行数据
 */
export function buildProblemRows(conversations = [], annotations = {}) {
  return conversations
    .filter((conversation) => {
      const labels = toLabelArray(annotations[conversation.id]?.labels);
      return labels.some((label) => PROBLEM_LABELS.has(label));
    })
    .map((conversation) => {
      const annotation = annotations[conversation.id] || {};

      return {
        对话ID: conversation.id,
        用户消息: getConversationText(conversation, 'user'),
        客服回复: getConversationText(conversation, 'assistant'),
        问题标签: formatLabelList(annotation.labels),
        质检评分: getScore(annotation),
        备注: annotation.comment || ''
      };
    });
}

/**
 * 构建工作簿
 * @param {Object} payload
 * @param {Array} payload.conversations - 对话列表
 * @param {Object} payload.annotations - 标注表
 * @param {Object} payload.analytics - 统计结果
 * @returns {Object} XLSX 工作簿
 */
export function buildWorkbook({ conversations = [], annotations = {}, analytics = {} } = {}) {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildDetailRows(conversations, annotations)), '质检明细');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(buildStatRows(analytics)), '统计汇总');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(buildProblemRows(conversations, annotations)), '问题对话');

  return workbook;
}

/**
 * 构建工作簿的二进制内容（xlsx）
 * 与下载分离，便于测试/上传等场景复用
 * @param {Object} payload - 同 buildWorkbook
 * @returns {ArrayBuffer|Uint8Array} xlsx 字节内容
 */
export function buildExcelArray(payload = {}) {
  const workbook = buildWorkbook(payload);
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
}

/**
 * 生成导出文件名
 * @param {Date} [date] - 日期
 * @returns {string} 文件名
 */
export function getExcelFileName(date = new Date()) {
  return `质检报告-${date.toISOString().slice(0, 10)}.xlsx`;
}

/**
 * 导出 Excel 并触发下载
 * @param {Object} payload - 同 buildWorkbook
 * @param {string} [fileName] - 文件名
 * @returns {Object} 工作簿
 */
export function exportToExcel(payload, fileName = getExcelFileName()) {
  const workbook = buildWorkbook(payload);
  XLSX.writeFile(workbook, fileName);
  return workbook;
}
