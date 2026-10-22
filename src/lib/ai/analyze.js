/**
 * 单条对话分析（统一入口）
 *
 * 与批量分析共用 lib/ai/providers 的 Provider 抽象：
 * 之前单条走 lib/deepseek.js 自带的 fetch 实现、批量走 Provider，两条路径并存，
 * 改模型参数 / 端点 / 鉴权时容易只改一处，现统一到这里。
 */
import { createProvider } from './providers';

export async function analyzeConversation({
  apiKey,
  model,
  providerId = 'deepseek',
  userContent = '',
  assistantContent = '',
  endpoint,
  fetchImpl,
} = {}) {
  const provider = createProvider(providerId, { apiKey, model, endpoint, fetchImpl });
  return provider.analyze({ userContent, assistantContent });
}
