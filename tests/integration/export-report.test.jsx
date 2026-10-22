/**
 * 阶段 3 导出模块 · App 级「导出报告」集成测试
 *
 * 覆盖：A 入口与预览 / B Excel 导出 / C PDF 导出 / D 关闭与回归。
 *
 * 说明：
 * - App 中导出面板是 lazy + Suspense（点击 ActionBar「导出报告」后等待标题「导出质检报告」）。
 * - 导出器内部依赖 xlsx.writeFile / html2canvas + jsPDF，jsdom 不可靠，这里在文件顶部用
 *   vi.mock 拦截动态 import，只验证 App 接线与面板交互，不触发真实文件生成。
 * - 约束：仅新建本文件，不修改 src/**、tests/setup.js、helpers、其他测试与配置。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { exportToExcel, getExcelFileName } from '../../src/lib/exporters/excel';
import { exportReportToPdf, getPdfFileName } from '../../src/lib/exporters/pdf';
import {
  USER_001,
  actionButton,
  currentLabelBox,
  installMatchMedia,
  labelButton,
  readAnnotations,
  saveStatus,
  scoreButton,
  setupApp,
  waitForWorkbench
} from './helpers/appHarness';

vi.mock('../../src/lib/exporters/excel', () => ({
  exportToExcel: vi.fn(),
  getExcelFileName: vi.fn(() => '质检报告-2026-10-21.xlsx')
}));

vi.mock('../../src/lib/exporters/pdf', () => ({
  exportReportToPdf: vi.fn(async () => ({})),
  getPdfFileName: vi.fn(() => '质检报告-2026-10-21.pdf')
}));

const EXCEL_FILE = '质检报告-2026-10-21.xlsx';
const PDF_FILE = '质检报告-2026-10-21.pdf';
const EXPORT_HEADING = { name: '导出质检报告' };
const EXCEL_SUCCESS = 'Excel 已导出（含明细 / 统计 / 问题对话三个 Sheet）';

beforeEach(() => {
  localStorage.clear();
  installMatchMedia();
  // restoreMocks/clearMocks 会清空 mock 实现，这里显式重建默认行为
  vi.mocked(exportToExcel).mockReset().mockReturnValue({});
  vi.mocked(getExcelFileName).mockReset().mockReturnValue(EXCEL_FILE);
  vi.mocked(exportReportToPdf).mockReset().mockResolvedValue({});
  vi.mocked(getPdfFileName).mockReset().mockReturnValue(PDF_FILE);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// -------------------- 本文件专用工装 --------------------

async function openExportPanel(user) {
  await user.click(actionButton('导出报告'));
  return screen.findByRole('heading', EXPORT_HEADING, { timeout: 5000 });
}

/** PDF 导出目标节点（面板内固定浅色报告 DOM） */
function reportNode() {
  return document.querySelector('[data-export-report]');
}

/** 面板遮罩层（固定定位根节点） */
function overlayNode() {
  return reportNode().closest('.fixed');
}

function closeButtons() {
  return screen.getAllByRole('button', { name: '关闭' });
}

/** 给 001 打「风险回复」标签 + 4 分 + 备注，形成一条人工审核记录 */
async function annotate001(user) {
  await user.click(labelButton('风险回复'));
  await user.click(scoreButton('4 分'));
  await user.type(screen.getByPlaceholderText(/填写人工审核备注/), '人工结论');
  await waitFor(() => {
    const stored = readAnnotations()['001'];
    expect(stored.labels).toEqual(['risky']);
    expect(stored.score).toBe(4);
    expect(stored.comment).toBe('人工结论');
  });
}

// -------------------- A. 入口与预览 --------------------

