/**
 * 测试数据工厂：构造 File / 对话对象
 */
import * as XLSX from 'xlsx';

export const JSON_MIME = 'application/json';
export const CSV_MIME = 'text/csv';
export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const XLS_MIME = 'application/vnd.ms-excel';

/**
 * 通用 File 构造器
 * @param {string|Uint8Array|ArrayBuffer} content 文件内容
 * @param {string} name 文件名
 * @param {string} type MIME 类型
 * @returns {File}
 */
export function createFile(content, name = 'test.json', type = JSON_MIME) {
  const parts = content instanceof Uint8Array || content instanceof ArrayBuffer ? [content] : [String(content)];
  return new File(parts, name, { type });
}

export function createJsonFile(data, name = 'conversations.json') {
  return createFile(JSON.stringify(data, null, 2), name, JSON_MIME);
}

export function createCsvFile(text, name = 'conversations.csv') {
  return createFile(text, name, CSV_MIME);
}

/**
 * 用 xlsx 生成真实的 .xlsx 文件内容（rows 为对象数组，键即表头）
 * @param {Object[]} rows
 * @param {string} name
 * @returns {File}
 */
export function createXlsxFile(rows, name = 'conversations.xlsx') {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const array = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return createFile(new Uint8Array(array), name, XLSX_MIME);
}

/**
 * 生成一个标准对话对象
 */
export function makeConversation(id = 'conv-1', options = {}) {
  return {
    id,
    turns: options.turns || [
      { role: 'user', content: options.userContent || '用户问题' },
      { role: 'assistant', content: options.assistantContent || '客服回复' }
    ],
    ...(options.metadata ? { metadata: options.metadata } : {})
  };
}

/**
 * 生成一个标准标注对象
 */
export function makeAnnotation(overrides = {}) {
  return {
    labels: ['accurate'],
    comment: '回复准确',
    score: 5,
    aiLabels: [],
    aiReason: '',
    aiAt: '',
    reviewedAt: '2024-05-01T10:00:00.000Z',
    updatedAt: '2024-05-01T10:00:00.000Z',
    startedAt: '2024-05-01T09:58:00.000Z',
    durationMs: 120000,
    ...overrides
  };
}
