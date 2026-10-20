/**
 * 性能优化配置
 * 用于提升应用滚动和交互性能
 */

// 1. 禁用不必要的 Recharts 动画（提升性能）
export const CHART_ANIMATION_CONFIG = {
  isAnimationActive: false, // 禁用动画，提升性能
  animationDuration: 0
};

// 2. 虚拟滚动配置（大列表优化）
export const VIRTUAL_SCROLL_CONFIG = {
  itemSize: 80,           // 每项高度
  overscanCount: 3        // 预渲染项数
};

// 3. 防抖延迟配置
export const DEBOUNCE_DELAYS = {
  input: 300,             // 输入框防抖
  resize: 150,            // 窗口 resize 防抖
  scroll: 100             // 滚动防抖
};

// 4. 节流间隔配置
export const THROTTLE_INTERVALS = {
  scroll: 100,            // 滚动节流
  mousemove: 50           // 鼠标移动节流
};

// 5. 图表更新节流
export const CHART_UPDATE_THROTTLE = 300;

// 6. LocalStorage 写入防抖
export const STORAGE_WRITE_DEBOUNCE = 500;
