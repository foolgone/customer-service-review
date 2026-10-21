/**
 * CSV 解析器
 */

import Papa from 'papaparse';
import { validateConversations } from './validator';

/**
 * 解析 CSV 文件
 * @param {File} file - CSV 文件
 * @param {Object} options - 解析选项
 * @returns {Promise<Object>} { success: boolean, data: Conversation[], errors: any[], preview: any[] }
 */
export async function parseCSV(file, options = {}) {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: options.encoding || 'UTF-8',
      complete: (results) => {
        try {
          // 检查是否有数据
          if (!results.data || results.data.length === 0) {
            resolve({
              success: false,
              data: [],
              errors: ['CSV 文件为空'],
              preview: []
            });
            return;
          }

          // 自动检测字段映射或使用提供的映射
          const fieldMapping = options.fieldMapping || autoDetectFieldMapping(results.data[0]);

          // 转换为标准格式
          const conversations = results.data.map((row, index) => {
            return rowToConversation(row, fieldMapping, index);
          }).filter(conv => conv !== null);

          // 验证数据
          const { valid, invalid } = validateConversations(conversations);

          // 生成预览数据（前 10 条）
          const preview = results.data.slice(0, 10);

          resolve({
            success: true,
            data: valid,
            rows: results.data,
            errors: [
              ...results.errors.map(err => `解析错误：${err.message}`),
              ...invalid.map(item => `第 ${item.index + 1} 行：${item.errors.join(', ')}`)
            ],
            preview,
            fieldMapping,
            meta: results.meta
          });
        } catch (error) {
          resolve({
            success: false,
            data: [],
            errors: [`解析失败：${error.message}`],
            preview: []
          });
        }
      },
      error: (error) => {
        resolve({
          success: false,
          data: [],
          errors: [`文件读取失败：${error.message}`],
          preview: []
        });
      }
    });
  });
}

/**
 * 自动检测字段映射
 * @param {Object} firstRow - 第一行数据
 * @returns {Object} 字段映射 { id: 'columnName', user: 'columnName', assistant: 'columnName' }
 */
function autoDetectFieldMapping(firstRow) {
  const mapping = {
    id: null,
    user: null,
    assistant: null
  };

  const columns = Object.keys(firstRow);

  // ID 字段检测
  const idCandidates = ['id', 'ID', '编号', 'conversation_id', 'conv_id', 'number', 'no'];
  for (const col of columns) {
    if (idCandidates.some(candidate => col.toLowerCase().includes(candidate.toLowerCase()))) {
      mapping.id = col;
      break;
    }
  }

  // 用户消息字段检测
  const userCandidates = ['user', 'USER', '用户', '客户', 'customer', 'question', '问题'];
  for (const col of columns) {
    if (userCandidates.some(candidate => col.toLowerCase().includes(candidate.toLowerCase()))) {
      mapping.user = col;
      break;
    }
  }

  // 客服回复字段检测
  const assistantCandidates = ['assistant', 'ASSISTANT', '客服', '回复', 'agent', 'reply', 'answer', 'response'];
  for (const col of columns) {
    if (assistantCandidates.some(candidate => col.toLowerCase().includes(candidate.toLowerCase()))) {
      mapping.assistant = col;
      break;
    }
  }

  // 如果没有检测到，使用第一个、第二个、第三个列
  if (!mapping.id && columns.length >= 1) mapping.id = columns[0];
  if (!mapping.user && columns.length >= 2) mapping.user = columns[1];
  if (!mapping.assistant && columns.length >= 3) mapping.assistant = columns[2];

  return mapping;
}

/**
 * 将 CSV 行转换为对话对象
 * @param {Object} row - CSV 行对象
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
        source: 'csv',
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
 * @param {Array} rows - CSV 数据行
 * @returns {string[]} 列名数组
 */
export function getAvailableColumns(rows) {
  if (!rows || rows.length === 0) return [];
  return Object.keys(rows[0]);
}

/**
 * 验证字段映射是否完整
 * @param {Object} mapping - 字段映射
 * @returns {Object} { valid: boolean, missing: string[] }
 */
export function validateMapping(mapping) {
  const required = ['id', 'user', 'assistant'];
  const missing = required.filter(field => !mapping[field]);

  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * 应用自定义字段映射重新解析
 * @param {Array} rows - 原始 CSV 行数据
 * @param {Object} fieldMapping - 新的字段映射
 * @returns {Object} { success: boolean, data: Conversation[], errors: any[] }
 */
export function reMapCSVData(rows, fieldMapping) {
  try {
    // 验证映射
    const mappingValidation = validateMapping(fieldMapping);
    if (!mappingValidation.valid) {
      return {
        success: false,
        data: [],
        errors: [`缺少必填字段映射：${mappingValidation.missing.join(', ')}`]
      };
    }

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
