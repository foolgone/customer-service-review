/**
 * CSV 解析器单元测试：src/lib/parsers/csv.js
 *
 * 使用真实 papaparse + jsdom File，覆盖自动映射、回退映射、行过滤、预览、
 * 自定义映射、重新映射以及错误分支。
 */
import { describe, it, expect, vi } from 'vitest';
import {
  parseCSV,
  getAvailableColumns,
  validateMapping,
  reMapCSVData
} from '../../../../src/lib/parsers/csv';
import { createCsvFile } from '../../../helpers/file';

describe('parseCSV', () => {
  it('给定标准英文表头 id,user,assistant → 解析成功并生成标准对话结构', async () => {
    const file = createCsvFile('id,user,assistant\n1,你好,您好\n2,在吗,在的\n');

    const result = await parseCSV(file);

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({
      id: '1',
      turns: [
        { role: 'user', content: '你好', timestamp: null },
        { role: 'assistant', content: '您好', timestamp: null }
      ],
      metadata: { source: 'csv', rowIndex: 0 }
    });
    expect(result.data[1].metadata.rowIndex).toBe(1);
    expect(result.fieldMapping).toEqual({ id: 'id', user: 'user', assistant: 'assistant' });
  });

  it('给定 CSV 解析结果 → 返回 rows / preview / meta（Papa 元信息）', async () => {
    const file = createCsvFile('id,user,assistant\n1,你好,您好\n');

    const result = await parseCSV(file);

    expect(result.rows).toEqual([{ id: '1', user: '你好', assistant: '您好' }]);
    expect(result.preview).toEqual(result.rows);
    expect(result.meta.delimiter).toBe(',');
    expect(result.meta.fields).toEqual(['id', 'user', 'assistant']);
    expect(result.meta.aborted).toBe(false);
    expect(result.meta.truncated).toBe(false);
  });

  it('给定中文表头 编号/用户/客服 → 自动映射到 id/user/assistant', async () => {
    const file = createCsvFile('编号,用户,客服\n001,你好,您好\n');

    const result = await parseCSV(file);

    expect(result.success).toBe(true);
    expect(result.fieldMapping).toEqual({ id: '编号', user: '用户', assistant: '客服' });
    expect(result.data[0].id).toBe('001');
  });

  it('给定字段名不可识别（a,b,c）→ 回退使用前三列', async () => {
    const file = createCsvFile('a,b,c\n1,你好,您好\n');

    const result = await parseCSV(file);

    expect(result.fieldMapping).toEqual({ id: 'a', user: 'b', assistant: 'c' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('1');
  });

  it('给定完全无表头的 CSV → 首行被 Papa 当作表头，回退映射后仍能解析剩余行', async () => {
    // 注意：header:true 下“无表头”意味着第一行数据会被当作列名，这是 Papa 的实际行为。
    const file = createCsvFile('张三,你好,谢谢\n李四,在吗,在的\n');

    const result = await parseCSV(file);

    expect(result.fieldMapping).toEqual({ id: '张三', user: '你好', assistant: '谢谢' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('李四');
    expect(result.data[0].turns[0].content).toBe('在吗');
  });

  it('给定必填列为空的行 → 该行被跳过，并在 skippedRows 中给出具体行号与原因（BUG-06 已修复）', async () => {
    const file = createCsvFile('id,user,assistant\n1,你好,您好\n2,在吗,\n3,,您好\n');

    const result = await parseCSV(file);

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('1');
    expect(result.rows).toHaveLength(3);
    expect(result.preview).toHaveLength(3);
    // 被跳过的行不再静默消失：给出行号 + 缺少的字段
    expect(result.skippedRows).toEqual([
      { row: 2, reason: '缺少必填字段：客服回复' },
      { row: 3, reason: '缺少必填字段：用户消息' }
    ]);
  });

  it('给定空字符串 CSV → success:false 且错误为「CSV 文件为空」', async () => {
    const result = await parseCSV(createCsvFile(''));

    expect(result).toEqual({
      success: false,
      data: [],
      errors: ['CSV 文件为空'],
      preview: []
    });
  });

  it('给定只有换行的 CSV → 同样视为空文件', async () => {
    const result = await parseCSV(createCsvFile('\n\n\n'));

    expect(result.success).toBe(false);
    expect(result.errors).toEqual(['CSV 文件为空']);
  });

  it('给定 options.fieldMapping 自定义映射 → 按指定列解析', async () => {
    const file = createCsvFile('col1,col2,col3\n1,你好,您好\n');

    const result = await parseCSV(file, {
      fieldMapping: { id: 'col1', user: 'col2', assistant: 'col3' }
    });

    expect(result.success).toBe(true);
    expect(result.fieldMapping).toEqual({ id: 'col1', user: 'col2', assistant: 'col3' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('1');
  });

  it('给定 12 行数据 → preview 最多返回前 10 条，data 保留全部 12 条', async () => {
    const lines = ['id,user,assistant'];
    for (let i = 1; i <= 12; i += 1) {
      lines.push(`${i},问题${i},回复${i}`);
    }
    const result = await parseCSV(createCsvFile(lines.join('\n')));

    expect(result.data).toHaveLength(12);
    expect(result.preview).toHaveLength(10);
    expect(result.preview[9]).toEqual({ id: '10', user: '问题10', assistant: '回复10' });
  });

  it('给定带引号且内含逗号的字段 → 内容被正确还原', async () => {
    const file = createCsvFile('id,user,assistant\n1,"你好, 在吗","您好, 在的"\n');

    const result = await parseCSV(file);

    expect(result.data[0].turns[0].content).toBe('你好, 在吗');
    expect(result.data[0].turns[1].content).toBe('您好, 在的');
  });

  it('给定文件读取失败（FileReader 报错）→ success:false 且错误含「文件读取失败」', async () => {
    const OriginalFileReader = globalThis.FileReader;
    // Papa 的 FileStreamer._chunkError 读取 reader.error 后传给 config.error，
    // 因此需要同时模拟 reader.error，才能走通「文件读取失败」分支。
    class BrokenFileReader {
      readAsText() {
        setTimeout(() => {
          this.error = new Error('read fail');
          this.onerror && this.onerror();
        }, 0);
      }
      readAsArrayBuffer() {
        setTimeout(() => {
          this.error = new Error('read fail');
          this.onerror && this.onerror();
        }, 0);
      }
    }
    globalThis.FileReader = BrokenFileReader;
    try {
      const result = await parseCSV(createCsvFile('id,user,assistant\n1,你好,您好\n'));

      expect(result.success).toBe(false);
      expect(result.data).toEqual([]);
      expect(result.preview).toEqual([]);
      expect(result.errors[0]).toContain('文件读取失败');
    } finally {
      globalThis.FileReader = OriginalFileReader;
    }
  });

  it('给定解析过程内部抛出异常（注入抛错的 fieldMapping getter）→ success:false 且错误含「解析失败」', async () => {
    const file = createCsvFile('id,user,assistant\n1,你好,您好\n');
    const options = {
      get fieldMapping() {
        throw new Error('mapper boom');
      }
    };

    const result = await parseCSV(file, options);

    expect(result).toEqual({
      success: false,
      data: [],
      errors: ['解析失败：mapper boom'],
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

  it('给定数据行 → 返回首行的列名', () => {
    expect(getAvailableColumns([{ id: '1', user: '你好', assistant: '您好' }])).toEqual([
      'id',
      'user',
      'assistant'
    ]);
  });
});

describe('validateMapping', () => {
  it('给定三字段齐全 → valid:true 且 missing 为空', () => {
    expect(validateMapping({ id: 'a', user: 'b', assistant: 'c' })).toEqual({
      valid: true,
      missing: []
    });
  });

  it('给定缺少字段 → 列出缺失字段', () => {
    expect(validateMapping({ id: 'a' })).toEqual({
      valid: false,
      missing: ['user', 'assistant']
    });
  });

  it('给定空对象 → 三个字段全部缺失', () => {
    expect(validateMapping({}).missing).toEqual(['id', 'user', 'assistant']);
  });
});

describe('reMapCSVData', () => {
  const rows = [
    { a: '1', b: '你好', c: '您好' },
    { a: '2', b: '在吗', c: '在的' }
  ];

  it('给定合法映射 → 重新映射成功并生成对话', () => {
    const result = reMapCSVData(rows, { id: 'a', user: 'b', assistant: 'c' });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({
      id: '1',
      turns: [
        { role: 'user', content: '你好', timestamp: null },
        { role: 'assistant', content: '您好', timestamp: null }
      ],
      metadata: { source: 'csv', rowIndex: 0 }
    });
    expect(result.errors).toEqual([]);
  });

  it('给定缺少必填映射 → success:false 并列出缺失字段', () => {
    const result = reMapCSVData(rows, { id: 'a' });

    expect(result.success).toBe(false);
    expect(result.data).toEqual([]);
    expect(result.errors).toEqual(['缺少必填字段映射：user, assistant']);
  });

  it('给定映射到的列不存在 → 行被过滤，success 仍为 true 但 data 为空', () => {
    const result = reMapCSVData(rows, { id: 'a', user: 'x', assistant: 'y' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('给定 rows 为 null → 捕获异常并返回「重新映射失败」', () => {
    const result = reMapCSVData(null, { id: 'a', user: 'b', assistant: 'c' });

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

    const result = reMapCSVData(badRows, { id: 'id', user: 'user', assistant: 'assistant' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('第 1 行转换失败');
  });
});
