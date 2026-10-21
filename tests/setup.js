/**
 * Vitest 全局测试环境初始化
 * - 注册 jest-dom 断言
 * - 每个用例后自动清理 React 组件树 / localStorage / 主题 class
 * - 补齐 jsdom 缺失的浏览器 API（matchMedia / ResizeObserver / Blob 读取 / createObjectURL 等）
 *
 * ⚠️ 注意：polyfill 必须使用「普通函数」，不要用 vi.fn()。
 *    vitest.config.js 开启了 restoreMocks: true，会在每个用例前恢复 mock 实现，
 *    用 vi.fn 写的 polyfill 会被清空成返回 undefined 的空函数。
 *    个别用例需要断言调用时，在自己的用例里 vi.spyOn 即可。
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.className = '';
});

// -------------------- 定向过滤 recharts 的 jsdom 布局告警 --------------------
// ResponsiveContainer 依赖真实布局（clientWidth/Height），jsdom 中恒为 0，会产生
// 「The width(0) and height(0) of chart should be greater than 0」重复告警。
// 图表内部渲染不在自动化测试范围内（见 docx/测试计划.md 风险章节），此处仅过滤该条噪声，
// 其他 console.warn 原样保留。
const originalConsoleWarn = console.warn.bind(console);
console.warn = (...args) => {
  const first = args[0];
  if (typeof first === 'string' && first.includes('of chart should be greater than 0')) {
    return;
  }
  originalConsoleWarn(...args);
};

// -------------------- matchMedia（jsdom 25 未实现）--------------------
// 始终覆盖为可控实现：默认 matches=false；用例可临时改写 window.matchMedia 模拟深色偏好。
function createMediaQueryList(query, matches = false) {
  return {
    matches,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    }
  };
}

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: function matchMedia(query) {
    return createMediaQueryList(query, false);
  }
});

// -------------------- ResizeObserver / IntersectionObserver --------------------
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class IntersectionObserver {
    constructor() {
      this.root = null;
      this.rootMargin = '';
      this.thresholds = [];
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

// -------------------- Blob / File 读取 API（jsdom 25 未实现）--------------------
function readBlob(blob, readMethod) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('读取 Blob 失败'));
    if (readMethod === 'text') {
      reader.readAsText(blob);
    } else {
      reader.readAsArrayBuffer(blob);
    }
  });
}

if (typeof Blob !== 'undefined' && !Blob.prototype.text) {
  Blob.prototype.text = function text() {
    return readBlob(this, 'text');
  };
}

if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function arrayBuffer() {
    return readBlob(this, 'arraybuffer');
  };
}

// -------------------- Blob URL（jsdom 未实现；用例可用 vi.spyOn 断言）--------------------
Object.defineProperty(URL, 'createObjectURL', {
  configurable: true,
  writable: true,
  value: function createObjectURL() {
    return 'blob:vitest-mock-url';
  }
});

Object.defineProperty(URL, 'revokeObjectURL', {
  configurable: true,
  writable: true,
  value: function revokeObjectURL() {}
});

// -------------------- 其他 jsdom 未实现的 API --------------------
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function scrollTo() {};
}
if (!window.scrollTo) {
  window.scrollTo = function scrollTo() {};
}
