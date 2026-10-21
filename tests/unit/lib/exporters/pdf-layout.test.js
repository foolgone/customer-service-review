/**
 * src/lib/exporters/pdf-layout.js 单元测试
 * 覆盖：单页/多页切分、内容宽度与页高换算、自定义留白、非法入参
 */
import { describe, it, expect } from 'vitest';
import { computePdfPages, getSliceHeightMm, A4 } from '../../../../src/lib/exporters/pdf-layout.js';

describe('computePdfPages', () => {
  it('短图 → 单页，内容宽度按 A4 减去留白', () => {
    const result = computePdfPages(780, 800);

    expect(result.pages).toEqual([{ y: 0, height: 800 }]);
    expect(result.contentWidthMm).toBe(190);
    expect(result.contentHeightMm).toBe(277);
    expect(result.pxPerMm).toBeCloseTo(780 / 190, 5);
  });

  it('长图 → 按页高切分，页高之和等于原图高且每页不超页高', () => {
    const { pages, pageHeightPx } = computePdfPages(780, 3000);

    expect(pageHeightPx).toBe(Math.floor(277 * (780 / 190)));
    expect(pages.length).toBe(Math.ceil(3000 / pageHeightPx));
    expect(pages[0].y).toBe(0);
    expect(pages.reduce((sum, page) => sum + page.height, 0)).toBe(3000);
    pages.forEach((page) => expect(page.height).toBeLessThanOrEqual(pageHeightPx));
  });

  it('自定义留白为 0 → 内容尺寸等于纸张尺寸', () => {
    const { contentWidthMm, contentHeightMm } = computePdfPages(780, 100, { marginMm: 0 });

    expect(contentWidthMm).toBe(A4.widthMm);
    expect(contentHeightMm).toBe(A4.heightMm);
  });

  it('自定义纸张尺寸生效', () => {
    const { contentWidthMm, contentHeightMm } = computePdfPages(100, 100, {
      pageWidthMm: 200,
      pageHeightMm: 200,
      marginMm: 20
    });

    expect(contentWidthMm).toBe(160);
    expect(contentHeightMm).toBe(160);
  });

  it('非法尺寸或留白 → 抛错', () => {
    expect(() => computePdfPages(0, 100)).toThrow('截图尺寸无效');
    expect(() => computePdfPages(100, 0)).toThrow('截图尺寸无效');
    expect(() => computePdfPages(100, 100, { marginMm: 150 })).toThrow('留白无效');
  });
});

describe('getSliceHeightMm', () => {
  it('按宽度比例把像素高度换算成毫米', () => {
    expect(getSliceHeightMm(100, 780, 190)).toBeCloseTo(24.36, 2);
  });
});
