/**
 * 通用工具函数库
 */

/**
 * 获取对话中指定角色的消息内容
 * @param {Object} conversation - 对话对象
 * @param {string} role - 角色 ('user' | 'assistant')
 * @returns {string} 消息内容
 */
export function getConversationText(conversation, role) {
  if (!conversation || !conversation.turns) {
    return '';
  }
  const turn = conversation.turns.find((turn) => turn.role === role);
  return turn?.content || '';
}

/**
 * 生成唯一 ID
 * @returns {string} 唯一 ID
 */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 格式化日期时间
 * @param {string|Date} date - 日期
 * @param {string} format - 格式 ('date' | 'datetime' | 'time')
 * @returns {string} 格式化后的字符串
 */
export function formatDate(date, format = 'datetime') {
  if (!date) return '';

  const d = new Date(date);
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  switch (format) {
    case 'date':
      return `${year}-${month}-${day}`;
    case 'time':
      return `${hours}:${minutes}:${seconds}`;
    case 'datetime':
    default:
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}

/**
 * 格式化时长
 * @param {number} ms - 毫秒数
 * @returns {string} 格式化后的字符串 (如 "2分30秒")
 */
export function formatDuration(ms) {
  if (!ms || ms < 0) return '0秒';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分${seconds % 60}秒`;
  } else {
    return `${seconds}秒`;
  }
}

/**
 * 防抖函数
 * @param {Function} fn - 要防抖的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * 节流函数
 * @param {Function} fn - 要节流的函数
 * @param {number} interval - 间隔时间（毫秒）
 * @returns {Function} 节流后的函数
 */
export function throttle(fn, interval = 300) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

/**
 * 深拷贝对象
 * @param {any} obj - 要拷贝的对象
 * @returns {any} 拷贝后的对象
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }

  if (obj instanceof Object) {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
}

/**
 * 下载文件
 * @param {Blob} blob - 文件 Blob
 * @param {string} filename - 文件名
 */
export function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 获取文件扩展名
 * @param {string} filename - 文件名
 * @returns {string} 扩展名（小写）
 */
export function getFileExtension(filename) {
  if (!filename) return '';
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

/**
 * 验证文件类型
 * @param {File} file - 文件对象
 * @param {string[]} allowedTypes - 允许的 MIME 类型
 * @returns {boolean} 是否有效
 */
export function validateFileType(file, allowedTypes) {
  return allowedTypes.includes(file.type);
}

/**
 * 验证文件大小
 * @param {File} file - 文件对象
 * @param {number} maxSize - 最大大小（字节）
 * @returns {boolean} 是否有效
 */
export function validateFileSize(file, maxSize) {
  return file.size <= maxSize;
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的字符串 (如 "1.5 MB")
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

/**
 * 延迟函数
 * @param {number} ms - 延迟时间（毫秒）
 * @returns {Promise} Promise 对象
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 安全的 JSON 解析
 * @param {string} str - JSON 字符串
 * @param {any} defaultValue - 默认值
 * @returns {any} 解析结果或默认值
 */
export function safeJsonParse(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch (error) {
    console.warn('JSON 解析失败:', error);
    return defaultValue;
  }
}

/**
 * 安全的 JSON 字符串化
 * @param {any} obj - 对象
 * @param {string} defaultValue - 默认值
 * @returns {string} JSON 字符串或默认值
 */
export function safeJsonStringify(obj, defaultValue = '{}') {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.warn('JSON 字符串化失败:', error);
    return defaultValue;
  }
}

/**
 * 截断文本
 * @param {string} text - 文本
 * @param {number} maxLength - 最大长度
 * @param {string} suffix - 后缀
 * @returns {string} 截断后的文本
 */
export function truncateText(text, maxLength = 100, suffix = '...') {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + suffix;
}

/**
 * 获取当前 ISO 时间字符串
 * @returns {string} ISO 8601 格式时间
 */
export function getNowIso() {
  return new Date().toISOString();
}

/**
 * 计算时长（毫秒）
 * @param {string} startedAt - 开始时间 ISO 字符串
 * @returns {number} 时长（毫秒）
 */
export function getDurationMs(startedAt) {
  const start = new Date(startedAt).getTime();
  return Number.isNaN(start) ? 0 : Math.max(Date.now() - start, 0);
}

/**
 * 获取进度标签
 * @param {number} currentIndex - 当前索引
 * @param {number} total - 总数
 * @returns {string} 进度标签 (如 "1 / 100")
 */
export function getProgressLabel(currentIndex, total) {
  if (!total) {
    return '0 / 0';
  }
  return `${currentIndex + 1} / ${total}`;
}

/**
 * 数组去重
 * @param {Array} arr - 数组
 * @param {string} key - 对象数组的唯一键
 * @returns {Array} 去重后的数组
 */
export function uniqueArray(arr, key = null) {
  if (!Array.isArray(arr)) return [];

  if (key) {
    // 对象数组去重
    const seen = new Set();
    return arr.filter(item => {
      const val = item[key];
      if (seen.has(val)) {
        return false;
      }
      seen.add(val);
      return true;
    });
  } else {
    // 基本类型数组去重
    return [...new Set(arr)];
  }
}

/**
 * 判断是否为空值
 * @param {any} value - 值
 * @returns {boolean} 是否为空
 */
export function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}
