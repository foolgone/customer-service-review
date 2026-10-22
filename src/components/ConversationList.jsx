/**
 * 左侧对话清单：搜索 + 状态点 + 标签速览，点击直接跳转该条
 */
import { useMemo, useState } from 'react';
import { LABELS } from '../lib/constants';
import { isHumanReviewed } from '../lib/analytics';

const LABEL_NAME_MAP = new Map(LABELS.map((item) => [item.value, item.label]));

function getConversationText(conversation, role) {
  return conversation?.turns?.find((turn) => turn.role === role)?.content || '';
}

// 列表只显示摘要，避免与对话区完整文案重复（也降低密度）
function previewOf(text) {
  const value = String(text || '').trim();
  if (!value) {
    return '（无用户消息）';
  }
  return value.length > 18 ? `${value.slice(0, 18)}…` : value;
}

function normalizeLabels(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string' && value) {
    return [value];
  }

  return [];
}

export default function ConversationList({ conversations = [], annotations = {}, currentIndex = 0, onSelect }) {
  const [keyword, setKeyword] = useState('');

  const items = useMemo(() => {
    const text = keyword.trim().toLowerCase();

    return conversations
      .map((conversation, index) => ({ conversation, index }))
      .filter(({ conversation }) => {
        if (!text) {
          return true;
        }

        return (
          String(conversation.id).toLowerCase().includes(text) ||
          getConversationText(conversation, 'user').toLowerCase().includes(text) ||
          getConversationText(conversation, 'assistant').toLowerCase().includes(text)
        );
      });
  }, [conversations, keyword]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white dark:bg-slate-900">
      <div className="border-b border-slate-200 p-2 dark:border-slate-800">
        <input
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索对话 ID / 内容"
          aria-label="搜索对话"
          className="soft-input py-1.5 text-xs"
        />
      </div>

      <ul className="min-h-0 flex-1 overflow-y-auto">
        {items.map(({ conversation, index }) => {
          const annotation = annotations[conversation.id] || {};
          const labels = normalizeLabels(annotation.labels);
          const reviewed = isHumanReviewed(annotation);
          const hasAi = normalizeLabels(annotation.aiLabels).length > 0;
          const active = index === currentIndex;

          return (
            <li key={conversation.id}>
              <button
                type="button"
                onClick={() => onSelect?.(index)}
                aria-current={active ? 'true' : undefined}
                aria-label={`#${conversation.id} ${reviewed ? '已审核' : '未审核'}${hasAi ? '（含 AI 建议）' : ''}`}
                className={[
                  'w-full border-l-2 px-3 py-2 text-left transition-colors',
                  active
                    ? 'border-blue-600 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10'
                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-medium text-slate-700 dark:text-slate-200">#{conversation.id}</span>
                  <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    <span
                      className={[
                        'inline-block h-1.5 w-1.5 rounded-full',
                        reviewed ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600',
                      ].join(' ')}
                      aria-hidden="true"
                    />
                    {reviewed ? '已审核' : '未审核'}
                    {hasAi ? ' · AI' : ''}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  用户：{previewOf(getConversationText(conversation, 'user'))}
                </p>
                {labels.length ? (
                  <div className="mt-1 flex items-center gap-1" aria-hidden="true">
                    {labels.slice(0, 4).map((label) => (
                      <span
                        key={label}
                        title={LABEL_NAME_MAP.get(label) || label}
                        className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500"
                      />
                    ))}
                    {labels.length > 4 ? (
                      <span className="text-[10px] text-slate-400">+{labels.length - 4}</span>
                    ) : null}
                  </div>
                ) : null}
              </button>
            </li>
          );
        })}
        {!items.length ? <li className="px-3 py-8 text-center text-xs text-slate-500">没有匹配的对话</li> : null}
      </ul>

      <div className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
        共 {conversations.length} 条 · 显示 {items.length} 条
      </div>
    </div>
  );
}
