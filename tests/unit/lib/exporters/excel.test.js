/**
 * src/lib/exporters/excel.js 单元测试
 * 覆盖：明细行映射、统计汇总行、问题对话筛选、工作簿结构与文件名
 */
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildDetailRows,
  buildStatRows,
  buildProblemRows,
  buildWorkbook,
  getExcelFileName
} from '../../../../src/lib/exporters/excel.js';
import { buildAnalytics } from '../../../../src/lib/analytics.js';

const conversations = [
  {
    id: '001',
    turns: [
      { role: 'user', content: '能退款吗' },
      { role: 'assistant', content: '可以退款' }
    ]
  },
  {
    id: '002',
    turns: [
      { role: 'user', content: '优惠券怎么用' },
      { role: 'assistant', content: '满 200 可用' }
    ]
  },
  {
    id: '003',
    turns: [
      { role: 'user', content: '账号被盗了' },
      { role: 'assistant', content: '请改密码' }
    ]
  }
];

const annotations = {
  '001': {
    labels: ['accurate'],
    score: 5,
    comment: '回复准确',
    aiLabels: ['accurate'],
    aiReason: '符合政策',
    reviewedAt: '2026-10-21T08:00:00.000Z',
    durationMs: 30000
  },
  '002': {
    labels: ['risky', 'incomplete'],
    score: 2,
    comment: '承诺了不该承诺的',
    reviewedAt: '2026-10-21T08:05:00.000Z'
  }
};

const analytics = buildAnalytics(conversations, annotations);

describe('buildDetailRows', () => {
  it('每行对话一条，标签转中文、评分/时长/时间正确', () => {
    const rows = buildDetailRows(conversations, annotations);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      对话ID: '001',
      用户消息: '能退款吗',
      客服回复: '可以退款',
      人工标签: '回复准确',
      质检评分: 5,
      备注: '回复准确',
      AI建议标签: '回复准确',
      AI建议理由: '符合政策',
      审核时间: '2026-10-21T08:00:00.000Z',
      审核耗时秒: 30
    });
    // 未标注对话：标签/评分/耗时留空，但行仍保留
    expect(rows[2]).toMatchObject({ 对话ID: '003', 人工标签: '', 质检评分: '', 审核耗时秒: '' });
  });

  it('labels 为字符串等脏数据也不会抛错', () => {
    const rows = buildDetailRows([conversations[0]], { '001': { labels: 'accurate|risky' } });
    expect(rows[0].人工标签).toBe('回复准确、风险回复');
  });
});

describe('buildStatRows', () => {
  it('包含总体指标、标签分布与评分分布两段', () => {
    const rows = buildStatRows(analytics);

    expect(rows[0]).toEqual(['指标', '数值']);
    expect(rows).toContainEqual(['总对话数', 3]);
    expect(rows).toContainEqual(['已审核', 2]);
    expect(rows).toContainEqual(['待审核', 1]);
    expect(rows).toContainEqual(['审核完成率', '67%']);
    expect(rows.some((row) => row[0] === '回复准确率')).toBe(true);
    expect(rows.some((row) => row[0] === '回复准确' && row[1] === 1)).toBe(true);
    expect(rows.some((row) => row[0] === '5 分')).toBe(true);
  });

  it('空统计不抛错，指标为 0', () => {
    const rows = buildStatRows({});

    expect(rows).toContainEqual(['总对话数', 0]);
    expect(rows).toContainEqual(['审核完成率', '0%']);
  });
});

describe('buildProblemRows', () => {
  it('只保留含非 accurate 标签的对话，并列出问题标签', () => {
    const rows = buildProblemRows(conversations, annotations);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      对话ID: '002',
      问题标签: '风险回复、未解决问题',
      质检评分: 2
    });
  });

  it('没有问题时返回空数组', () => {
    expect(buildProblemRows(conversations, {})).toEqual([]);
  });
});

describe('buildWorkbook / getExcelFileName', () => {
  it('生成三个工作表且可被 XLSX 回读', () => {
    const workbook = buildWorkbook({ conversations, annotations, analytics });

    expect(workbook.SheetNames).toEqual(['质检明细', '统计汇总', '问题对话']);

    const detail = XLSX.utils.sheet_to_json(workbook.Sheets['质检明细']);
    expect(detail).toHaveLength(3);
    expect(detail[0]['对话ID']).toBe('001');

    const stats = XLSX.utils.sheet_to_json(workbook.Sheets['统计汇总'], { header: 1 });
    expect(stats[0]).toEqual(['指标', '数值']);

    const problems = XLSX.utils.sheet_to_json(workbook.Sheets['问题对话']);
    expect(problems).toHaveLength(1);
  });

  it('文件名为 质检报告-YYYY-MM-DD.xlsx', () => {
    expect(getExcelFileName(new Date('2026-10-21T10:00:00.000Z'))).toBe('质检报告-2026-10-21.xlsx');
  });
});
