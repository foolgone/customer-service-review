/**
 * src/lib/performance.js 单元测试
 * 覆盖：图表动画关闭、虚拟滚动、防抖/节流延迟、图表更新节流、存储写入防抖等性能配置
 */
import { describe, it, expect } from 'vitest';
import {
  CHART_ANIMATION_CONFIG,
  VIRTUAL_SCROLL_CONFIG,
  DEBOUNCE_DELAYS,
  THROTTLE_INTERVALS,
  CHART_UPDATE_THROTTLE,
  STORAGE_WRITE_DEBOUNCE
} from '../../../src/lib/performance.js';

describe('CHART_ANIMATION_CONFIG', () => {
  it('图表动画关闭且时长为 0', () => {
    expect(CHART_ANIMATION_CONFIG.isAnimationActive).toBe(false);
    expect(CHART_ANIMATION_CONFIG.animationDuration).toBe(0);
  });
});

describe('VIRTUAL_SCROLL_CONFIG', () => {
  it('虚拟滚动配置包含每项高度与预渲染项数，且为合理正数', () => {
    expect(VIRTUAL_SCROLL_CONFIG.itemSize).toBe(80);
    expect(VIRTUAL_SCROLL_CONFIG.overscanCount).toBe(3);
    expect(VIRTUAL_SCROLL_CONFIG.itemSize).toBeGreaterThan(0);
    expect(VIRTUAL_SCROLL_CONFIG.overscanCount).toBeGreaterThanOrEqual(0);
  });
});

describe('DEBOUNCE_DELAYS', () => {
  it('输入框/窗口 resize/滚动防抖延迟为预期数值', () => {
    expect(DEBOUNCE_DELAYS.input).toBe(300);
    expect(DEBOUNCE_DELAYS.resize).toBe(150);
    expect(DEBOUNCE_DELAYS.scroll).toBe(100);
  });

  it('所有防抖延迟均为正数', () => {
    Object.values(DEBOUNCE_DELAYS).forEach((delay) => {
      expect(delay).toBeGreaterThan(0);
    });
  });
});

describe('THROTTLE_INTERVALS', () => {
  it('滚动/鼠标移动节流间隔为预期数值', () => {
    expect(THROTTLE_INTERVALS.scroll).toBe(100);
    expect(THROTTLE_INTERVALS.mousemove).toBe(50);
  });

  it('鼠标移动节流间隔小于滚动节流间隔', () => {
    expect(THROTTLE_INTERVALS.mousemove).toBeLessThan(THROTTLE_INTERVALS.scroll);
  });
});

describe('CHART_UPDATE_THROTTLE / STORAGE_WRITE_DEBOUNCE', () => {
  it('图表更新节流为 300ms', () => {
    expect(CHART_UPDATE_THROTTLE).toBe(300);
  });

  it('LocalStorage 写入防抖为 500ms', () => {
    expect(STORAGE_WRITE_DEBOUNCE).toBe(500);
  });

  it('两者均为正数毫秒值', () => {
    expect(CHART_UPDATE_THROTTLE).toBeGreaterThan(0);
    expect(STORAGE_WRITE_DEBOUNCE).toBeGreaterThan(0);
  });
});
