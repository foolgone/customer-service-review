/**
 * ExportReportPanel 组件单元测试
 * 覆盖：关闭态、报告预览（总对话数/已审核/准确率/风险率/平均评分/完成率/标签分布/问题对话）、
 *       props 缺省回落、Excel 动态导入导出成功与 Error / 非 Error 失败、
 *       PDF 导出成功（生成中 → 成功）与 Error / 非 Error 失败、
 *       busy 期间按钮文案与禁用、遮罩点击关闭与被多路径关闭阻止、
 *       标题区 / 底部关闭按钮、连续导出状态切换、Esc 实际行为（组件无 Esc 监听）。
 *
 * 说明：
 * - 导出器模块（src/lib/exporters/excel、pdf）通过 vi.mock 替换，避免加载 xlsx / html2canvas 重依赖；
 *   组件内部使用动态 import()，vi.mock 同样生效；
 * - PDF 用「手动可控 Promise」把导出挂起，稳定观察 busy 中间态；
 * - 不修改源码，按当前实现的实际行为断言。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const exporterMocks = vi.hoisted(() => ({
  exportToExcel: vi.fn(),
  getExcelFileName: vi.fn(),
  exportReportToPdf: vi.fn(),
  getPdfFileName: vi.fn()
}));

vi.mock('../../../../src/lib/exporters/excel', () => ({
  exportToExcel: exporterMocks.exportToExcel,
  getExcelFileName: exporterMocks.getExcelFileName
}));

vi.mock('../../../../src/lib/exporters/pdf', () => ({
  exportReportToPdf: exporterMocks.exportReportToPdf,
  getPdfFileName: exporterMocks.getPdfFileName
}));

import ExportReportPanel from '../../../../src/components/export/ExportReportPanel';

const EXCEL_FILE_NAME = '质检报告-2026-10-21.xlsx';
const PDF_FILE_NAME = '质检报告-2026-10-21.pdf';
const EXCEL_SUCCESS_TEXT = 'Excel 已导出（含明细 / 统计 / 问题对话三个 Sheet）';

function makeConversation(id, { user = `用户问题 ${id}`, assistant = `客服回复 ${id}`, withTurns = true } = {}) {
  return {
    id,
    turns: withTurns
      ? [
          { role: 'user', content: user },
          { role: 'assistant', content: assistant }
        ]
      : undefined
  };
}

function makeConversations() {
  return [makeConversation('conv-1'), makeConversation('conv-2'), makeConversation('conv-3')];
}

function makeAnalytics() {
  return {
    totalCount: 20,
    reviewedCount: 12,
    accuracyRate: 75,
    riskyRate: 17,
    avgScore: 4.3,
    historicalLabels: [
      { name: '回复准确', value: 9, rate: 45 },
      { name: '风险回复', value: 2, rate: 10 },
      { name: '跑题', value: 0, rate: 0 }
    ]
  };
}

/** 可控 Promise：用于让 PDF 导出停留在 busy 中间态 */
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function getReportNode(container) {
  return container.querySelector('[data-export-report]');
}

/** 取统计卡片的数值节点（卡片结构：<p>标题</p><p>数值</p>） */
function getStatCard(label) {
  return screen.getByText(label).parentElement;
}

function renderPanel(overrides = {}) {
  const props = {
    open: true,
    conversations: makeConversations(),
    annotations: {},
    analytics: makeAnalytics(),
    onClose: vi.fn(),
    ...overrides
  };

  const view = render(<ExportReportPanel {...props} />);
  return { props, ...view };
}

beforeEach(() => {
  exporterMocks.getExcelFileName.mockReturnValue(EXCEL_FILE_NAME);
  exporterMocks.getPdfFileName.mockReturnValue(PDF_FILE_NAME);
  exporterMocks.exportToExcel.mockReturnValue(undefined);
  exporterMocks.exportReportToPdf.mockResolvedValue(undefined);
});

