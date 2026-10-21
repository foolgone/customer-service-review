/**
 * 数据验证模块
 */

/**
 * 验证对话对象
 * @param {Object} conversation - 对话对象
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateConversation(conversation) {
  const errors = [];

  // 必须是对象
  if (!conversation || typeof conversation !== 'object') {
    errors.push('对话数据必须是对象');
    return { valid: false, errors };
  }

  // 必须有 ID
  if (!conversation.id) {
    errors.push('缺少对话 ID');
  } else if (typeof conversation.id !== 'string') {
    errors.push('对话 ID 必须是字符串');
  }

  // 必须有 turns
  if (!conversation.turns) {
    errors.push('缺少对话内容（turns）');
  } else if (!Array.isArray(conversation.turns)) {
    errors.push('对话内容（turns）必须是数组');
  } else if (conversation.turns.length === 0) {
    errors.push('对话内容不能为空');
  } else {
    // 验证每个 turn
    conversation.turns.forEach((turn, index) => {
      const turnErrors = validateTurn(turn, index);
      errors.push(...turnErrors);
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 验证对话轮次
 * @param {Object} turn - 对话轮次
 * @param {number} index - 索引
 * @returns {string[]} 错误信息数组
 */
function validateTurn(turn, index) {
  const errors = [];
  const prefix = `第 ${index + 1} 轮对话`;

  if (!turn || typeof turn !== 'object') {
    errors.push(`${prefix}：数据必须是对象`);
    return errors;
  }

  // 验证 role
  if (!turn.role) {
    errors.push(`${prefix}：缺少角色（role）`);
  } else if (!['user', 'assistant'].includes(turn.role)) {
    errors.push(`${prefix}：角色必须是 'user' 或 'assistant'`);
  }

  // 验证 content
  if (turn.content === undefined || turn.content === null) {
    errors.push(`${prefix}：缺少内容（content）`);
  } else if (typeof turn.content !== 'string') {
    errors.push(`${prefix}：内容必须是字符串`);
  } else if (turn.content.trim().length === 0) {
    errors.push(`${prefix}：内容不能为空`);
  }

  return errors;
}

/**
 * 获取「行无法转换为对话」的具体原因，用于把被跳过的行反馈给用户
 * @param {Object} row - 原始行对象
 * @param {Object} fieldMapping - 字段映射
 * @returns {string} 缺失描述
 */
export function getMissingFieldReason(row, fieldMapping) {
  const fieldLabels = { id: '对话 ID', user: '用户消息', assistant: '客服回复' };
  const missing = [];
  let unreadable = false;

  ['id', 'user', 'assistant'].forEach((field) => {
    const column = fieldMapping?.[field];

    try {
      const value = column ? String(row?.[column] ?? '').trim() : '';
      if (!value) {
        missing.push(field);
      }
    } catch {
      unreadable = true;
    }
  });

  if (unreadable) {
    return '单元格数据无法读取';
  }

  if (!missing.length) {
    return '无法解析为对话数据';
  }

  return `缺少必填字段：${missing.map((field) => fieldLabels[field]).join('、')}`;
}

/**
 * 验证文件
 * 说明：文件类型默认以【扩展名】为权威判断——浏览器/操作系统给出的 MIME 并不可靠
 * （例如 Windows 上 .csv 常被报成 application/vnd.ms-excel）。
 * - 未传 allowedTypes（默认）：MIME 不一致只告警，不阻断；
 * - 显式传入 allowedTypes：按该白名单严格拦截，保证参数语义有效。
 * @param {File} file - 文件对象
 * @param {Object} options - 验证选项
 * @returns {Object} { valid: boolean, error: string|null }
 */
const DEFAULT_ALLOWED_TYPES = [
  'application/json',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
];

export function validateFile(file, options = {}) {
  if (!file || typeof file !== 'object') {
    return {
      valid: false,
      error: '未选择文件'
    };
  }

  const {
    allowedTypes = null,
    allowedExtensions = ['json', 'csv', 'xlsx', 'xls', 'txt'],
    maxSize = 10 * 1024 * 1024 // 10MB
  } = options;

  // 验证文件名
  if (!file.name || file.name.trim().length === 0) {
    return {
      valid: false,
      error: '文件名不能为空'
    };
  }

  // 验证文件扩展名（扩展名是唯一权威判断：Windows 上 .csv 的 MIME 常被报成 application/vnd.ms-excel）
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `不支持的文件扩展名：.${ext || '(无)'}。支持：${allowedExtensions.join(', ')}`
    };
  }

  // 验证文件大小
  if (file.size > maxSize) {
    const maxMB = (maxSize / 1024 / 1024).toFixed(2);
    const fileMB = (file.size / 1024 / 1024).toFixed(2);
    return {
      valid: false,
      error: `文件过大：${fileMB} MB。最大支持：${maxMB} MB`
    };
  }

  // MIME：显式传入 allowedTypes 时严格按白名单拦截（BUG-04）；未传时以扩展名为准，仅告警
  if (file.type) {
    if (allowedTypes) {
      if (!allowedTypes.includes(file.type)) {
        return {
          valid: false,
          error: `不支持的文件类型：${file.type}。支持：${allowedTypes.join(', ')}`
        };
      }
    } else if (!DEFAULT_ALLOWED_TYPES.includes(file.type)) {
      console.warn(`文件 MIME 与扩展名不一致（${file.type} / .${ext}），按扩展名处理`);
    }
  }

  return { valid: true, error: null };
}

