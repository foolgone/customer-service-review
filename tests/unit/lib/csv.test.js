/**
 * src/lib/csv.js 单元测试
 * 覆盖：CSV 行构造（默认标注/评分兜底/标签拼接）、完整导出（BOM、表头、转义、
 *      文件名、对象 URL 与 a 标签点击/释放）
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { conversationsToCsvRows, exportConversationsToCsv } from '../../../src/lib/csv.js';
import { DEFAULT_ANNOTATION } from '../../../src/lib/constants.js';

const conversations = [
  {
    id: 'conv-1',
    turns: [
      { role: 'user', content: '用户问题' },
      { role: 'assistant', content: '客服回复' }
    ]
  },
  {
    id: 'conv-2',
    turns: [{ role: 'assistant', content: '只有客服' }]
  }
];

const annotations = {
  'conv-1': {
    labels: ['accurate', 'risky'],
    score: 5,
    comment: '不错',
    aiLabels: ['accurate'],
    aiReason: 'AI 原因',
    reviewedAt: '2024-05-01T10:00:00.000Z',
    durationMs: 120000
  }
};

const HEADER =
  '"id","user","assistant","labels","score","comment","ai_labels","ai_reason","reviewed_at","duration_ms"';

/**
 * 打桩下载环境，捕获 Blob / a 标签 / URL 调用
 */
function stubDownloadEnv() {
  const captured = { blob: null };
  const createSpy = vi
    .spyOn(URL, 'createObjectURL')
    .mockImplementation((blob) => {
      captured.blob = blob;
      return 'blob:csv-url';
    });
  const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  const anchors = [];
  const originalCreateElement = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation((tag, ...rest) => {
    const element = originalCreateElement(tag, ...rest);
    if (String(tag).toLowerCase() === 'a') anchors.push(element);
    return element;
  });

  return { captured, createSpy, revokeSpy, clickSpy, anchors };
}

/**
 * 读取 Blob 原始字节并按「保留 BOM」方式解码
 * （Blob.text() 会按 UTF-8 解码规范剥离 BOM，因此 BOM 断言需看字节）
 */
async function readBlobWithBom(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
  return { bytes, text };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('conversationsToCsvRows', () => {
  it('有标注 → 按固定列顺序返回原始值，labels/aiLabels 用 | 拼接', () => {
    const rows = conversationsToCsvRows(conversations, annotations);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual([
      'conv-1',
      '用户问题',
      '客服回复',
      'accurate|risky',
      5,
      '不错',
      'accurate',
      'AI 原因',
      '2024-05-01T10:00:00.000Z',
      120000
    ]);
  });

  it('无标注 → 使用 DEFAULT_ANNOTATION（labels 空、score 3、时长 0）', () => {
    const rows = conversationsToCsvRows(conversations, {});

    expect(rows[1]).toEqual([
      'conv-2',
      '',
      '只有客服',
      '',
      DEFAULT_ANNOTATION.score,
      '',
      '',
      '',
      '',
      DEFAULT_ANNOTATION.durationMs
    ]);
  });

  it('score 非数字 → 兜底为 0；数字字符串 → 转成数字', () => {
    const rows = conversationsToCsvRows(conversations, {
      'conv-1': { score: '不是数字' },
      'conv-2': { score: '4' }
    });

    expect(rows[0][4]).toBe(0);
    expect(rows[1][4]).toBe(4);
  });

  it('labels / aiLabels 不是数组 → 输出空字符串', () => {
    const rows = conversationsToCsvRows(conversations, {
      'conv-1': { labels: 'accurate', aiLabels: 123 }
    });

    expect(rows[0][3]).toBe('');
    expect(rows[0][6]).toBe('');
  });

  it('reviewedAt 为空 → 回退到 updatedAt', () => {
    const rows = conversationsToCsvRows(conversations, {
      'conv-1': { reviewedAt: '', updatedAt: '2024-06-01T00:00:00.000Z' }
    });

    expect(rows[0][8]).toBe('2024-06-01T00:00:00.000Z');
  });

  it('空对话列表 → 返回空数组', () => {
    expect(conversationsToCsvRows([], {})).toEqual([]);
  });
});

describe('exportConversationsToCsv', () => {
  it('生成的 Blob 以 BOM 开头、表头固定、每格带双引号、列值正确', async () => {
    const env = stubDownloadEnv();

    exportConversationsToCsv(conversations, annotations);

    expect(env.captured.blob).toBeInstanceOf(Blob);
    expect(env.captured.blob.type).toBe('text/csv;charset=utf-8;');

    const { bytes, text } = await readBlobWithBom(env.captured.blob);
    // UTF-8 BOM 字节（Blob.text() 会剥离 BOM，故断言原始字节）
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    expect(text.startsWith('\ufeff')).toBe(true);

    const lines = text.slice(1).split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(HEADER);
    expect(lines[1]).toBe(
      '"conv-1","用户问题","客服回复","accurate|risky","5","不错","accurate","AI 原因","2024-05-01T10:00:00.000Z","120000"'
    );
    expect(lines[2]).toBe('"conv-2","","只有客服","","3","","","","","0"');
  });

  it('含引号、逗号、换行的字段被正确转义（内部引号翻倍、内容保留）', async () => {
    const env = stubDownloadEnv();
    const trickyConversations = [
      {
        id: 'tricky',
        turns: [
          { role: 'user', content: '他说："请退款",然后\n结束' },
          { role: 'assistant', content: '客服回复' }
        ]
      }
    ];
    const trickyAnnotations = {
      tricky: { labels: [], score: 3, comment: '带"引号"的备注' }
    };

    exportConversationsToCsv(trickyConversations, trickyAnnotations);

    const text = await env.captured.blob.text();
    expect(text).toContain('"他说：""请退款"",然后\n结束"');
    expect(text).toContain('"带""引号""的备注"');
  });

  it('触发一次 a 标签点击，download 文件名形如 customer-service-review-YYYY-MM-DD.csv，随后释放 URL', async () => {
    const env = stubDownloadEnv();

    exportConversationsToCsv(conversations, annotations);

    expect(env.anchors).toHaveLength(1);
    const link = env.anchors[0];
    const today = new Date().toISOString().slice(0, 10);
    expect(link.download).toBe(`customer-service-review-${today}.csv`);
    expect(link.download).toMatch(/^customer-service-review-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(link.href).toBe('blob:csv-url');
    expect(env.clickSpy).toHaveBeenCalledTimes(1);
    expect(env.revokeSpy).toHaveBeenCalledWith('blob:csv-url');
    expect(env.createSpy).toHaveBeenCalledTimes(1);
    expect(link.isConnected).toBe(false); // 点击后已移出 DOM
  });

  it('空对话列表 → 只有表头一行', async () => {
    const env = stubDownloadEnv();

    exportConversationsToCsv([], {});

    const { bytes, text } = await readBlobWithBom(env.captured.blob);
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    expect(text).toBe(`\ufeff${HEADER}`);
  });
});
