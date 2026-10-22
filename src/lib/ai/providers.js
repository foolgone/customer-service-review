/**
 * AI 服务商抽象层
 * 目前只实现 DeepSeek；新增服务商时实现同样的 { id, label, model, analyze } 契约即可。
 */

import { DEEPSEEK_DEFAULT_MODEL, DEEPSEEK_ENDPOINT } from '../constants';
import { buildDeepSeekPrompt, parseDeepSeekResponse } from '../deepseek';

const JSON_ONLY_SYSTEM_PROMPT = '你是客服质检专家。只输出 JSON，不要输出多余解释。';

/**
 * 创建 DeepSeek 分析器
 * @param {Object} options
 * @param {string} options.apiKey - DeepSeek API Key（必填）
 * @param {string} [options.model] - 模型名
 * @param {string} [options.endpoint] - 接口地址
 * @param {Function} [options.fetchImpl] - 便于测试注入的 fetch
 * @returns {Object} Provider { id, label, model, analyze }
 */
export function createDeepSeekProvider({
  apiKey,
  model = DEEPSEEK_DEFAULT_MODEL,
  endpoint = DEEPSEEK_ENDPOINT,
  fetchImpl = (...args) => fetch(...args),
} = {}) {
  if (!apiKey) {
    throw new Error('请先配置 DeepSeek API Key');
  }

  return {
    id: 'deepseek',
    label: 'DeepSeek',
    model,

    /**
     * 分析单条对话
     * @param {Object} input
     * @param {string} input.userContent - 用户消息
     * @param {string} input.assistantContent - 客服回复
     * @returns {Promise<Object>} { labels: string[], reason: string }
     */
    async analyze({ userContent = '', assistantContent = '' } = {}) {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: 'system', content: JSON_ONLY_SYSTEM_PROMPT },
            { role: 'user', content: buildDeepSeekPrompt(userContent, assistantContent) },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek 请求失败：${response.status} ${errorText}`);
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('DeepSeek 返回内容为空');
      }

      return parseDeepSeekResponse(content);
    },
  };
}

/** 已注册的 AI 服务商 */
export const AI_PROVIDERS = {
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultModel: DEEPSEEK_DEFAULT_MODEL,
    create: createDeepSeekProvider,
  },
};

/**
 * 列出可用服务商（不含 create 函数，便于 UI 渲染）
 * @returns {Array} [{ id, label, defaultModel }]
 */
export function listProviders() {
  return Object.values(AI_PROVIDERS).map(({ id, label, defaultModel }) => ({ id, label, defaultModel }));
}

/**
 * 按 id 创建 Provider 实例
 * @param {string} [providerId] - 服务商 id
 * @param {Object} [options] - 透传给 provider 的配置
 * @returns {Object} Provider 实例
 */
export function createProvider(providerId = 'deepseek', options = {}) {
  const definition = AI_PROVIDERS[providerId];

  if (!definition) {
    throw new Error(`不支持的 AI 服务商：${providerId}`);
  }

  return definition.create(options);
}
