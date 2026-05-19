import { DEEPSEEK_DEFAULT_MODEL, DEEPSEEK_ENDPOINT, LABELS } from './constants';

const ALLOWED_LABELS = new Set(LABELS.map((item) => item.value));

export function buildDeepSeekPrompt(userContent, assistantContent) {
  return `你是客服质检专家。

请判断下面客服回复质量。
请只给出人工审核的辅助建议，不要修改人工结论。

用户：
${userContent}

客服：
${assistantContent}

标签：
1 accurate
2 off_topic
3 hallucination
4 impolite
5 incomplete
6 risky

返回 JSON：
{
  "labels": [],
  "reason": ""
}`;
}

function extractJsonText(text) {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const jsonStartCandidates = ['{', '[']
    .map((token) => trimmed.indexOf(token))
    .filter((index) => index >= 0);

  if (!jsonStartCandidates.length) {
    return trimmed;
  }

  const jsonStart = Math.min(...jsonStartCandidates);
  const objectEnd = trimmed.lastIndexOf('}');
  const arrayEnd = trimmed.lastIndexOf(']');
  const jsonEnd = Math.max(objectEnd, arrayEnd);

  if (jsonEnd < jsonStart) {
    return trimmed;
  }

  return trimmed.slice(jsonStart, jsonEnd + 1);
}

export function parseDeepSeekResponse(content) {
  const jsonText = extractJsonText(content);
  const parsed = JSON.parse(jsonText);
  const labels = Array.isArray(parsed.labels)
    ? parsed.labels.filter((label) => typeof label === 'string' && ALLOWED_LABELS.has(label))
    : [];
  const reason = [parsed.reason, parsed.analysis, parsed.explanation, parsed.comment]
    .find((value) => typeof value === 'string' && value.trim()) || '';

  return {
    labels,
    reason
  };
}

export async function analyzeWithDeepSeek({ apiKey, userContent, assistantContent, model = DEEPSEEK_DEFAULT_MODEL }) {
  if (!apiKey) {
    throw new Error('请先配置 DeepSeek API Key');
  }

  const response = await fetch(DEEPSEEK_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: '你是客服质检专家。只输出 JSON，不要输出多余解释。'
        },
        {
          role: 'user',
          content: buildDeepSeekPrompt(userContent, assistantContent)
        }
      ]
    })
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
}
