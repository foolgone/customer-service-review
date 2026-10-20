/**
 * JSON 解析器
 */

import { validateConversations, normalizeConversation } from './validator';

/**
 * 解析 JSON 文件
 * @param {File} file - JSON 文件
 * @returns {Promise<Object>} { success: boolean, data: Conversation[], errors: any[] }
 */
export async function parseJSON(file) {
  try {
    // 读取文件内容
    const text = await file.text();

    // 解析 JSON
    let rawData;
    try {
      rawData = JSON.parse(text);
    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [`JSON 格式错误：${error.message}`]
      };
    }

    // 标准化数据格式
    let conversations = [];

    if (Array.isArray(rawData)) {
      // 数组格式：[{id, turns}, ...]
      conversations = rawData;
    } else if (rawData && typeof rawData === 'object') {
      // 单个对话对象：{id, turns}
      if (rawData.id && rawData.turns) {
        conversations = [rawData];
      }
      // 或包装对象：{conversations: [...]}
      else if (Array.isArray(rawData.conversations)) {
        conversations = rawData.conversations;
      }
      // 或包装对象：{data: [...]}
      else if (Array.isArray(rawData.data)) {
        conversations = rawData.data;
      } else {
        return {
          success: false,
          data: [],
          errors: ['JSON 格式不符合要求，需要数组或包含对话数据的对象']
        };
      }
    } else {
      return {
        success: false,
        data: [],
        errors: ['JSON 数据格式错误']
      };
    }

    // 验证和标准化
    const { valid, invalid } = validateConversations(conversations);

    return {
      success: true,
      data: valid,
      errors: invalid.map(item => `第 ${item.index + 1} 条对话：${item.errors.join(', ')}`)
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      errors: [`解析失败：${error.message}`]
    };
  }
}

/**
 * 自动检测 JSON 格式
 * @param {Object} data - JSON 数据
 * @returns {string} 格式类型
 */
function detectJSONFormat(data) {
  if (Array.isArray(data)) {
    return 'array';
  } else if (data && typeof data === 'object') {
    if (data.id && data.turns) {
      return 'single';
    } else if (Array.isArray(data.conversations)) {
      return 'wrapped_conversations';
    } else if (Array.isArray(data.data)) {
      return 'wrapped_data';
    }
  }
  return 'unknown';
}
