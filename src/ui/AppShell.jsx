/**
 * 应用外壳：左侧导航 + 顶栏 + 内容区
 * 企业级布局约定：导航 208px（lg 以下收起）、顶栏 56px、内容区独立滚动。
 */
import { NavLink } from 'react-router-dom';
import { AnalyticsIcon, KeyboardIcon, WorkbenchIcon } from './icons';

const NAV_ITEMS = [
  { to: '/workbench', label: '质检工作台', icon: WorkbenchIcon },
  { to: '/analytics', label: '分析看板', icon: AnalyticsIcon },
];

function navClass({ isActive }) {
  return [
    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
    isActive
      ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-300'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
  ].join(' ');
}

export default function AppShell({
  children,
  productName = 'AI 质检分析平台',
  dataSourceLabel = '',
  imported = false,
  onRestoreSample,
  saveState = '',
  onOpenShortcuts,
}) {
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <aside className="hidden w-52 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-600 text-[11px] font-semibold text-white">
            AI
          </span>
          <span className="truncate text-sm font-semibold">{productName}</span>
        </div>

        <nav className="flex-1 space-y-1 p-2" aria-label="主导航">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={navClass}>
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          ))}
          <button type="button" onClick={onOpenShortcuts} className={`${navClass({ isActive: false })} w-full`}>
            <KeyboardIcon className="h-4 w-4 shrink-0" />
            快捷键
          </button>
        </nav>

        <div className="border-t border-slate-200 p-3 text-[11px] leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <p>v1.0.0 · Phase 1</p>
          <p>数据仅保存在本机浏览器</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-sm font-semibold lg:hidden">AI 质检</span>
            <nav className="flex items-center gap-1 lg:hidden" aria-label="移动端导航">
              {NAV_ITEMS.map(({ to, label }) => (
                <NavLink key={to} to={to} className={navClass}>
                  {label}
                </NavLink>
              ))}
            </nav>
            <span
              className="hidden max-w-[22rem] truncate rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 sm:inline dark:bg-slate-800 dark:text-slate-300"
              title={dataSourceLabel}
            >
              {dataSourceLabel}
            </span>
            {imported ? (
              <>
                <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs text-blue-700 dark:text-blue-300">
                  已导入 · 刷新需重新导入
                </span>
                <button type="button" onClick={onRestoreSample} className="ghost-button">
                  恢复示例数据
                </button>
              </>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <button type="button" onClick={onOpenShortcuts} className="ghost-button lg:hidden" aria-label="查看快捷键">
              ?
            </button>
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              title="质检员 · 智能客服审核组"
            >
              质
            </span>
          </div>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