afterEach(() => {
  exporterMocks.exportToExcel.mockReset();
  exporterMocks.exportReportToPdf.mockReset();
  exporterMocks.getExcelFileName.mockReset();
  exporterMocks.getPdfFileName.mockReset();
});

describe('ExportReportPanel 渲染与报告预览', () => {
  it('open=false → 返回 null，不渲染标题与报告节点', () => {
    const { container } = renderPanel({ open: false });

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('heading', { name: '导出质检报告' })).not.toBeInTheDocument();
    expect(getReportNode(container)).toBeNull();
  });

  it('open=true → 渲染标题/说明/两个关闭按钮/Excel 与 PDF 按钮以及 data-export-report 报告节点', () => {
    const { container } = renderPanel();

    expect(screen.getByRole('heading', { name: '导出质检报告' })).toBeInTheDocument();
    expect(screen.getByText(/Excel 含明细 \/ 统计 \/ 问题对话三个工作表/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '关闭' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: '导出 Excel' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '导出 PDF' })).toBeEnabled();

    const report = getReportNode(container);
    expect(report).not.toBeNull();
    expect(report).toHaveAttribute('data-export-report');
    expect(screen.getByText('导出内容包含当前筛选后的全部对话与标注')).toBeInTheDocument();
  });

  it('预览数值与 analytics 一致（总数/已审核/准确率/风险率/平均评分/完成率）', () => {
    const { container } = renderPanel();
    const report = getReportNode(container);

    expect(within(report).getByText('20')).toBeInTheDocument();
    expect(within(report).getByText('12 / 20')).toBeInTheDocument();
    expect(within(report).getByText('75%')).toBeInTheDocument();
    expect(within(report).getByText('17%')).toBeInTheDocument();
    expect(within(report).getByText('4.3')).toBeInTheDocument();
    expect(within(report).getByText('60%')).toBeInTheDocument();

    expect(within(getStatCard('已审核')).getByText('12 / 20')).toBeInTheDocument();
    expect(within(getStatCard('回复准确率')).getByText('75%')).toBeInTheDocument();
    expect(within(getStatCard('风险回复率')).getByText('17%')).toBeInTheDocument();
    expect(within(getStatCard('平均评分')).getByText('4.3')).toBeInTheDocument();
  });

  it('analytics 缺省 → total 回落 conversations.length、reviewed 为 0、完成率 0%', () => {
    const { container } = renderPanel({ analytics: {} });
    const report = getReportNode(container);

    expect(within(report).getByText('3')).toBeInTheDocument();
    expect(within(report).getByText('0 / 3')).toBeInTheDocument();
    expect(within(report).getAllByText('0%')).toHaveLength(3);
    expect(within(getStatCard('回复准确率')).getByText('0%')).toBeInTheDocument();
    expect(within(getStatCard('风险回复率')).getByText('0%')).toBeInTheDocument();
    expect(within(getStatCard('平均评分')).getByText('0')).toBeInTheDocument();
  });

  it('props 全部缺省（仅 open/onClose）→ 空数据下不崩溃，总数 0、空态文案齐全', () => {
    const { container } = render(<ExportReportPanel open onClose={vi.fn()} />);
    const report = getReportNode(container);

    expect(within(report).getByText('0 / 0')).toBeInTheDocument();
    expect(within(report).getByText('暂无标注数据')).toBeInTheDocument();
    expect(within(report).getByText('暂无问题对话（或尚未标注）')).toBeInTheDocument();
    expect(within(getStatCard('回复准确率')).getByText('0%')).toBeInTheDocument();
    expect(within(report).getAllByText('0%')).toHaveLength(3);
  });

  it('historicalLabels 有数据 → 按次数与占比渲染标签分布，并绘制完成率/标签条宽度', () => {
    const { container } = renderPanel();
    const report = getReportNode(container);

    expect(within(report).getByText('回复准确')).toBeInTheDocument();
    expect(within(report).getByText('9 次 · 45%')).toBeInTheDocument();
    expect(within(report).getByText('风险回复')).toBeInTheDocument();
    expect(within(report).getByText('2 次 · 10%')).toBeInTheDocument();
    expect(within(report).getByText('0 次 · 0%')).toBeInTheDocument();

    const widths = Array.from(report.querySelectorAll('div[style]')).map((element) => element.style.width);
    expect(widths).toContain('60%');
    expect(widths).toContain('45%');
    expect(widths).toContain('10%');
    expect(widths).toContain('0%');
    expect(screen.queryByText('暂无标注数据')).not.toBeInTheDocument();
  });

  it('historicalLabels 为空数组 → 显示「暂无标注数据」；未传该字段同样显示', () => {
    const { container } = renderPanel({
      analytics: { ...makeAnalytics(), historicalLabels: [] }
    });
    expect(within(getReportNode(container)).getByText('暂无标注数据')).toBeInTheDocument();

    renderPanel({ analytics: { ...makeAnalytics(), historicalLabels: undefined } });
    expect(screen.getAllByText('暂无标注数据')).toHaveLength(2);
  });
});