/**
 * 验证字段映射
 * @param {Object} mapping - 字段映射对象
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateFieldMapping(mapping) {
  if (!mapping || typeof mapping !== 'object') {
    return {
      valid: false,
      errors: ['字段映射不能为空']
    };
  }

  const errors = [];
  const requiredFields = ['id', 'user', 'assistant'];

  requiredFields.forEach(field => {
    if (!mapping[field]) {
      errors.push(`缺少必填字段映射：${field}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 标准化对话对象（自动修复常见问题）
 * @param {Object} conversation - 原始对话对象
 * @returns {Object} 标准化后的对话对象
 */
export function normalizeConversation(conversation) {
  // 确保有 ID
  if (!conversation.id) {
    conversation.id = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // 确保 ID 是字符串
  if (typeof conversation.id !== 'string') {
    conversation.id = String(conversation.id);
  }

  // 确保有 turns
  if (!conversation.turns) {
    conversation.turns = [];
  }

  // 确保 turns 是数组
  if (!Array.isArray(conversation.turns)) {
    conversation.turns = [];
  }

  // 标准化每个 turn
  conversation.turns = conversation.turns
    .filter(turn => turn && typeof turn === 'object')
    .map(turn => ({
      role: turn.role || 'user',
      content: (turn.content || '').toString().trim(),
      timestamp: turn.timestamp || null
    }))
    .filter(turn => turn.content.length > 0); // 过滤空内容

  // 确保至少有一轮对话
  if (conversation.turns.length === 0) {
    return null; // 返回 null 表示无效对话
  }

  // 保留元数据（如果有）
  if (conversation.metadata) {
    conversation.metadata = { ...conversation.metadata };
  }

  return conversation;
}

/**
 * 批量验证对话
 * @param {Array} conversations - 对话数组
 * @returns {Object} { valid: Conversation[], invalid: { index, conversation, errors }[] }
 */
export function validateConversations(conversations) {
  const valid = [];
  const invalid = [];

  if (!Array.isArray(conversations)) {
    return { valid: [], invalid: [{ index: -1, conversation: null, errors: ['数据必须是数组'] }] };
  }

  conversations.forEach((conversation, index) => {
    const result = validateConversation(conversation);

    if (result.valid) {
      const normalized = normalizeConversation(conversation);
      if (normalized) {
        valid.push(normalized);
      } else {
        invalid.push({
          index,
          conversation,
          errors: ['标准化后对话无效（可能是内容为空）']
        });
      }
    } else {
      invalid.push({
        index,
        conversation,
        errors: result.errors
      });
    }
  });

  return { valid, invalid };
}

/**
 * 检查重复对话（基于 ID）
 * @param {Array} conversations - 对话数组
 * @returns {Object} { unique: Conversation[], duplicates: { id, count }[] }
 */
export function checkDuplicates(conversations) {
  const idMap = new Map();
  const unique = [];
  const duplicates = [];

  conversations.forEach(conv => {
    const id = conv.id;

    if (idMap.has(id)) {
      idMap.set(id, idMap.get(id) + 1);
    } else {
      idMap.set(id, 1);
      unique.push(conv);
    }
  });

  // 找出重复的 ID
  idMap.forEach((count, id) => {
    if (count > 1) {
      duplicates.push({ id, count });
    }
  });

  return { unique, duplicates };
}

/**
 * 验证 AI 分析结果
 * @param {Object} result - AI 返回的结果
 * @returns {Object} { valid: boolean, error: string|null }
 */
export function validateAIResult(result) {
  if (!result || typeof result !== 'object') {
    return { valid: false, error: 'AI 返回数据格式错误：不是对象' };
  }

  // 验证 labels
  if (!result.labels) {
    return { valid: false, error: 'AI 返回数据缺少 labels 字段' };
  }

  if (!Array.isArray(result.labels)) {
    return { valid: false, error: 'AI 返回的 labels 必须是数组' };
  }

  // 验证 labels 的值
  const validLabels = ['accurate', 'off_topic', 'hallucination', 'impolite', 'incomplete', 'risky'];
  for (const label of result.labels) {
    if (!validLabels.includes(label)) {
      return { valid: false, error: `AI 返回了未知标签：${label}` };
    }
  }

  // 验证 confidence
  if (result.confidence !== undefined) {
    if (typeof result.confidence !== 'number' || result.confidence < 0 || result.confidence > 100) {
      return { valid: false, error: 'AI 置信度必须是 0-100 之间的数字' };
    }
  }

  // 验证 severity
  if (result.severity !== undefined) {
    if (!['low', 'medium', 'high'].includes(result.severity)) {
      return { valid: false, error: 'AI 严重程度必须是 low/medium/high' };
    }
  }

  return { valid: true, error: null };
}

/**
 * 标准化 AI 结果
 * @param {Object} result - 原始 AI 结果
 * @returns {Object} 标准化后的结果
 */
export function normalizeAIResult(result) {
  return {
    labels: result.labels || [],
    reason: result.reason || '',
    confidence: result.confidence || 0,
    severity: result.severity || 'low',
    suggestions: result.suggestions || [],
    positiveAspects: result.positive_aspects || result.positiveAspects || []
  };
}
