/**
 * Dashboard 懒加载占位：高度对齐 Dashboard.jsx 的真实卡片
 * （实测：区块 80 / 指标行 117 / 主区左列 361+317+301、右列 375+407+199），
 * 让 chunk 加载前后的布局位移接近 0。aria-hidden 保证骨架不被读屏当作真实内容。
 */
export default function DashboardSkeleton() {
  return (
    <section
      aria-hidden="true"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-card dark:border-slate-800 dark:bg-slate-900 md:p-6"
    >
      <div className="h-20 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-[117px] animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="grid gap-4">
          <div className="h-[361px] animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-[317px] animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
            <div className="h-[317px] animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="h-[301px] animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
        <div className="grid gap-4">
          <div className="h-[375px] animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-[407px] animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="h-[199px] animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        </div>
      </div>
    </section>
  );
}
