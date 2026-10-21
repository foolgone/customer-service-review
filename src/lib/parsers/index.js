/**
 * 数据解析器统一入口
 */

import { parseJSON } from './json';
import { parseCSV } from './csv';
import { parseExcel } from './excel';
import { validateFile } from './validator';

/**
 * 根据文件类型自动选择解析器
 * @param {File} file - 文件对象
 * @param {Object} options - 解析选项
 * @returns {Promise<Object>} 解析结果
 */
export async function parseFile(file, options = {}) {
  // 验证文件（把调用方选项透传给 validateFile：支持自定义扩展名白名单 / 大小上限）
  const validation = validateFile(file, options);
  if (!validation.valid) {
    return {
      success: false,
      data: [],
      errors: [validation.error],
      preview: []
    };
  }

  // 获取文件扩展名
  const ext = file.name.split('.').pop()?.toLowerCase();

  // 根据扩展名选择解析器
  switch (ext) {
    case 'json':
      return parseJSON(file, options);

    case 'csv':
      return parseCSV(file, options);

    case 'xlsx':
    case 'xls':
      return parseExcel(file, options);

    default:
      return {
        success: false,
        data: [],
        errors: [`不支持的文件格式：.${ext}`],
        preview: []
      };
  }
}

// 导出各个解析器
export { parseJSON } from './json';
export { parseCSV, getAvailableColumns as getCSVColumns, reMapCSVData } from './csv';
export { parseExcel, getAvailableColumns as getExcelColumns, reMapExcelData } from './excel';

// 导出验证器
export {
  validateFile,
  validateConversation,
  validateConversations,
  validateFieldMapping,
  validateAIResult,
  normalizeConversation,
  normalizeAIResult,
  checkDuplicates
} from './validator';
