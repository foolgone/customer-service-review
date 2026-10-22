/**
 * src/lib/performance.js 单元测试
 * 该文件只保留真正被引用的图表动画配置；历史遗留的虚拟滚动/防抖/节流常量已删除，
 * 这里同时断言「已删除的配置不再导出」，防止后续又被无引用地加回来。
 */
import { describe, it, expect } from 'vitest';
import * as performanceConfig from '../../../src/lib/performance.js';

describe('CHART_ANIMATION_CONFIG', () => {
  it('图表动画关闭且时长为 0', () => {
    expect(performanceConfig.CHART_ANIMATION_CONFIG.isAnimationActive).toBe(false);
    expect(performanceConfig.CHART_ANIMATION_CONFIG.animationDuration).toBe(0);
  });
});

describe('已清理的历史配置', () => {
  it('不再导出未接入的虚拟滚动/防抖/节流/存储写入常量', () => {
    [
      'VIRTUAL_SCROLL_CONFIG',
      'DEBOUNCE_DELAYS',
      'THROTTLE_INTERVALS',
      'CHART_UPDATE_THROTTLE',
      'STORAGE_WRITE_DEBOUNCE'
    ].forEach((name) => {
      expect(performanceConfig[name]).toBeUndefined();
    });
  });
});
