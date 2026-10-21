/**
 * PDF 导出器
 * 做法：html2canvas 把报告 DOM 截成图片，再用 jsPDF 按 A4 切页输出。
 * 这样中文不需要额外字体文件（由浏览器渲染成位图）。
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { A4, computePdfPages, getSliceHeightMm } from './pdf-layout';

/**
 * 生成 PDF 文件名
 * @param {Date} [date] - 日期
 * @returns {string} 文件名
 */
export function getPdfFileName(date = new Date()) {
  return `质检报告-${date.toISOString().slice(0, 10)}.pdf`;
}

/**
 * 截图报告 DOM
 * @param {HTMLElement} element - 报告根节点
 * @param {Object} [options] - html2canvas 选项
 * @returns {Promise<HTMLCanvasElement>} 画布
 */
export async function captureReportElement(element, options = {}) {
  if (!element) {
    throw new Error('没有可导出的报告内容');
  }

  return html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    ...options
  });
}

/**
 * 把画布切成多页并构建 PDF 文档（不触发下载，便于测试/复用）
 * @param {HTMLCanvasElement} canvas - 报告截图
 * @param {Object} [options]
 * @param {number} [options.marginMm] - 页边距（mm）
 * @returns {Object} jsPDF 实例
 */
export function buildPdfDocument(canvas, { marginMm = 10 } = {}) {
  const { pages, contentWidthMm } = computePdfPages(canvas.width, canvas.height, { marginMm });
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  pages.forEach((slice, index) => {
    if (index > 0) {
      doc.addPage();
    }

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;
    pageCanvas.height = slice.height;

    const context = pageCanvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    context.drawImage(canvas, 0, slice.y, canvas.width, slice.height, 0, 0, canvas.width, slice.height);

    // 用 JPEG 压缩位图，避免单页 PDF 体积过大（2 倍截图的 PNG 单页约 6MB）
    const imageData = pageCanvas.toDataURL('image/jpeg', 0.92);

    doc.addImage(
      imageData,
      'JPEG',
      marginMm,
      marginMm,
      contentWidthMm,
      getSliceHeightMm(slice.height, canvas.width, contentWidthMm)
    );
  });

  return doc;
}

/**
 * 把画布切成多页并生成 PDF（触发下载）
 * @param {HTMLCanvasElement} canvas - 报告截图
 * @param {Object} [options]
 * @param {string} [options.fileName] - 文件名
 * @param {number} [options.marginMm] - 页边距（mm）
 * @returns {Object} jsPDF 实例
 */
export function createPdfFromCanvas(canvas, { fileName = getPdfFileName(), marginMm = 10 } = {}) {
  const doc = buildPdfDocument(canvas, { marginMm });
  doc.save(fileName);
  return doc;
}

/**
 * 导出报告为 PDF（截图 + 分页 + 下载）
 * @param {HTMLElement} element - 报告根节点
 * @param {Object} [options] - 透传给 createPdfFromCanvas
 * @returns {Promise<Object>} jsPDF 实例
 */
export async function exportReportToPdf(element, options = {}) {
  const canvas = await captureReportElement(element, options.canvas);
  return createPdfFromCanvas(canvas, options);
}

export { A4 };