describe('ExportReportPanel 问题对话列表', () => {
  const problemConversations = [
    makeConversation('conv-ok'),
    makeConversation('conv-risk', { user: '用户想退款' }),
    makeConversation('conv-multi', { user: '用户问发货' })
  ];

  const problemAnnotations = {
    'conv-ok': { labels: ['accurate'], score: 5, comment: '' },
    'conv-risk': { labels: ['risky'], score: 2, comment: '建议复盘' },
    'conv-multi': { labels: ['incomplete', 'off_topic'], score: 3 }
  };

  it('混合标注 → 只展示含非 accurate 标签的问题对话，并映射中文标签/评分/备注', () => {
    const { container } = renderPanel({
      conversations: problemConversations,
      annotations: problemAnnotations,
      analytics: { ...makeAnalytics(), historicalLabels: [] }
    });
    const report = getReportNode(container);

    expect(within(report).getByText('问题对话（最多 10 条）')).toBeInTheDocument();
    expect(within(report).getByText('#conv-risk')).toBeInTheDocument();
    expect(within(report).getByText('#conv-multi')).toBeInTheDocument();
    expect(within(report).queryByText('#conv-ok')).not.toBeInTheDocument();

    expect(within(report).getByText('用户想退款')).toBeInTheDocument();
    expect(within(report).getByText('2 分')).toBeInTheDocument();
    expect(within(report).getByText('标签：风险回复 ｜ 备注：建议复盘')).toBeInTheDocument();
    expect(within(report).getByText('标签：未解决问题、跑题')).toBeInTheDocument();
  });

  it('问题对话可包含无 turns 的对话 → 用户消息为空、评分回落 0、无备注', () => {
    const { container } = renderPanel({
      conversations: [makeConversation('conv-empty', { withTurns: false })],
      annotations: { 'conv-empty': { labels: ['hallucination'] } },
      analytics: { ...makeAnalytics(), historicalLabels: [] }
    });
    const report = getReportNode(container);

    expect(within(report).getByText('#conv-empty')).toBeInTheDocument();
    expect(within(report).getByText('0 分')).toBeInTheDocument();
    expect(within(report).getByText('标签：编造信息')).toBeInTheDocument();
  });

  it('问题对话超过 10 条 → 只展示前 10 条', () => {
    const manyConversations = Array.from({ length: 12 }, (_, index) => makeConversation(`conv-${index + 1}`));
    const manyAnnotations = Object.fromEntries(
      manyConversations.map((conversation) => [conversation.id, { labels: ['risky'], score: 1 }])
    );

    const { container } = renderPanel({
      conversations: manyConversations,
      annotations: manyAnnotations,
      analytics: { ...makeAnalytics(), historicalLabels: [] }
    });
    const report = getReportNode(container);

    expect(within(report).getAllByText(/^#conv-\d+$/)).toHaveLength(10);
    expect(within(report).queryByText('#conv-11')).not.toBeInTheDocument();
    expect(within(report).queryByText('#conv-12')).not.toBeInTheDocument();
  });

  it('无问题对话 → 显示「暂无问题对话（或尚未标注）」', () => {
    const { container } = renderPanel({
      annotations: { 'conv-1': { labels: ['accurate'] }, 'conv-2': { labels: ['accurate'] } }
    });

    expect(within(getReportNode(container)).getByText('暂无问题对话（或尚未标注）')).toBeInTheDocument();
  });
});

describe('ExportReportPanel Excel 导出', () => {
  it('点击导出 Excel → 动态导入导出器，传入 conversations/annotations/analytics 与文件名，成功提示后按钮恢复', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.click(screen.getByRole('button', { name: '导出 Excel' }));

    expect(await screen.findByText(EXCEL_SUCCESS_TEXT)).toBeInTheDocument();
    expect(exporterMocks.exportToExcel).toHaveBeenCalledTimes(1);
    expect(exporterMocks.exportToExcel).toHaveBeenCalledWith(
      {
        conversations: props.conversations,
        annotations: props.annotations,
        analytics: props.analytics
      },
      EXCEL_FILE_NAME
    );
    expect(exporterMocks.getExcelFileName).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '导出 Excel' })).toBeEnabled();
    expect(screen.queryByText('导出中...')).not.toBeInTheDocument();
  });

  it('Excel 导出抛 Error → 展示 error.message 且不出现成功提示', async () => {
    const user = userEvent.setup();
    exporterMocks.exportToExcel.mockImplementation(() => {
      throw new Error('磁盘已满，写入失败');
    });
    renderPanel();

    await user.click(screen.getByRole('button', { name: '导出 Excel' }));

    expect(await screen.findByText('磁盘已满，写入失败')).toBeInTheDocument();
    expect(screen.queryByText(EXCEL_SUCCESS_TEXT)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出 Excel' })).toBeEnabled();
  });

  it('Excel 导出抛非 Error → 展示兜底文案「Excel 导出失败」', async () => {
    const user = userEvent.setup();
    exporterMocks.exportToExcel.mockImplementation(() => {
      throw '未知错误';
    });
    renderPanel();

    await user.click(screen.getByRole('button', { name: '导出 Excel' }));

    expect(await screen.findByText('Excel 导出失败')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出 Excel' })).toBeEnabled();
  });

  it('Excel 导出进行中 → 按钮文案「导出中...」、两个关闭与两个导出按钮全部禁用、遮罩点击不关闭', async () => {
    const { props, container } = renderPanel();

    // 同步点击后立即断言 busy 中间态（动态 import 的微任务尚未完成）
    fireEvent.click(screen.getByRole('button', { name: '导出 Excel' }));

    expect(screen.getByRole('button', { name: '导出中...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '导出 PDF' })).toBeDisabled();
    screen.getAllByRole('button', { name: '关闭' }).forEach((button) => expect(button).toBeDisabled());

    fireEvent.click(container.firstChild);
    expect(props.onClose).not.toHaveBeenCalled();

    expect(await screen.findByText(EXCEL_SUCCESS_TEXT)).toBeInTheDocument();
    screen.getAllByRole('button', { name: '关闭' }).forEach((button) => expect(button).toBeEnabled());
  });
});

describe('ExportReportPanel PDF 导出', () => {
  it('点击导出 PDF → 先提示「正在生成 PDF...」，完成后传入 data-export-report 节点与文件名并显示「PDF 已导出」', async () => {
    const user = userEvent.setup();
    const pdfDeferred = deferred();
    exporterMocks.exportReportToPdf.mockReturnValue(pdfDeferred.promise);
    const { container } = renderPanel();

    await user.click(screen.getByRole('button', { name: '导出 PDF' }));

    expect(screen.getByText('正在生成 PDF...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成中...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '导出 Excel' })).toBeDisabled();

    expect(exporterMocks.exportReportToPdf).toHaveBeenCalledTimes(1);
    const [reportNode, options] = exporterMocks.exportReportToPdf.mock.calls[0];
    const report = getReportNode(container);
    expect(report).not.toBeNull();
    expect(reportNode).toBe(report);
    expect(reportNode).toHaveAttribute('data-export-report');
    expect(options).toEqual({ fileName: PDF_FILE_NAME });
    expect(exporterMocks.getPdfFileName).toHaveBeenCalledTimes(1);

    await act(async () => {
      pdfDeferred.resolve();
    });

    expect(await screen.findByText('PDF 已导出')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出 PDF' })).toBeEnabled();
    expect(screen.queryByText('正在生成 PDF...')).not.toBeInTheDocument();
  });

  it('PDF 导出 reject Error → 展示 error.message 且按钮恢复', async () => {
    const user = userEvent.setup();
    exporterMocks.exportReportToPdf.mockRejectedValue(new Error('报告截图失败'));
    renderPanel();

    await user.click(screen.getByRole('button', { name: '导出 PDF' }));

    expect(await screen.findByText('报告截图失败')).toBeInTheDocument();
    expect(screen.queryByText('PDF 已导出')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出 PDF' })).toBeEnabled();
  });

  it('PDF 导出 reject 非 Error → 展示兜底文案「PDF 导出失败」', async () => {
    const user = userEvent.setup();
    exporterMocks.exportReportToPdf.mockRejectedValue('网络中断');
    renderPanel();

    await user.click(screen.getByRole('button', { name: '导出 PDF' }));

    expect(await screen.findByText('PDF 导出失败')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出 PDF' })).toBeEnabled();
  });

  it('PDF 生成中 → 点击面板内部与遮罩均不关闭，完成后遮罩点击可关闭', async () => {
    const user = userEvent.setup();
    const pdfDeferred = deferred();
    exporterMocks.exportReportToPdf.mockReturnValue(pdfDeferred.promise);
    const { props, container } = renderPanel();

    await user.click(screen.getByRole('button', { name: '导出 PDF' }));
    expect(screen.getByText('正在生成 PDF...')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('heading', { name: '导出质检报告' }));
    fireEvent.click(container.firstChild);
    expect(props.onClose).not.toHaveBeenCalled();

    await act(async () => {
      pdfDeferred.resolve();
    });
    await screen.findByText('PDF 已导出');

    fireEvent.click(container.firstChild);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ExportReportPanel 关闭与连续操作', () => {
  it('点击标题区关闭与底部关闭分别调用 onClose', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();
    const [titleClose, footerClose] = screen.getAllByRole('button', { name: '关闭' });

    await user.click(titleClose);
    expect(props.onClose).toHaveBeenCalledTimes(1);

    await user.click(footerClose);
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it('点击遮罩自身调用 onClose；点击报告面板内部不关闭', () => {
    const { props, container } = renderPanel();

    fireEvent.click(screen.getByRole('heading', { name: '导出质检报告' }));
    expect(props.onClose).not.toHaveBeenCalled();

    fireEvent.click(container.firstChild);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc 关闭面板（BUG-21 已修复）', () => {
    const { props } = renderPanel();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('连续导出 Excel → PDF → 提示与 busy 状态正确切换', async () => {
    const user = userEvent.setup();
    const pdfDeferred = deferred();
    exporterMocks.exportReportToPdf.mockReturnValue(pdfDeferred.promise);
    renderPanel();

    await user.click(screen.getByRole('button', { name: '导出 Excel' }));
    expect(await screen.findByText(EXCEL_SUCCESS_TEXT)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '导出 PDF' }));
    expect(screen.getByText('正在生成 PDF...')).toBeInTheDocument();
    expect(screen.queryByText(EXCEL_SUCCESS_TEXT)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成中...' })).toBeDisabled();

    await act(async () => {
      pdfDeferred.resolve();
    });

    expect(await screen.findByText('PDF 已导出')).toBeInTheDocument();
    expect(exporterMocks.exportToExcel).toHaveBeenCalledTimes(1);
    expect(exporterMocks.exportReportToPdf).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '导出 PDF' })).toBeEnabled();
  });
});
