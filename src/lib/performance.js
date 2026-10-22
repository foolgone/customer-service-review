/**
 * 性能相关配置
 *
 * 只保留真正被引用的配置：图表动画开关（Dashboard.jsx 使用）。
 * 历史遗留的虚拟滚动 / 防抖 / 节流 / 存储写入配置已删除 ——
 * 项目没有接入虚拟滚动与这些防抖策略，常量留着只会让人误以为已生效。
 */
export const CHART_ANIMATION_CONFIG = {
  isAnimationActive: false,
  animationDuration: 0,
};
