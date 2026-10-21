/**
 * PDF 分页布局计算（纯函数，便于单测）
 * 把一张从 DOM 截取的长图按 A4 页面高度切分成多页。
 */

export const A4 = {
  widthMm: 210,
  heightMm: 297
};

/**
 * 计算分页切片
 * @param {number} canvasWidthPx - 截图宽度（px）
 * @param {number} canvasHeightPx - 截图高度（px）
 * @param {Object} [options]
 * @param {number} [options.pageWidthMm] - 纸张宽（mm）
 * @param {number} [options.pageHeightMm] - 纸张高（mm）
 * @param {number} [options.marginMm] - 四边留白（mm）
 * @returns {Object} { pages: [{ y, height }], contentWidthMm, contentHeightMm, pxPerMm, pageHeightPx }
 */
export function computePdfPages(
  canvasWidthPx,
  canvasHeightPx,
  { pageWidthMm = A4.widthMm, pageHeightMm = A4.heightMm, marginMm = 10 } = {}
) {
  if (!(canvasWidthPx > 0) || !(canvasHeightPx > 0)) {
    throw new Error('截图尺寸无效，无法生成 PDF');
  }

  if (!(pageWidthMm > marginMm * 2) || !(pageHeightMm > marginMm * 2)) {
    throw new Error('页面尺寸或留白无效，无法生成 PDF');
  }

  const contentWidthMm = pageWidthMm - marginMm * 2;
  const contentHeightMm = pageHeightMm - marginMm * 2;
  const pxPerMm = canvasWidthPx / contentWidthMm;
  const pageHeightPx = Math.max(1, Math.floor(contentHeightMm * pxPerMm));

  const pages = [];
  for (let y = 0; y < canvasHeightPx; y += pageHeightPx) {
    pages.push({ y, height: Math.min(pageHeightPx, canvasHeightPx - y) });
  }

  return { pages, contentWidthMm, contentHeightMm, pxPerMm, pageHeightPx };
}

/**
 * 单页内图片的实际高度（mm）
 * @param {number} sliceHeightPx - 切片高度（px）
 * @param {number} canvasWidthPx - 原图宽度（px）
 * @param {number} contentWidthMm - 可用内容宽度（mm）
 * @returns {number} 高度（mm）
 */
export function getSliceHeightMm(sliceHeightPx, canvasWidthPx, contentWidthMm) {
  return (sliceHeightPx / canvasWidthPx) * contentWidthMm;
}
