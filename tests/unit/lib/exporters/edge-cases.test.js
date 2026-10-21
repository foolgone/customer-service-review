/**
 * src/lib/exporters/excel.js 边界与下载契约补充测试
 * 开发已有 excel.test.js 覆盖主路径，本文件补：
 * - 字节生成 buildExcelArray 与可回读性
 * - 实际写入 exportToExcel（mock XLSX.writeFile）
 * - 脏数据/缺省值：labels 非数组、score 非法、durationMs 非法、缺 turns
 * - 统计行缺省字段、完成率取整、默认文件名
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, writeFile: vi.fn() };
});

import * as XLSX from 'xlsx';
import {
  buildDetailRows,
  buildExcelArray,
  buildProblemRows,
  buildStatRows,
  buildWorkbook,
  exportToExcel,
  getExcelFileName
} from '../../../../src/lib/exporters/excel.js';

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
    turns: [{ role: 'user', content: '只有用户消息' }]
  }
];

beforeEach(() => {
  XLSX.writeFile.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('buildDetailRows 脏数据与缺省值', () => {
  it('conversations 缺省 → []；缺 turns 的对话字段留空但不抛错', () => {
    expect(buildDetailRows()).toEqual([]);
    expect(buildDetailRows(undefined, undefined)).toEqual([]);

    const rows = buildDetailRows([{ id: 'no-turns' }], {});
    expect(rows[0]).toMatchObject({ 对话ID: 'no-turns', 用户消息: '', 客服回复: '', 人工标签: '' });
  });

  it('labels 为数字/对象/null 等脏数据 → 人工标签为空字符串', () => {
    const rows = buildDetailRows([conversations[0]], {
      '001': { labels: 123, aiLabels: { bad: true } }
    });

    expect(rows[0].人工标签).toBe('');
    expect(rows[0].AI建议标签).toBe('');
  });

  it('labels 字符串按 | 拆分并 trim，未知标签原样输出', () => {
    const rows = buildDetailRows([conversations[0]], {
      '001': { labels: ' accurate | risky |unknown_tag ', aiLabels: '|' }
    });

    expect(rows[0].人工标签).toBe('回复准确、风险回复、unknown_tag');
    expect(rows[0].AI建议标签).toBe('');
  });

  it('评分与耗时非法值（0 / 负数 / NaN / 字符串）→ 留空', () => {
    const cases = [
      { score: 0, durationMs: 0 },
      { score: -3, durationMs: -1000 },
      { score: 'abc', durationMs: 'abc' },
      { score: Number.NaN, durationMs: Number.NaN }
    ];

    cases.forEach((annotation) => {
      const rows = buildDetailRows([conversations[0]], { '001': annotation });
      expect(rows[0].质检评分).toBe('');
      expect(rows[0].审核耗时秒).toBe('');
    });
  });

  it('耗时毫秒四舍五入到秒', () => {
    const rows = buildDetailRows([conversations[0]], { '001': { score: 4, durationMs: 2500 } });
    expect(rows[0].审核耗时秒).toBe(3);
  });
});

describe('buildProblemRows 边界', () => {
  it('字符串形式的问题标签也能识别（risky|accurate）', () => {
    const rows = buildProblemRows([conversations[0]], { '001': { labels: 'risky|accurate' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].问题标签).toBe('风险回复、回复准确');
  });

  it('只有 accurate 或脏数据的对话不计入问题对话', () => {
    const rows = buildProblemRows([conversations[0], conversations[1]], {
      '001': { labels: ['accurate'] },
      '002': { labels: 42 }
    });
    expect(rows).toEqual([]);
  });

  it('conversations 缺省 → []', () => {
    expect(buildProblemRows()).toEqual([]);
  });
});

describe('buildStatRows 缺省与取整', () => {
  it('analytics 为空 / 缺历史与评分分布 → 不抛错且结构完整', () => {
    const rows = buildStatRows();
    expect(rows[0]).toEqual(['指标', '数值']);
    expect(rows).toContainEqual(['总对话数', 0]);
    expect(rows).toContainEqual(['审核完成率', '0%']);
    expect(rows.some((row) => row.length === 3 && row[0] === '标签' && row[1] === '次数')).toBe(true);
  });

  it('完成率四舍五入（1/3 → 33%），已审 > 总数按实际比例输出', () => {
    expect(buildStatRows({ totalCount: 3, reviewedCount: 1 })).toContainEqual(['审核完成率', '33%']);
    expect(buildStatRows({ totalCount: 3, reviewedCount: 5 })).toContainEqual(['审核完成率', '167%']);
  });

  it('历史标签与评分分布按 analytics 顺序追加', () => {
    const rows = buildStatRows({
      totalCount: 2,
      reviewedCount: 1,
      historicalLabels: [{ name: '风险回复', value: 2, rate: 50 }],
      scoreDistribution: [{ name: '5 分', value: 1 }]
    });

    expect(rows).toContainEqual(['风险回复', 2, '50%']);
    expect(rows).toContainEqual(['5 分', 1]);
  });
});

describe('buildWorkbook / buildExcelArray', () => {
  it('空入参也能构建三个 Sheet', () => {
    const workbook = buildWorkbook();
    expect(workbook.SheetNames).toEqual(['质检明细', '统计汇总', '问题对话']);
    expect(workbook.Sheets['质检明细']).toBeDefined();
    expect(workbook.Sheets['统计汇总']).toBeDefined();
    expect(workbook.Sheets['问题对话']).toBeDefined();
  });

  it('buildExcelArray 生成可被 XLSX 回读的 xlsx 字节', () => {
    const bytes = buildExcelArray({
      conversations,
      annotations: { '001': { labels: ['risky'], score: 2 } },
      analytics: { totalCount: 2, reviewedCount: 1 }
    });

    expect(bytes.byteLength).toBeGreaterThan(0);

    const workbook = XLSX.read(bytes, { type: 'array' });
    expect(workbook.SheetNames).toEqual(['质检明细', '统计汇总', '问题对话']);

    const detail = XLSX.utils.sheet_to_json(workbook.Sheets['质检明细']);
    expect(detail).toHaveLength(2);
    expect(detail[0]['对话ID']).toBe('001');

    const problems = XLSX.utils.sheet_to_json(workbook.Sheets['问题对话']);
    expect(problems).toHaveLength(1);
    expect(problems[0]['对话ID']).toBe('001');
  });
});

describe('exportToExcel / getExcelFileName', () => {
  it('exportToExcel 调用 XLSX.writeFile 并返回工作簿', () => {
    const payload = { conversations, annotations: {}, analytics: { totalCount: 2 } };

    const workbook = exportToExcel(payload, '自定义.xlsx');

    expect(XLSX.writeFile).toHaveBeenCalledTimes(1);
    const [writtenWorkbook, fileName] = XLSX.writeFile.mock.calls[0];
    expect(writtenWorkbook).toBe(workbook);
    expect(fileName).toBe('自定义.xlsx');
    expect(workbook.SheetNames).toHaveLength(3);
  });

  it('exportToExcel 不传文件名时使用默认日期文件名', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T12:00:00.000Z'));

    exportToExcel({ conversations });

    expect(XLSX.writeFile.mock.calls[0][1]).toBe('质检报告-2026-10-21.xlsx');
  });

  it('getExcelFileName 默认取当天日期', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T12:00:00.000Z'));
    expect(getExcelFileName()).toBe('质检报告-2026-10-21.xlsx');
  });
});
