import ChatBubble from './ChatBubble';

export default function ConversationPanel({ conversation, currentIndex, totalCount }) {
  const turns = Array.isArray(conversation?.turns) ? conversation.turns : [];

  return (
    <section className="rounded-[32px] border border-white/60 bg-white/75 p-5 shadow-glow backdrop-blur-xl dark:border-slate-800/70 dark:bg-slate-900/75 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-600 dark:text-cyan-300">Conversation</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">聊天式对话审查</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">支持多轮对话、左右气泡和滚动浏览，更贴近真实客服系统。</p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">#{conversation?.id || '-'}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">第 {currentIndex + 1} 条</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">共 {totalCount} 条</span>
          <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{turns.length} 轮消息</span>
        </div>
      </div>

      <div className="mt-5 rounded-[28px] border border-slate-200/80 bg-gradient-to-b from-slate-50/90 to-white/90 p-4 dark:border-slate-800 dark:from-slate-950/70 dark:to-slate-900/70 md:p-5">
        <div className="max-h-[42rem] space-y-5 overflow-y-auto pr-2">
          {turns.length ? (
            turns.map((turn, index) => (
              <ChatBubble key={`${conversation?.id || 'turn'}-${index}`} turn={turn} index={index} turnIndex={Math.floor(index / 2)} />
            ))
          ) : (
            <div className="rounded-3xl bg-white/80 p-8 text-center text-sm text-slate-500 dark:bg-slate-950/60 dark:text-slate-400">
              暂无对话消息
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
