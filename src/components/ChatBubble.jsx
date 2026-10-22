export default function ChatBubble({ turn, index, turnIndex }) {
  const isUser = turn.role === 'user';
  const sideClass = isUser ? 'justify-start' : 'justify-end';
  const bubbleClass = isUser
    ? 'bg-slate-100 text-slate-800 shadow-sm dark:bg-slate-800/80 dark:text-slate-100'
    : 'bg-gradient-to-r from-blue-500 to-sky-500 text-white shadow-lg shadow-blue-500/20';
  const avatarClass = isUser
    ? 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
    : 'border-blue-200 bg-blue-500 text-blue-950 dark:border-blue-900';

  return (
    <div className={`flex ${sideClass}`}>
      <div className="max-w-[88%]">
        <div
          className={`mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400 ${isUser ? 'justify-start' : 'justify-end'}`}
        >
          <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {isUser ? '用户' : '客服'}
          </span>
          <span>第 {turnIndex + 1} 轮</span>
          <span>消息 {index + 1}</span>
        </div>

        <div className={`flex items-end gap-3 ${isUser ? 'flex-row' : 'flex-row-reverse'}`}>
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${avatarClass}`}
          >
            {isUser ? 'U' : 'A'}
          </div>

          <div
            className={`relative rounded-lg px-4 py-3 text-[15px] leading-8 transition-transform duration-300 hover:-translate-y-0.5 ${bubbleClass}`}
          >
            <div
              className={`absolute top-4 h-3 w-3 rotate-45 ${isUser ? '-left-1 bg-slate-100 dark:bg-slate-800/80' : '-right-1 bg-blue-500'}`}
            />
            <p className="whitespace-pre-wrap">{turn.content || '暂无内容'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
