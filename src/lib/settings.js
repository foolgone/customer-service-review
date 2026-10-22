/**
 * 应用设置（AI 配置）
 * 目的：API Key 由用户在设置页运行时输入并保存在本机 localStorage，
 * 不再依赖构建期注入的 VITE_* 环境变量（避免 Key 被打进前端产物）。
 */

import { getConfig, saveConfig } from './storage';

export const AI_MODEL_OPTIONS = [
  { value: 'deepseek-chat', label: 'deepseek-chat（通用对话）' },
  { value: 'deepseek-reasoner', label: 'deepseek-reasoner（推理模型）' },
];

export const DEFAULT_SETTINGS = {
  apiKey: '',
  model: 'deepseek-chat',
  concurrency: 3,
};

const CONCURRENCY_MIN = 1;
const CONCURRENCY_MAX = 5;

/**
 * 归一化设置，过滤非法值
 * @param {Object} settings - 原始设置
 * @returns {Object} { apiKey, model, concurrency }
 */
export function normalizeSettings(settings = {}) {
  const modelValues = AI_MODEL_OPTIONS.map((item) => item.value);
  const rawConcurrency = Number(settings.concurrency);
  const concurrency = Number.isFinite(rawConcurrency)
    ? Math.min(Math.max(Math.round(rawConcurrency), CONCURRENCY_MIN), CONCURRENCY_MAX)
    : DEFAULT_SETTINGS.concurrency;

  return {
    apiKey: typeof settings.apiKey === 'string' ? settings.apiKey.trim() : '',
    model: modelValues.includes(settings.model) ? settings.model : DEFAULT_SETTINGS.model,
    concurrency,
  };
}

/**
 * 从本地配置读取设置（兼容旧的 aiModel 字段）
 * @returns {Object} { apiKey, model, concurrency }
 */
export function loadSettings() {
  const config = getConfig();

  return normalizeSettings({
    apiKey: config?.apiKey,
    // 旧版本默认写的是 'deepseek'，映射到具体模型
    model: config?.aiModel === 'deepseek' || !config?.aiModel ? DEFAULT_SETTINGS.model : config.aiModel,
    concurrency: config?.concurrency,
  });
}

/**
 * 保存设置到本地配置
 * @param {Object} settings - 设置
 * @returns {Object} 归一化后的设置
 */
export function saveSettings(settings = {}) {
  const next = normalizeSettings(settings);

  saveConfig({
    ...getConfig(),
    apiKey: next.apiKey,
    aiModel: next.model,
    concurrency: next.concurrency,
  });

  return next;
}
