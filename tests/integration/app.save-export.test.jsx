/**
 * D. 保存 + E. 导出 CSV 集成测试
 * 覆盖：保存按钮 180ms 时序、reviewedAt/durationMs 持久化、Ctrl+S（含输入框聚焦）、
 * CSV 下载 Blob 的 BOM / 表头 / 数据行内容。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import {
  ASSISTANT_001,
  USER_001,
  actionButton,
  installMatchMedia,
  labelButton,
  readAnnotations,
  saveStatus,
  scoreButton,
  setupApp,
  waitForWorkbench
} from './helpers/appHarness';

beforeEach(() => {
  localStorage.clear();
  installMatchMedia();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('D. 保存', () => {
  it('点击「保存」→ 按钮短暂显示「保存中...」，随后显示「已保存 · ...」并写入 reviewedAt/durationMs', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    await user.click(labelButton('回复准确'));
    await user.click(actionButton('保存'));

    // 180ms 内按钮应进入保存中状态且禁用
    const savingButton = screen.getByRole('button', { name: '保存中...' });
    expect(savingButton).toBeDisabled();

    await waitFor(
      () => {
        expect(saveStatus()).toHaveTextContent(/已保存 ·/);
      },
      { timeout: 2000 }
    );

    // 保存结束后按钮恢复为「保存」
    expect(actionButton('保存')).toBeEnabled();

    const stored = readAnnotations()['001'];
    expect(stored).toBeTruthy();
    expect(stored.reviewedAt).toBeTruthy();
    expect(typeof stored.durationMs).toBe('number');
    expect(stored.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('Ctrl+S 在 textarea 聚焦时仍触发保存（并保存备注内容）', async () => {
    const { user } = setupApp();
    await waitForWorkbench();

    const textarea = screen.getByPlaceholderText(/填写人工审核备注/);
    await user.click(textarea);
    await user.type(textarea, '补充备注');
    await user.keyboard('{Control>}s{/Control}');

    await waitFor(
      () => {
        expect(saveStatus()).toHaveTextContent(/已保存 ·/);
      },
      { timeout: 2000 }
    );

    const stored = readAnnotations()['001'];
    expect(stored.comment).toBe('补充备注');
    expect(stored.reviewedAt).toBeTruthy();
  });
});

describe('E. 导出 CSV', () => {
  it('点击「导出 CSV」→ 提示已导出，Blob 以 BOM 开头、表头齐全、数据行含 001 原文', async () => {
    let capturedBlob = null;
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      capturedBlob = blob;
      return 'blob:integration-test';
    });
    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const { user } = setupApp();
    await waitForWorkbench();

    await user.click(actionButton('导出 CSV'));

    await waitFor(() => {
      expect(saveStatus()).toHaveTextContent('CSV 已导出');
    });
    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(capturedBlob).toBeTruthy();

    const csv = await capturedBlob.text();
    const lines = csv.replace(/^\ufeff/, '').split('\n');

    // BOM：Blob.text() / TextDecoder 解码时会按规范剥离 BOM，
    // 因此必须检查原始字节（EF BB BF）
    const bytes = new Uint8Array(await capturedBlob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(capturedBlob.type).toContain('text/csv');

    // 表头字段（值全部带引号）
    expect(lines[0]).toBe('"id","user","assistant","labels","score","comment","ai_labels","ai_reason","reviewed_at","duration_ms"');

    const row001 = lines.find((line) => line.includes('"001"'));
    expect(row001).toBeTruthy();
    expect(row001).toContain(USER_001);
    expect(row001).toContain(ASSISTANT_001);
  });

  it('已标注后再导出 → CSV 数据行的 labels/score 列包含标注结果', async () => {
    let capturedBlob = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      capturedBlob = blob;
      return 'blob:integration-test';
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const { user } = setupApp();
    await waitForWorkbench();

    await user.click(labelButton('回复准确'));
    await user.click(scoreButton('1 分'));
    await user.click(actionButton('导出 CSV'));

    await waitFor(() => {
      expect(capturedBlob).toBeTruthy();
    });

    const csv = (await capturedBlob.text()).replace(/^\ufeff/, '');
    const lines = csv.split('\n');
    const row001 = lines.find((line) => line.includes('"001"'));
    expect(row001).toContain('"accurate"');
    expect(row001).toContain('"1"');
  });
});