describe('A. 入口与预览', () => {
  it('点击「导出报告」→ 懒加载面板出现，无标注时总对话 2、已审核 0 / 2、完成率 0%、问题对话空态', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    await openExportPanel(user);

    const report = reportNode();
    expect(report).not.toBeNull();
    expect(within(report).getByText('总对话数').parentElement).toHaveTextContent('2');
    expect(within(report).getByText('已审核').parentElement).toHaveTextContent('0 / 2');
    expect(within(report).getByText('审核完成率').parentElement).toHaveTextContent('0%');
    expect(within(report).getByText('平均评分').parentElement).toHaveTextContent('0');
    expect(within(report).getByText('暂无问题对话（或尚未标注）')).toBeInTheDocument();
    expect(screen.getByText('导出内容包含当前筛选后的全部对话与标注')).toBeInTheDocument();
  });

  it('001 已打风险标签 + 4 分 + 备注 → 预览显示已审核 1 / 2、完成率 50%、风险率 100%，问题对话含中文标签与备注', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    await annotate001(user);

    await openExportPanel(user);

    const report = reportNode();
    expect(within(report).getByText('已审核').parentElement).toHaveTextContent('1 / 2');
    expect(within(report).getByText('审核完成率').parentElement).toHaveTextContent('50%');
    expect(within(report).getByText('风险回复率').parentElement).toHaveTextContent('100%');
    expect(within(report).getByText('平均评分').parentElement).toHaveTextContent('4');
    // 问题对话：对话 ID / 用户消息 / 中文标签 / 评分 / 备注
    expect(within(report).getByText('#001')).toBeInTheDocument();
    expect(within(report).getByText(USER_001)).toBeInTheDocument();
    expect(within(report).getByText('4 分')).toBeInTheDocument();
    expect(within(report).getByText(/标签：风险回复/)).toHaveTextContent(/备注：人工结论/);
  });

  it('001 只打「回复准确」→ 已审核 1 / 2 但问题对话仍为空（准确类标签不进入问题对话）', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    await user.click(labelButton('回复准确'));

    await openExportPanel(user);

    const report = reportNode();
    expect(within(report).getByText('已审核').parentElement).toHaveTextContent('1 / 2');
    expect(within(report).getByText('暂无问题对话（或尚未标注）')).toBeInTheDocument();
  });

  it('点击「导出 CSV」→ 不打开导出面板、不触发 Excel/PDF 导出，提示 CSV 已导出；随后「导出报告」仍可打开', async () => {
    // 避免 jsdom 对 blob 链接导航报 "Not implemented: navigation"（与其他 CSV 用例保持一致）
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { user } = setupApp();
    await waitForWorkbench();

    await user.click(actionButton('导出 CSV'));

    expect(screen.queryByRole('heading', EXPORT_HEADING)).not.toBeInTheDocument();
    expect(saveStatus()).toHaveTextContent('CSV 已导出');
    expect(exportToExcel).not.toHaveBeenCalled();
    expect(exportReportToPdf).not.toHaveBeenCalled();

    await openExportPanel(user);
    expect(exportToExcel).not.toHaveBeenCalled();
  });
});

// -------------------- B. Excel 导出 --------------------

describe('B. Excel 导出', () => {
  it('点击「导出 Excel」→ 调用一次，payload 含 2 条对话 / 001 标注 / reviewedCount=1，文件名为 getExcelFileName()，展示成功提示', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    await annotate001(user);
    await openExportPanel(user);

    await user.click(screen.getByRole('button', { name: '导出 Excel' }));

    expect(await screen.findByText(EXCEL_SUCCESS)).toBeInTheDocument();
    expect(exportToExcel).toHaveBeenCalledTimes(1);

    const [payload, fileName] = vi.mocked(exportToExcel).mock.calls[0];
    expect(payload.conversations).toHaveLength(2);
    expect(payload.annotations['001'].labels).toEqual(['risky']);
    expect(payload.analytics.reviewedCount).toBe(1);
    expect(fileName).toBe(EXCEL_FILE);
    expect(getExcelFileName).toHaveBeenCalledTimes(1);
  });

  it('Excel 导出抛出 Error → 展示错误信息，面板与主工作台不崩溃', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    vi.mocked(exportToExcel).mockImplementation(() => {
      throw new Error('磁盘空间不足');
    });
    await openExportPanel(user);

    await user.click(screen.getByRole('button', { name: '导出 Excel' }));

    expect(await screen.findByText('磁盘空间不足')).toBeInTheDocument();
    expect(screen.getByRole('heading', EXPORT_HEADING)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '质检工作台' })).toBeInTheDocument();
    closeButtons().forEach((button) => expect(button).toBeEnabled());
  });

  it('Excel 导出抛出非 Error（字符串）→ 统一提示「Excel 导出失败」', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    vi.mocked(exportToExcel).mockImplementation(() => {
      throw 'boom';
    });
    await openExportPanel(user);

    await user.click(screen.getByRole('button', { name: '导出 Excel' }));

    expect(await screen.findByText('Excel 导出失败')).toBeInTheDocument();
  });
});

// -------------------- C. PDF 导出 --------------------

describe('C. PDF 导出', () => {
  it('点击「导出 PDF」→ 调用一次，第一参数为 data-export-report 节点，第二参数文件名为 getPdfFileName()，展示成功提示', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    await openExportPanel(user);
    const target = reportNode();

    await user.click(screen.getByRole('button', { name: '导出 PDF' }));

    expect(await screen.findByText('PDF 已导出')).toBeInTheDocument();
    expect(exportReportToPdf).toHaveBeenCalledTimes(1);

    const [element, options] = vi.mocked(exportReportToPdf).mock.calls[0];
    expect(element).toBe(target);
    expect(element).toHaveAttribute('data-export-report');
    expect(options).toEqual({ fileName: PDF_FILE });
    expect(getPdfFileName).toHaveBeenCalledTimes(1);
  });

  it('PDF 导出 reject(Error) → 展示错误信息，面板保持打开', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    vi.mocked(exportReportToPdf).mockRejectedValue(new Error('截图失败'));
    await openExportPanel(user);

    await user.click(screen.getByRole('button', { name: '导出 PDF' }));

    expect(await screen.findByText('截图失败')).toBeInTheDocument();
    expect(screen.getByRole('heading', EXPORT_HEADING)).toBeInTheDocument();
  });

  it('PDF 导出 reject(非 Error) → 统一提示「PDF 导出失败」', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    vi.mocked(exportReportToPdf).mockRejectedValue('boom');
    await openExportPanel(user);

    await user.click(screen.getByRole('button', { name: '导出 PDF' }));

    expect(await screen.findByText('PDF 导出失败')).toBeInTheDocument();
  });
});

