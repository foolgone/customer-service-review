/**
 * Excel 解析器
 */

import * as XLSX from 'xlsx';
import { validateConversations } from './validator';

/**
 * 解析 Excel 文件
 * @param {File} file - Excel 文件
 * @param {Object} options - 解析选项
 * @returns {Promise<Object>} { success: boolean, data: Conversation[], errors: any[], sheets: string[], preview: any[] }
 */
export async function parseExcel(file, options = {}) {
  try {
    // 读取文件
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // 获取所有 sheet 名称
    const sheetNames = workbook.SheetNames;

    if (sheetNames.length === 0) {
      return {
        success: false,
        data: [],
        errors: ['Excel 文件中没有工作表'],
        sheets: [],
        preview: []
      };
    }

    // 使用指定的 sheet 或第一个 sheet
    const sheetName = options.sheetName || sheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      return {
        success: false,
        data: [],
        errors: [`找不到工作表：${sheetName}`],
        sheets: sheetNames,
        preview: []
      };
    }

    // 转换为 JSON
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (rows.length === 0) {
      return {
        success: false,
        data: [],
        errors: ['Excel 工作表为空'],
        sheets: sheetNames,
        preview: []
      };
    }

    // 自动检测字段映射
    const fieldMapping = options.fieldMapping || autoDetectFieldMapping(rows[0]);

    // 转换为标准格式
    const conversations = rows.map((row, index) => {
      return rowToConversation(row, fieldMapping, index);
    }).filter(conv => conv !== null);

    // 验证数据
    const { valid, invalid } = validateConversations(conversations);

    // 生成预览数据（前 10 条）
    const preview = rows.slice(0, 10);

    return {
      success: true,
      data: valid,
      rows,
      errors: invalid.map(item => `第 ${item.index + 1} 行：${item.errors.join(', ')}`),
      sheets: sheetNames,
      preview,
      fieldMapping
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [`解析失败：${error.message}`],
      sheets: [],
      preview: []
    };
  }
}

/**
 * 自动检测字段映射
 * @param {Object} firstRow - 第一行数据
 * @returns {Object} 字段映射
 */
function autoDetectFieldMapping(firstRow) {
  const mapping = {
    id: null,
    user: null,
    assistant: null
  };

  const columns = Object.keys(firstRow);

  // ID 字段检测
  const idCandidates = ['id', 'ID', '编号', '对话ID', 'conversation_id', 'conv_id'];
  for (const col of columns) {
    if (idCandidates.some(candidate => col.includes(candidate))) {
      mapping.id = col;
      break;
    }
  }

  // 用户消息字段检测
  const userCandidates = ['user', 'USER', '用户', '用户消息', '客户', '问题'];
  for (const col of columns) {
    if (userCandidates.some(candidate => col.includes(candidate))) {
      mapping.user = col;
      break;
    }
  }

  // 客服回复字段检测
  const assistantCandidates = ['assistant', 'ASSISTANT', '客服', '客服回复', '回复', 'agent'];
  for (const col of columns) {
    if (assistantCandidates.some(candidate => col.includes(candidate))) {
      mapping.assistant = col;
      break;
    }
  }

  // 如果没有检测到，使用前三列
  if (!mapping.id && columns.length >= 1) mapping.id = columns[0];
  if (!mapping.user && columns.length >= 2) mapping.user = columns[1];
  if (!mapping.assistant && columns.length >= 3) mapping.assistant = columns[2];

  return mapping;
}

/**
 * 将 Excel 行转换为对话对象
 * @param {Object} row - Excel 行对象
 * @param {Object} fieldMapping - 字段映射
 * @param {number} index - 行索引
 * @returns {Object|null} 对话对象或 null
 */
function rowToConversation(row, fieldMapping, index) {
  try {
    const id = row[fieldMapping.id]?.toString().trim();
    const userContent = row[fieldMapping.user]?.toString().trim();
    const assistantContent = row[fieldMapping.assistant]?.toString().trim();

    // 检查必填字段
    if (!id || !userContent || !assistantContent) {
      return null;
    }

    return {
      id,
      turns: [
        { role: 'user', content: userContent },
        { role: 'assistant', content: assistantContent }
      ],
      metadata: {
        source: 'excel',
        rowIndex: index
      }
    };
  } catch (error) {
    console.warn(`第 ${index + 1} 行转换失败:`, error);
    return null;
  }
}

/**
 * 获取可用的列名
 * @param {Array} rows - Excel 数据行
 * @returns {string[]} 列名数组
 */
export function getAvailableColumns(rows) {
  if (!rows || rows.length === 0) return [];
  return Object.keys(rows[0]);
}

/**
 * 应用自定义字段映射重新解析
 * @param {Array} rows - 原始 Excel 行数据
 * @param {Object} fieldMapping - 新的字段映射
 * @returns {Object} { success: boolean, data: Conversation[], errors: any[] }
 */
export function reMapExcelData(rows, fieldMapping) {
  try {
    // 转换数据
    const conversations = rows.map((row, index) => {
      return rowToConversation(row, fieldMapping, index);
    }).filter(conv => conv !== null);

    // 验证数据
    const { valid, invalid } = validateConversations(conversations);

    return {
      success: true,
      data: valid,
      errors: invalid.map(item => `第 ${item.index + 1} 行：${item.errors.join(', ')}`)
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [`重新映射失败：${error.message}`]
    };
  }
}
