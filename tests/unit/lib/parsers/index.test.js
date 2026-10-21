/**
 * 统一解析入口单元测试：src/lib/parsers/index.js
 *
 * 重点覆盖 parseFile 按扩展名分发，以及 validateFile 校验失败时的短路返回。
 * 注意：当前实现的 validateFile 以「扩展名」为唯一权威，MIME 仅告警不拦截，
 * 因此与部分预期规格不一致的行为会在此显式断言并在汇报中标注。
 */
import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseFile,
  parseJSON,
  parseCSV,
  parseExcel,
  getCSVColumns,
  getExcelColumns,
  reMapCSVData,
  reMapExcelData,
  validateConversation,
  validateFile
} from '../../../../src/lib/parsers/index';
import { getAvailableColumns as rawCsvColumns } from '../../../../src/lib/parsers/csv';
import { getAvailableColumns as rawExcelColumns } from '../../../../src/lib/parsers/excel';
import {
  createFile,
  createJsonFile,
  createCsvFile,
  createXlsxFile,
  makeConversation,
  JSON_MIME,
  CSV_MIME,
  XLSX_MIME,
  XLS_MIME
} from '../../../helpers/file';

/** 构造真实 .xls（BIFF8）文件 */
function createXlsFile(rows, fileName = 'legacy.xls') {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const array = XLSX.write(workbook, { type: 'array', bookType: 'xls' });
  return createFile(new Uint8Array(array), fileName, XLS_MIME);
}

describe('parseFile 按扩展名分发', () => {
  it('给定 .json 文件 → 使用 JSON 解析器', async () => {
    const file = createJsonFile([makeConversation('json-1')], 'conversations.json');

    const result = await parseFile(file);

    expect(result.success).toBe(true);
    expect(result.data.map(conv => conv.id)).toEqual(['json-1']);
  });

  it('给定 .csv 文件 → 使用 CSV 解析器并返回 preview/fieldMapping', async () => {
    const file = createCsvFile('id,user,assistant\n1,你好,您好\n', 'conversations.csv');

    const result = await parseFile(file);

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.fieldMapping).toEqual({ id: 'id', user: 'user', assistant: 'assistant' });
    expect(result.preview).toHaveLength(1);
  });

  it('给定 .xlsx 文件 → 使用 Excel 解析器并返回 sheets', async () => {
    const file = createXlsxFile([{ id: '1', user: '你好', assistant: '您好' }]);

    const result = await parseFile(file);

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.sheets).toEqual(['Sheet1']);
  });

  it('给定 options 选项 → 透传给具体解析器（CSV 自定义映射生效）', async () => {
    const file = createCsvFile('col1,col2,col3\n1,你好,您好\n', 'custom.csv');

    const result = await parseFile(file, {
      fieldMapping: { id: 'col1', user: 'col2', assistant: 'col3' }
    });

    expect(result.success).toBe(true);
    expect(result.fieldMapping).toEqual({ id: 'col1', user: 'col2', assistant: 'col3' });
  });

  it('给定 options.sheetName 不存在 → 透传给 Excel 解析器并返回找不到工作表', async () => {
    const file = createXlsxFile([{ id: '1', user: '你好', assistant: '您好' }]);

    const result = await parseFile(file, { sheetName: 'NoSuchSheet' });

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['找不到工作表：NoSuchSheet']);
  });

  it('给定扩展名非法（.pdf）→ 短路返回校验错误，不进入解析', async () => {
    const file = createFile('pdf-content', 'report.pdf', 'application/pdf');

    const result = await parseFile(file);

    expect(result.success).toBe(false);
    expect(result.data).toEqual([]);
    expect(result.preview).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('不支持的文件扩展名：.pdf');
  });

  it('给定空文件名 → 短路返回「文件名不能为空」', async () => {
    const file = { name: '', type: '', size: 0 };

    const result = await parseFile(file);

    expect(result).toEqual({
      success: false,
      data: [],
      errors: ['文件名不能为空'],
      preview: []
    });
  });

  it('给定白名单内扩展名但解析器不支持（.txt）→ 返回「不支持的文件格式：.txt」', async () => {
    // .txt 在 validateFile 默认 allowedExtensions 内，但 switch 没有对应分支
    const file = createFile('纯文本内容', 'notes.txt', 'text/plain');

    const result = await parseFile(file);

    expect(result.success).toBe(false);
    expect(result.data).toEqual([]);
    expect(result.preview).toEqual([]);
    expect(result.errors).toEqual(['不支持的文件格式：.txt']);
  });

  it('给定合法扩展名但非法 MIME（application/pdf + .json）→ 当前实现仅告警并继续解析（行为记录）', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const file = createFile(JSON.stringify([makeConversation('mime-ok')]), 'data.json', 'application/pdf');

    const result = await parseFile(file);

    // 实际行为：validateFile 不因 MIME 非法而拦截，仅 console.warn，随后仍按扩展名分发解析。
    expect(result.success).toBe(true);
    expect(result.data.map(conv => conv.id)).toEqual(['mime-ok']);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('给定 .xls + application/vnd.ms-excel → 当前实现未被 MIME 白名单拒绝，进入 Excel 解析器（配置风险）', async () => {
    // XLS_MIME 不在 validateFile 默认 allowedTypes 中，但 MIME 只告警；扩展名 .xls 合法。
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const file = createXlsFile([{ id: '1', user: '你好', assistant: '您好' }]);

    const result = await parseFile(file);

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.sheets).toEqual(['Sheet1']);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('给定 options.maxSize 缩小阈值 → parseFile 把验证选项透传给 validateFile（BUG-05 已修复）', async () => {
    const file = createJsonFile([makeConversation('big')], 'data.json');

    const result = await parseFile(file, { maxSize: 1 });

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('文件过大');
  });
});

describe('index.js 聚合导出', () => {
  it('给定聚合入口 → 解析器与验证器均可直接导入', () => {
    expect(parseJSON).toBeTypeOf('function');
    expect(parseCSV).toBeTypeOf('function');
    expect(parseExcel).toBeTypeOf('function');
    expect(validateConversation).toBeTypeOf('function');
    expect(validateFile).toBeTypeOf('function');
    expect(reMapCSVData).toBeTypeOf('function');
    expect(reMapExcelData).toBeTypeOf('function');
  });

  it('给定聚合入口 → getCSVColumns/getExcelColumns 与原模块导出一致', () => {
    expect(getCSVColumns).toBe(rawCsvColumns);
    expect(getExcelColumns).toBe(rawExcelColumns);
  });
});