// -------------------- D. 关闭与回归 --------------------

describe('D. 关闭与回归', () => {
  it('点击「关闭」按钮 → 面板关闭，主工作台仍可打标签与切换对话', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    await openExportPanel(user);

    await user.click(closeButtons()[0]);
    expect(screen.queryByRole('heading', EXPORT_HEADING)).not.toBeInTheDocument();

    await user.click(labelButton('未解决问题'));
    expect(currentLabelBox()).toHaveTextContent('未解决问题');

    await user.click(actionButton('下一条'));
    await waitFor(() => expect(screen.getByText('当前对话 ID').parentElement).toHaveTextContent('002'));
  });

  it('点击遮罩层 → 面板关闭（点击面板内部不关闭）', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    await openExportPanel(user);

    // 点击面板内容（报告节点）不关闭
    fireEvent.click(reportNode());
    expect(screen.getByRole('heading', EXPORT_HEADING)).toBeInTheDocument();

    // 点击遮罩空白处关闭
    fireEvent.click(overlayNode());
    expect(screen.queryByRole('heading', EXPORT_HEADING)).not.toBeInTheDocument();
  });

  it('导出中（PDF mock 返回 pending Promise）→ 关闭按钮/导出按钮禁用、遮罩点击不关闭；resolve 后恢复成功提示与可操作状态', async () => {
    let resolvePdf;
    const pendingPdf = new Promise((resolve) => {
      resolvePdf = resolve;
    });
    const { user } = setupApp();
    await waitForWorkbench();
    vi.mocked(exportReportToPdf).mockReturnValue(pendingPdf);
    await openExportPanel(user);

    await user.click(screen.getByRole('button', { name: '导出 PDF' }));

    expect(await screen.findByText('正在生成 PDF...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成中...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '导出 Excel' })).toBeDisabled();
    closeButtons().forEach((button) => expect(button).toBeDisabled());

    // busy 期间遮罩点击不关闭
    fireEvent.click(overlayNode());
    expect(screen.getByRole('heading', EXPORT_HEADING)).toBeInTheDocument();

    await act(async () => {
      resolvePdf({});
    });

    expect(await screen.findByText('PDF 已导出')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导出 PDF' })).toBeEnabled();
    closeButtons().forEach((button) => expect(button).toBeEnabled());
  });

  it('关闭后新增标注再打开 → 预览反映最新数据（已审核 0 / 2 → 1 / 2，出现问题对话 001）', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    await openExportPanel(user);
    expect(within(reportNode()).getByText('已审核').parentElement).toHaveTextContent('0 / 2');

    await user.click(closeButtons()[0]);
    await annotate001(user);
    await openExportPanel(user);

    const report = reportNode();
    expect(within(report).getByText('已审核').parentElement).toHaveTextContent('1 / 2');
    expect(within(report).getByText('#001')).toBeInTheDocument();
  });

  it('按 Esc → 关闭导出面板（BUG-21 已修复）', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    await openExportPanel(user);

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('heading', EXPORT_HEADING)).not.toBeInTheDocument());
  });

  it('面板打开时按数字快捷键 → 全局快捷键被暂停，底层标注不被修改（BUG-20 已修复）', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    await openExportPanel(user);
    expect(within(reportNode()).getByText('已审核').parentElement).toHaveTextContent('0 / 2');

    // 6 = 风险回复；面板打开期间应被暂停
    fireEvent.keyDown(window, { key: '6' });
    fireEvent.keyDown(window, { key: '1', altKey: true });
    fireEvent.keyDown(window, { key: 'Enter' });

    expect(readAnnotations()['001']).toBeUndefined();
    expect(within(reportNode()).getByText('已审核').parentElement).toHaveTextContent('0 / 2');
    expect(screen.getByRole('heading', EXPORT_HEADING)).toBeInTheDocument();
  });

  it('导出报告面板打开时关闭再打开 → 导出按钮恢复初始文案且无残留提示', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    await openExportPanel(user);
    await user.click(screen.getByRole('button', { name: '导出 Excel' }));
    expect(await screen.findByText(EXCEL_SUCCESS)).toBeInTheDocument();

    await user.click(closeButtons()[1]);
    await openExportPanel(user);

    expect(screen.getByRole('button', { name: '导出 Excel' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '导出 PDF' })).toBeEnabled();
    expect(screen.getByText('导出内容包含当前筛选后的全部对话与标注')).toBeInTheDocument();
  });
});
