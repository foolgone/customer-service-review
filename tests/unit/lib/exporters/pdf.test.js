/**
 * src/lib/exporters/pdf.js 单元测试
 * html2canvas 与 jsPDF 均为浏览器重依赖，测试中 mock 掉，只验证编排逻辑：
 * 截图参数、画布切页、JPEG 压缩、页边距、保存文件名、错误分支。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { html2canvasMock, jsPDFCtorMock, lastDocRef } = vi.hoisted(() => ({
  html2canvasMock: vi.fn(),
  jsPDFCtorMock: vi.fn(),
  lastDocRef: { current: null }
}));

vi.mock('html2canvas', () => ({
  default: (...args) => html2canvasMock(...args)
}));

vi.mock('jspdf', () => ({
  jsPDF: class FakeJsPDF {
    constructor(...args) {
      jsPDFCtorMock(...args);
      this.addPage = vi.fn();
      this.addImage = vi.fn();
      this.save = vi.fn();
      lastDocRef.current = this;
    }
  }
}));

import {
  A4,
  buildPdfDocument,
  captureReportElement,
  createPdfFromCanvas,
  exportReportToPdf,
  getPdfFileName
} from '../../../../src/lib/exporters/pdf.js';

const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

let createdContexts = [];

function createFakeCanvas(width = 780, height = 1200) {
  return { width, height };
}

beforeEach(() => {
  html2canvasMock.mockReset();
  jsPDFCtorMock.mockReset();
  lastDocRef.current = null;
  createdContexts = [];

  HTMLCanvasElement.prototype.getContext = vi.fn(() => {
    const context = { fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
    createdContexts.push(context);
    return context;
  });
  HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/jpeg;base64,FAKE');
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
});

describe('getPdfFileName', () => {
  it('生成 质检报告-YYYY-MM-DD.pdf', () => {
    expect(getPdfFileName(new Date('2026-10-21T10:00:00.000Z'))).toBe('质检报告-2026-10-21.pdf');
  });
});

describe('captureReportElement', () => {
  it('element 为空 → 抛出可读错误', async () => {
    await expect(captureReportElement(null)).rejects.toThrow('没有可导出的报告内容');
    await expect(captureReportElement()).rejects.toThrow('没有可导出的报告内容');
    expect(html2canvasMock).not.toHaveBeenCalled();
  });

  it('传入默认截图参数（scale=2 / 白底 / useCORS / logging=false）', async () => {
    const element = document.createElement('div');
    const canvas = createFakeCanvas();
    html2canvasMock.mockResolvedValue(canvas);

    const result = await captureReportElement(element);

    expect(result).toBe(canvas);
    expect(html2canvasMock).toHaveBeenCalledTimes(1);
    const [target, options] = html2canvasMock.mock.calls[0];
    expect(target).toBe(element);
    expect(options).toMatchObject({ scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
  });

  it('自定义参数可覆盖默认值', async () => {
    const element = document.createElement('div');
    html2canvasMock.mockResolvedValue(createFakeCanvas());

    await captureReportElement(element, { scale: 1, backgroundColor: '#000000' });

    const [, options] = html2canvasMock.mock.calls[0];
    expect(options.scale).toBe(1);
    expect(options.backgroundColor).toBe('#000000');
  });

  it('html2canvas 失败时错误向上抛出', async () => {
    html2canvasMock.mockRejectedValue(new Error('canvas boom'));
    await expect(captureReportElement(document.createElement('div'))).rejects.toThrow('canvas boom');
  });
});

describe('buildPdfDocument', () => {
  it('短画布 → 单页、A4 纵向 mm、按内容宽度与留白添加 JPEG 图片', () => {
    const canvas = createFakeCanvas(780, 800);
    const doc = buildPdfDocument(canvas);

    expect(jsPDFCtorMock).toHaveBeenCalledWith({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    expect(doc.addPage).not.toHaveBeenCalled();
    expect(doc.addImage).toHaveBeenCalledTimes(1);

    const [image, format, x, y, width, height] = doc.addImage.mock.calls[0];
    expect(image).toBe('data:image/jpeg;base64,FAKE');
    expect(format).toBe('JPEG');
    expect(x).toBe(10);
    expect(y).toBe(10);
    expect(width).toBe(190);
    // 800 / 780 * 190 ≈ 194.87mm
    expect(height).toBeCloseTo((800 / 780) * 190, 5);

    // 每页画布先铺白底，再把原图对应切片绘制上去
    expect(createdContexts).toHaveLength(1);
    expect(createdContexts[0].fillRect).toHaveBeenCalledWith(0, 0, 780, 800);
    expect(createdContexts[0].drawImage).toHaveBeenCalledWith(canvas, 0, 0, 780, 800, 0, 0, 780, 800);
  });

  it('长画布 → 多页：addPage 次数 = 页数-1，每页都 addImage', () => {
    const canvas = createFakeCanvas(780, 3000);
    const doc = buildPdfDocument(canvas);

    // 页高 px = floor(277 * 780/190) = floor(1137.15...) = 1137 → 3000/1137 向上取整 = 3 页
    expect(doc.addPage).toHaveBeenCalledTimes(2);
    expect(doc.addImage).toHaveBeenCalledTimes(3);
    expect(createdContexts).toHaveLength(3);

    const widths = doc.addImage.mock.calls.map((call) => call[4]);
    expect(widths).toEqual([190, 190, 190]);
  });

  it('自定义页边距生效（marginMm=0 → 内容宽度 = 210mm）', () => {
    const canvas = createFakeCanvas(780, 500);
    const doc = buildPdfDocument(canvas, { marginMm: 0 });

    const [, , x, y, width] = doc.addImage.mock.calls[0];
    expect(x).toBe(0);
    expect(y).toBe(0);
    expect(width).toBe(A4.widthMm);
  });

  it('无效画布尺寸 → 抛错且不创建 PDF 文档', () => {
    expect(() => buildPdfDocument(createFakeCanvas(0, 100))).toThrow('截图尺寸无效');
    expect(jsPDFCtorMock).not.toHaveBeenCalled();
  });
});

describe('createPdfFromCanvas', () => {
  it('默认文件名调用 doc.save', () => {
    const canvas = createFakeCanvas(780, 500);
    const doc = createPdfFromCanvas(canvas);

    expect(doc.save).toHaveBeenCalledTimes(1);
    expect(doc.save.mock.calls[0][0]).toMatch(/^质检报告-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('自定义文件名与页边距透传', () => {
    const canvas = createFakeCanvas(780, 500);
    const doc = createPdfFromCanvas(canvas, { fileName: 'custom.pdf', marginMm: 5 });

    expect(doc.save).toHaveBeenCalledWith('custom.pdf');
    const [, , x, , width] = doc.addImage.mock.calls[0];
    expect(x).toBe(5);
    expect(width).toBe(200);
  });
});

describe('exportReportToPdf', () => {
  it('先截图再生成并保存，返回 jsPDF 实例', async () => {
    const element = document.createElement('div');
    html2canvasMock.mockResolvedValue(createFakeCanvas(780, 500));

    const doc = await exportReportToPdf(element, { fileName: 'report.pdf' });

    expect(html2canvasMock).toHaveBeenCalledTimes(1);
    expect(html2canvasMock.mock.calls[0][0]).toBe(element);
    expect(doc).toBe(lastDocRef.current);
    expect(doc.save).toHaveBeenCalledWith('report.pdf');
  });

  it('截图失败时不创建 PDF、不下载', async () => {
    html2canvasMock.mockRejectedValue(new Error('capture failed'));

    await expect(exportReportToPdf(document.createElement('div'))).rejects.toThrow('capture failed');
    expect(jsPDFCtorMock).not.toHaveBeenCalled();
  });

  it('A4 常量从 pdf.js 再导出', () => {
    expect(A4).toEqual({ widthMm: 210, heightMm: 297 });
  });
});
