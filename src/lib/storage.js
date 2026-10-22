/**
 * LocalStorage 封装模块
 * 提供统一的数据存储和读取接口
 */

import { STORAGE_KEYS, DEFAULT_ANNOTATION } from './constants';
import { toLabelArray } from './labels';
import { safeJsonParse, safeJsonStringify } from './utils';

/**
 * 保存数据到 LocalStorage
 * @param {string} key - 存储键
 * @param {any} value - 值
 * @returns {boolean} 是否成功
 */
function setItem(key, value) {
  try {
    const jsonStr = safeJsonStringify(value);
    localStorage.setItem(key, jsonStr);
    return true;
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.error('LocalStorage 已满，请清理数据');
      throw new Error('存储空间不足，请导出数据后清理');
    } else {
      console.error('保存数据失败:', error);
      throw new Error('保存数据失败');
    }
  }
}

/**
 * 从 LocalStorage 读取数据
 * @param {string} key - 存储键
 * @param {any} defaultValue - 默认值
 * @returns {any} 读取的值或默认值
 */
function getItem(key, defaultValue = null) {
  try {
    const jsonStr = localStorage.getItem(key);
    if (jsonStr === null) {
      return defaultValue;
    }
    return safeJsonParse(jsonStr, defaultValue);
  } catch (error) {
    console.error('读取数据失败:', error);
    return defaultValue;
  }
}

/**
 * 从 LocalStorage 删除数据
 * @param {string} key - 存储键
 */
function removeItem(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('删除数据失败:', error);
  }
}

/**
 * 清空 LocalStorage
 */
function clear() {
  try {
    localStorage.clear();
  } catch (error) {
    console.error('清空数据失败:', error);
  }
}

/**
 * 获取 LocalStorage 使用情况
 * @returns {Object} { used: number, total: number, percent: number }
 */
function getStorageInfo() {
  let used = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      used += localStorage[key].length + key.length;
    }
  }

  // 大多数浏览器限制为 5-10MB，这里按 5MB 计算
  const total = 5 * 1024 * 1024;
  const percent = Math.round((used / total) * 100);

  return {
    used,
    total,
    percent,
    usedMB: (used / 1024 / 1024).toFixed(2),
    totalMB: (total / 1024 / 1024).toFixed(2),
  };
}

// ==================== 标注数据相关 ====================

/**
 * 保存标注数据
 * @param {string} conversationId - 对话 ID
 * @param {Object} annotation - 标注对象
 */
export function saveAnnotation(conversationId, annotation) {
  const annotations = getAnnotations();
  annotations[conversationId] = {
    ...annotation,
    updatedAt: new Date().toISOString(),
  };
  setItem(STORAGE_KEYS.annotations, annotations);
}

/**
 * 获取单个标注
 * @param {string} conversationId - 对话 ID
 * @returns {Object|null} 标注对象或 null
 */
export function getAnnotation(conversationId) {
  const annotations = getAnnotations();
  return annotations[conversationId] || null;
}

/**
 * 获取所有标注
 * @returns {Object} 标注对象集合 { id: annotation }
 */
export function getAnnotations() {
  return getItem(STORAGE_KEYS.annotations, {});
}

/**
 * 删除单个标注
 * @param {string} conversationId - 对话 ID
 */
export function deleteAnnotation(conversationId) {
  const annotations = getAnnotations();
  delete annotations[conversationId];
  setItem(STORAGE_KEYS.annotations, annotations);
}

/**
 * 清空所有标注
 */
export function clearAnnotations() {
  setItem(STORAGE_KEYS.annotations, {});
}

/**
 * 标准化标注对象（确保所有字段存在）
 * @param {Object} annotation - 原始标注对象
 * @returns {Object} 标准化后的标注对象
 */
export function normalizeAnnotation(annotation) {
  const merged = {
    ...DEFAULT_ANNOTATION,
    ...(annotation || {}),
  };

  return {
    ...merged,
    labels: toLabelArray(merged.labels),
    aiLabels: toLabelArray(merged.aiLabels),
  };
}

/**
 * 批量保存标注
 * @param {Object} annotations - 标注对象集合
 */
export function saveAnnotations(annotations) {
  setItem(STORAGE_KEYS.annotations, annotations);
}

/**
 * 加载标注数据（别名，兼容旧代码）
 * @returns {Object} 标注对象集合
 */
export function loadAnnotations() {
  return getAnnotations();
}

/**
 * 导入标注数据（合并模式）
 * @param {Object} newAnnotations - 新标注数据
 * @param {boolean} overwrite - 是否覆盖已有数据
 */
export function importAnnotations(newAnnotations, overwrite = false) {
  if (overwrite) {
    setItem(STORAGE_KEYS.annotations, newAnnotations);
  } else {
    const existing = getAnnotations();
    const merged = { ...existing, ...newAnnotations };
    setItem(STORAGE_KEYS.annotations, merged);
  }
}

// ==================== 主题相关 ====================

/**
 * 保存主题设置
 * @param {string} theme - 主题 ('light' | 'dark')
 */
export function saveTheme(theme) {
  setItem(STORAGE_KEYS.theme, theme);
}

/**
 * 获取主题设置
 * @returns {string} 主题 ('light' | 'dark')
 */
export function getTheme() {
  return getItem(STORAGE_KEYS.theme, 'light');
}

/**
 * 读取主题设置（别名，兼容旧代码）
 * @returns {string} 主题
 */
