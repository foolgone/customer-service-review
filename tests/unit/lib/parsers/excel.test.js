/**
 * Excel 解析器单元测试：src/lib/parsers/excel.js
 *
 * 使用 xlsx（SheetJS）在测试内生成真实 .xlsx/.xls 二进制文件，
 * 并复用 tests/helpers/file.js 的 createXlsxFile 工厂。
 */
import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';
import {
  parseExcel,
  getAvailableColumns,
  reMapExcelData
} from '../../../../src/lib/parsers/excel';
import {
  createXlsxFile,
  createFile,
  XLSX_MIME,
  XLS_MIME
} from '../../../helpers/file';

/**
 * 用给定的 worksheet 构造 .xlsx File（用于空表/仅表头等特殊工作表）
 */
function xlsxFileFromWorksheet(worksheet, sheetName = 'Sheet1', fileName = 'custom.xlsx') {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const array = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return createFile(new Uint8Array(array), fileName, XLSX_MIME);
}

/** 构造真实 .xls（BIFF8）文件 */
function xlsFileFromRows(rows, fileName = 'legacy.xls') {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const array = XLSX.write(workbook, { type: 'array', bookType: 'xls' });
  return createFile(new Uint8Array(array), fileName, XLS_MIME);
}

describe('parseExcel', () => {
  it('给定标准英文表头 xlsx → 解析成功并生成标准对话结构', async () => {
    const file = createXlsxFile([
      { id: '1', user: '你好', assistant: '您好' },
      { id: '2', user: '在吗', assistant: '在的' }
    ]);

    const result = await parseExcel(file);

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({
      id: '1',
      turns: [
        { role: 'user', content: '你好', timestamp: null },
        { role: 'assistant', content: '您好', timestamp: null }
      ],
      metadata: { source: 'excel', rowIndex: 0 }
    });
    expect(result.data[1].metadata.rowIndex).toBe(1);
    expect(result.fieldMapping).toEqual({ id: 'id', user: 'user', assistant: 'assistant' });
  });

  it('给定 xlsx → 返回 sheets / preview / rows', async () => {
    const rows = [{ id: '1', user: '你好', assistant: '您好' }];

    const result = await parseExcel(createXlsxFile(rows));

    expect(result.sheets).toEqual(['Sheet1']);
    expect(result.rows).toEqual(rows);
    expect(result.preview).toEqual(rows);
  });

  it('给定中文表头 编号/用户/客服 → 自动映射到 id/user/assistant', async () => {
    const file = createXlsxFile([{ 编号: '001', 用户: '你好', 客服: '您好' }]);

    const result = await parseExcel(file);

    expect(result.success).toBe(true);
    expect(result.fieldMapping).toEqual({ id: '编号', user: '用户', assistant: '客服' });
    expect(result.data[0].id).toBe('001');
  });

  it('给定候选表头 对话ID/用户消息/客服回复 → 自动识别', async () => {
    const file = createXlsxFile([{ 对话ID: '001', 用户消息: '你好', 客服回复: '您好' }]);

    const result = await parseExcel(file);

    expect(result.fieldMapping).toEqual({
      id: '对话ID',
      user: '用户消息',
      assistant: '客服回复'
    });
  });

  it('给定字段名不可识别 → 回退使用前三列', async () => {
    const file = createXlsxFile([{ a: '1', b: '你好', c: '您好' }]);

    const result = await parseExcel(file);

    expect(result.fieldMapping).toEqual({ id: 'a', user: 'b', assistant: 'c' });
    expect(result.data).toHaveLength(1);
  });

  it('给定不存在的 sheetName → success:false 且提示「找不到工作表」', async () => {
    const file = createXlsxFile([{ id: '1', user: '你好', assistant: '您好' }]);

    const result = await parseExcel(file, { sheetName: 'NoSuchSheet' });

    expect(result.success).toBe(false);
    expect(result.data).toEqual([]);
    expect(result.errors).toEqual(['找不到工作表：NoSuchSheet']);
    expect(result.sheets).toEqual(['Sheet1']);
    expect(result.preview).toEqual([]);
  });

  it('给定仅含表头、无数据行的工作表 → success:false 且提示「Excel 工作表为空」', async () => {
    // sheet_to_json 默认把首行当表头，表头之后没有数据行时返回 []
    const file = xlsxFileFromWorksheet(
      XLSX.utils.aoa_to_sheet([['id', 'user', 'assistant']]),
      'HeaderOnly'
    );

    const result = await parseExcel(file);

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Excel 工作表为空']);
    expect(result.sheets).toEqual(['HeaderOnly']);
    expect(result.preview).toEqual([]);
  });

  it('给定完全空白的工作表 → success:false 且提示「Excel 工作表为空」', async () => {
    const file = xlsxFileFromWorksheet(XLSX.utils.aoa_to_sheet([]), 'Empty');

    const result = await parseExcel(file);

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Excel 工作表为空']);
  });

  it('给定 options.fieldMapping 自定义映射 → 按指定列解析', async () => {
    const file = createXlsxFile([{ col1: '1', col2: '你好', col3: '您好' }]);

    const result = await parseExcel(file, {
      fieldMapping: { id: 'col1', user: 'col2', assistant: 'col3' }
    });

    expect(result.fieldMapping).toEqual({ id: 'col1', user: 'col2', assistant: 'col3' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('1');
  });

  it('给定必填列为空的行 → 该行被过滤且不产生 errors', async () => {
    const file = createXlsxFile([
      { id: '1', user: '你好', assistant: '您好' },
      { id: '2', user: '在吗', assistant: '' },
      { id: '', user: '在吗', assistant: '在的' }
    ]);

    const result = await parseExcel(file);

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('1');
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(3);
  });

  it('给定 12 行数据 → preview 最多返回前 10 条，data 保留全部', async () => {
    const rows = [];
    for (let i = 1; i <= 12; i += 1) {
      rows.push({ id: String(i), user: `问题${i}`, assistant: `回复${i}` });
    }

    const result = await parseExcel(createXlsxFile(rows));

    expect(result.data).toHaveLength(12);
    expect(result.preview).toHaveLength(10);
    expect(result.preview[9]).toEqual({ id: '10', user: '问题10', assistant: '回复10' });
  });

  it('给定真实 .xls（BIFF8）文件 → 同样可以解析', async () => {
    const file = xlsFileFromRows([{ id: '1', user: '你好', assistant: '您好' }]);

    const result = await parseExcel(file);

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('1');
  });

  it('给定非表格内容伪装成 .xlsx → SheetJS 生成默认空表，返回「Excel 工作表为空」（行为记录）', async () => {
    const file = createFile(new Uint8Array([1, 2, 3, 4]), 'garbage.xlsx', XLSX_MIME);

    const result = await parseExcel(file);

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['Excel 工作表为空']);
  });

  it('给定文件读取抛出异常 → success:false 且错误含「解析失败」', async () => {
    const file = {
      name: 'broken.xlsx',
      arrayBuffer: async () => {
        throw new Error('boom');
      }
    };

    const result = await parseExcel(file);

    expect(result).toEqual({
      success: false,
      data: [],
      errors: ['解析失败：boom'],
      sheets: [],
      preview: []
    });
  });
});

describe('getAvailableColumns', () => {
  it('给定 rows 为 undefined/空数组 → 返回空数组', () => {
    expect(getAvailableColumns(undefined)).toEqual([]);
    expect(getAvailableColumns(null)).toEqual([]);
    expect(getAvailableColumns([])).toEqual([]);
  });

  it('给定数据行 → 返回首行列名', () => {
    expect(getAvailableColumns([{ id: '1', user: '你好', assistant: '您好' }])).toEqual([
      'id',
      'user',
      'assistant'
    ]);
  });
});

describe('reMapExcelData', () => {
  const rows = [
    { a: '1', b: '你好', c: '您好' },
    { a: '2', b: '在吗', c: '在的' }
  ];

  it('给定合法映射 → 重新映射成功并生成对话', () => {
    const result = reMapExcelData(rows, { id: 'a', user: 'b', assistant: 'c' });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({
      id: '1',
      turns: [
        { role: 'user', content: '你好', timestamp: null },
        { role: 'assistant', content: '您好', timestamp: null }
      ],
      metadata: { source: 'excel', rowIndex: 0 }
    });
    expect(result.errors).toEqual([]);
  });

  it('给定缺少必填映射 → 与 CSV 行为一致，返回映射错误（BUG-05 已修复）', () => {
    const result = reMapExcelData(rows, {});

    expect(result.success).toBe(false);
    expect(result.data).toEqual([]);
    expect(result.errors).toEqual([
      '缺少必填字段映射：id',
      '缺少必填字段映射：user',
      '缺少必填字段映射：assistant'
    ]);
  });

  it('给定映射到的列不存在 → 行被过滤，data 为空', () => {
    const result = reMapExcelData(rows, { id: 'a', user: 'x', assistant: 'y' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
  });

  it('给定 rows 为 null → 捕获异常并返回「重新映射失败」', () => {
    const result = reMapExcelData(null, { id: 'a', user: 'b', assistant: 'c' });

    expect(result.success).toBe(false);
    expect(result.data).toEqual([]);
    expect(result.errors[0]).toContain('重新映射失败');
  });

  it('给定单元格取值抛错（toString 抛异常）→ 单行转换失败被过滤并告警', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const badRows = [
      {
        id: {
          toString() {
            throw new Error('无法转字符串');
          }
        },
        user: '你好',
        assistant: '您好'
      }
    ];

    const result = reMapExcelData(badRows, { id: 'id', user: 'user', assistant: 'assistant' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('第 1 行转换失败');
  });
});
