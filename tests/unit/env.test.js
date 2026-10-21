/**
 * 测试基础设施自检
 * 回归历史缺陷：vitest.config.js 开启 restoreMocks 后，setup.js 中 vi.fn 形式的
 * polyfill 会在每个用例前被 mockRestore 清空，导致 window.matchMedia() 返回 undefined。
 */
import { describe, expect, it, vi } from 'vitest';

describe('测试环境基础设施', () => {
  it('matchMedia 在两个连续用例中均返回有效的 MediaQueryList', () => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    expect(mql).toBeDefined();
    expect(mql.matches).toBe(false);
    expect(mql.media).toBe('(prefers-color-scheme: dark)');
    expect(() => mql.addEventListener('change', () => {})).not.toThrow();
  });

  it('matchMedia 不会因上一个用例执行 restoreMocks 而失效', () => {
    const first = window.matchMedia('(prefers-color-scheme: dark)');
    expect(first.matches).toBe(false);

    const spy = vi.fn();
    spy.mockImplementation(() => 'mock');
    spy.mockRestore();

    const second = window.matchMedia('(prefers-color-scheme: dark)');
    expect(second.matches).toBe(false);
    expect(second.addEventListener).toBeTypeOf('function');
  });

  it('URL.createObjectURL / revokeObjectURL 可用且可被 spy', () => {
    expect(URL.createObjectURL(new Blob(['x']))).toBe('blob:vitest-mock-url');
    expect(() => URL.revokeObjectURL('blob:vitest-mock-url')).not.toThrow();

    const spy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:captured');
    expect(URL.createObjectURL(new Blob(['y']))).toBe('blob:captured');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('Blob/File 的 text 与 arrayBuffer 读取可用', async () => {
    const blob = new Blob(['hello 世界'], { type: 'text/plain' });
    await expect(blob.text()).resolves.toBe('hello 世界');

    const file = new File([new Uint8Array([1, 2, 3])], 'a.bin', { type: 'application/octet-stream' });
    const buffer = await file.arrayBuffer();
    expect(buffer.byteLength).toBe(3);
  });

  it('localStorage 与 documentElement 在用例间被清理', () => {
    // 本用例写入的数据会在 afterEach 中清理，由下个用例断言
    localStorage.setItem('probe', '1');
    document.documentElement.classList.add('dark');
    expect(localStorage.getItem('probe')).toBe('1');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('上一个用例的 localStorage 与主题 class 已被清理', () => {
    expect(localStorage.getItem('probe')).toBeNull();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