export function readStoredTheme() {
  return getTheme();
}

/**
 * 写入主题设置（别名，兼容旧代码）
 * @param {string} theme - 主题
 */
export function writeStoredTheme(theme) {
  saveTheme(theme);
}

// ==================== 配置相关 ====================

const CONFIG_KEY = 'cs-review-config-v1';

/**
 * 保存配置
 * @param {Object} config - 配置对象
 */
export function saveConfig(config) {
  setItem(CONFIG_KEY, config);
}

/**
 * 获取配置
 * @returns {Object} 配置对象
 */
export function getConfig() {
  return getItem(CONFIG_KEY, {
    aiModel: 'deepseek',
    apiKey: '',
    apiEndpoint: 'https://api.deepseek.com/chat/completions',
    temperature: 0.7,
    maxTokens: 2000,
    autoSave: true,
  });
}

/**
 * 更新配置（部分更新）
 * @param {Object} updates - 要更新的字段
 */
export function updateConfig(updates) {
  const config = getConfig();
  const newConfig = { ...config, ...updates };
  saveConfig(newConfig);
}

/**
 * 重置配置为默认值
 */
export function resetConfig() {
  removeItem(CONFIG_KEY);
}

// ==================== 导入历史相关（可选）====================

const IMPORT_HISTORY_KEY = 'cs-review-import-history-v1';

/**
 * 添加导入历史记录
 * @param {Object} record - 导入记录
 */
export function addImportHistory(record) {
  const history = getImportHistory();
  history.unshift({
    ...record,
    importedAt: new Date().toISOString(),
  });

  // 只保留最近 20 条
  if (history.length > 20) {
    history.splice(20);
  }

  setItem(IMPORT_HISTORY_KEY, history);
}

/**
 * 获取导入历史
 * @returns {Array} 导入历史数组
 */
export function getImportHistory() {
  return getItem(IMPORT_HISTORY_KEY, []);
}

/**
 * 清空导入历史
 */
export function clearImportHistory() {
  removeItem(IMPORT_HISTORY_KEY);
}

// ==================== 工具函数 ====================

// 备份中允许携带的配置字段（API Key 属于敏感信息，不导出、也不从备份覆盖）
const BACKUP_CONFIG_FIELDS = ['aiModel', 'temperature', 'maxTokens', 'autoSave', 'concurrency'];

function pickBackupConfig(config = {}) {
  const picked = {};

  BACKUP_CONFIG_FIELDS.forEach((field) => {
    if (config[field] !== undefined) {
      picked[field] = config[field];
    }
  });

  return picked;
}

/**
 * 导出所有数据（用于备份）
 * 注意：不会导出 API Key（BUG-26），避免备份文件泄露凭证
 * @returns {Object} 所有数据
 */
export function exportAllData() {
  return {
    annotations: getAnnotations(),
    theme: getTheme(),
    config: pickBackupConfig(getConfig()),
    importHistory: getImportHistory(),
    exportedAt: new Date().toISOString(),
    note: 'API Key 不包含在备份中，恢复后需在设置中重新填写',
  };
}

/**
 * 导入所有数据（用于恢复）
 * - 只接受非空对象；字段做白名单校验（BUG-26）
 * - 备份中的配置不会覆盖本机已有的 API Key
 * @param {Object} data - 数据对象
 * @param {boolean} overwrite - 是否覆盖标注
 * @returns {Object} { restored: boolean, fields: string[], reason: 'ok'|'invalid'|'empty' }
 */
export function importAllData(data, overwrite = false) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { restored: false, fields: [], reason: 'invalid' };
  }

  const fields = [];

  if (data.annotations && typeof data.annotations === 'object' && !Array.isArray(data.annotations)) {
    importAnnotations(data.annotations, overwrite);
    fields.push('标注');
  }

  if (typeof data.theme === 'string' && ['light', 'dark', 'system'].includes(data.theme)) {
    saveTheme(data.theme);
    fields.push('主题');
  }

  const config =
    data.config && typeof data.config === 'object' && !Array.isArray(data.config)
      ? pickBackupConfig(data.config)
      : null;

  if (config && Object.keys(config).length) {
    if (overwrite) {
      // 合并写入并保留本机 API Key，避免备份把 Key 清空或替换
      saveConfig({ ...getConfig(), ...config });
    } else {
      updateConfig(config);
    }
    fields.push('配置');
  }

  if (!fields.length) {
    return { restored: false, fields: [], reason: 'empty' };
  }

  return { restored: true, fields, reason: 'ok' };
}

/**
 * 检查存储容量是否即将满
 * @param {number} threshold - 阈值百分比（默认 80）
 * @returns {boolean} 是否超过阈值
 */
export function isStorageAlmostFull(threshold = 80) {
  const info = getStorageInfo();
  return info.percent >= threshold;
}

/**
 * 获取存储使用提示
 * @returns {string|null} 提示信息或 null
 */
export function getStorageWarning() {
  const info = getStorageInfo();

  if (info.percent >= 90) {
    return `存储空间即将用尽（已使用 ${info.percent}%），请尽快导出数据并清理。`;
  } else if (info.percent >= 80) {
    return `存储空间使用较多（已使用 ${info.percent}%），建议定期导出数据。`;
  }

  return null;
}

// 导出基础函数（供高级用户使用）
export const storage = {
  setItem,
  getItem,
  removeItem,
  clear,
  getStorageInfo,
};
