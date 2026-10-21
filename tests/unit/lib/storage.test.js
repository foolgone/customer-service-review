/**
 * src/lib/storage.js 单元测试
 * 覆盖：标注增删改查、标准化、批量保存/导入、主题、配置、导入历史、
 *      全量导出/导入、存储容量信息与告警、localStorage 异常分支
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  saveAnnotation,
  getAnnotation,
  getAnnotations,
  deleteAnnotation,
  clearAnnotations,
  normalizeAnnotation,
  saveAnnotations,
  loadAnnotations,
  importAnnotations,
  saveTheme,
  getTheme,
  readStoredTheme,
  writeStoredTheme,
  saveConfig,
  getConfig,
  updateConfig,
  resetConfig,
  addImportHistory,
  getImportHistory,
  clearImportHistory,
  exportAllData,
  importAllData,
  isStorageAlmostFull,
  getStorageWarning,
  storage
} from '../../../src/lib/storage.js';
import { STORAGE_KEYS, DEFAULT_ANNOTATION } from '../../../src/lib/constants.js';

const DEFAULT_CONFIG = {
  aiModel: 'deepseek',
  apiKey: '',
  apiEndpoint: 'https://api.deepseek.com/chat/completions',
  temperature: 0.7,
  maxTokens: 2000,
  autoSave: true
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('saveAnnotation / getAnnotation', () => {
  it('保存后自动补充 updatedAt，并可读回字段', () => {
    saveAnnotation('conv-1', { labels: ['accurate'], score: 5, comment: '不错' });

    const annotation = getAnnotation('conv-1');
    expect(annotation).not.toBeNull();
    expect(annotation.labels).toEqual(['accurate']);
    expect(annotation.score).toBe(5);
    expect(annotation.comment).toBe('不错');
    expect(typeof annotation.updatedAt).toBe('string');
    expect(new Date(annotation.updatedAt).toISOString()).toBe(annotation.updatedAt);
  });

  it('不同会话的标注互不影响', () => {
    saveAnnotation('conv-1', { comment: '第一条' });
    saveAnnotation('conv-2', { comment: '第二条' });

    expect(getAnnotation('conv-1').comment).toBe('第一条');
    expect(getAnnotation('conv-2').comment).toBe('第二条');
    expect(Object.keys(getAnnotations()).sort()).toEqual(['conv-1', 'conv-2']);
  });

  it('未保存过的会话 → 返回 null', () => {
    expect(getAnnotation('not-exist')).toBeNull();
  });

  it('getAnnotations 无数据时 → 返回空对象 {}', () => {
    expect(getAnnotations()).toEqual({});
  });
});

describe('deleteAnnotation / clearAnnotations', () => {
  it('删除单个标注后其他标注保留', () => {
    saveAnnotation('conv-1', { comment: 'a' });
    saveAnnotation('conv-2', { comment: 'b' });

    deleteAnnotation('conv-1');

    expect(getAnnotation('conv-1')).toBeNull();
    expect(getAnnotation('conv-2').comment).toBe('b');
    expect(getAnnotations()).toEqual({ 'conv-2': expect.any(Object) });
  });

  it('清空后返回空对象', () => {
    saveAnnotation('conv-1', { comment: 'a' });
    clearAnnotations();
    expect(getAnnotations()).toEqual({});
  });
});

describe('normalizeAnnotation', () => {
  it('传入空对象 → 得到完整默认值', () => {
    expect(normalizeAnnotation({})).toEqual(DEFAULT_ANNOTATION);
  });

  it('补全缺省字段且不丢失已有字段', () => {
    const normalized = normalizeAnnotation({ labels: ['risky'], score: 1, comment: '风险' });

    expect(normalized.labels).toEqual(['risky']);
    expect(normalized.score).toBe(1);
    expect(normalized.comment).toBe('风险');
    expect(normalized.aiLabels).toEqual([]);
    expect(normalized.aiReason).toBe('');
    expect(normalized.durationMs).toBe(0);
    expect(normalized.reviewedAt).toBe('');
  });

  it('保留未知的自定义字段', () => {
    expect(normalizeAnnotation({ custom: 'x' }).custom).toBe('x');
  });

  it('labels / aiLabels 为字符串时归一化为数组（BUG-03 脏数据防御）', () => {
    const normalized = normalizeAnnotation({ labels: 'accurate|incomplete', aiLabels: 'risky' });

    expect(normalized.labels).toEqual(['accurate', 'incomplete']);
    expect(normalized.aiLabels).toEqual(['risky']);
  });

  it('labels 为数字等非法类型时归一化为空数组', () => {
    expect(normalizeAnnotation({ labels: 123 }).labels).toEqual([]);
  });
});

describe('saveAnnotations / loadAnnotations', () => {
  it('批量保存后可通过 loadAnnotations 读回', () => {
    const data = {
      'conv-1': { labels: ['accurate'], score: 5 },
      'conv-2': { labels: ['risky'], score: 1 }
    };

    saveAnnotations(data);
    expect(loadAnnotations()).toEqual(data);
    expect(getAnnotations()).toEqual(data);
  });
});

describe('importAnnotations', () => {
  it('默认合并模式 → 合并已有标注，同名键被新数据覆盖', () => {
    saveAnnotations({ 'conv-1': { comment: '旧', score: 5 } });

    importAnnotations({
      'conv-1': { comment: '新', score: 2 },
      'conv-2': { comment: '新增', score: 3 }
    });

    const annotations = getAnnotations();
    expect(annotations['conv-1'].comment).toBe('新');
    expect(annotations['conv-2'].comment).toBe('新增');
  });

  it('overwrite 模式 → 完全替换已有标注', () => {
    saveAnnotations({ 'conv-1': { comment: '旧', score: 5 } });

    importAnnotations({ 'conv-2': { comment: '新', score: 3 } }, true);

    expect(getAnnotations()).toEqual({ 'conv-2': { comment: '新', score: 3 } });
  });
});

describe('主题设置', () => {
  it('未设置主题时默认 light', () => {
    expect(getTheme()).toBe('light');
  });

  it('saveTheme / getTheme 可写入并读回', () => {
    saveTheme('dark');
    expect(getTheme()).toBe('dark');
  });

  it('readStoredTheme / writeStoredTheme 别名行为一致', () => {
    writeStoredTheme('dark');
    expect(readStoredTheme()).toBe('dark');
    saveTheme('light');
    expect(readStoredTheme()).toBe('light');
  });
});

describe('配置相关', () => {
  it('getConfig 无数据时返回默认配置', () => {
    expect(getConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('saveConfig 保存后 getConfig 返回保存内容', () => {
    saveConfig({ apiKey: 'sk-test' });
    expect(getConfig()).toEqual({ apiKey: 'sk-test' });
  });

  it('updateConfig 只做部分更新，保留其他字段', () => {
    updateConfig({ apiKey: 'sk-test' });
    updateConfig({ temperature: 0.2 });

    const config = getConfig();
    expect(config.apiKey).toBe('sk-test');
    expect(config.temperature).toBe(0.2);
    expect(config.aiModel).toBe('deepseek');
    expect(config.maxTokens).toBe(2000);
  });

  it('resetConfig 后恢复默认配置', () => {
    updateConfig({ apiKey: 'sk-test', temperature: 0.1 });
    resetConfig();
    expect(getConfig()).toEqual(DEFAULT_CONFIG);
  });
});

describe('导入历史', () => {
  it('无历史时 getImportHistory 返回 []', () => {
    expect(getImportHistory()).toEqual([]);
  });

  it('最新记录排在最前，且自动补充 importedAt', () => {
    addImportHistory({ fileName: 'a.json' });
    addImportHistory({ fileName: 'b.json' });

    const history = getImportHistory();
    expect(history).toHaveLength(2);
    expect(history[0].fileName).toBe('b.json');
    expect(history[1].fileName).toBe('a.json');
    expect(new Date(history[0].importedAt).toISOString()).toBe(history[0].importedAt);
  });

  it('最多保留最近 20 条', () => {
    for (let index = 0; index < 25; index += 1) {
      addImportHistory({ fileName: `file-${index}.json` });
    }

    const history = getImportHistory();
    expect(history).toHaveLength(20);
    expect(history[0].fileName).toBe('file-24.json');
    expect(history[19].fileName).toBe('file-5.json');
  });

  it('clearImportHistory 清空历史', () => {
    addImportHistory({ fileName: 'a.json' });
    clearImportHistory();
    expect(getImportHistory()).toEqual([]);
  });
});

describe('exportAllData / importAllData', () => {
  it('exportAllData 包含 annotations / theme / config / importHistory / exportedAt，且不含 API Key（BUG-26）', () => {
    saveAnnotation('conv-1', { labels: ['accurate'], score: 5 });
    saveTheme('dark');
    saveConfig({ apiKey: 'sk-test', temperature: 0.2 });
    addImportHistory({ fileName: 'backup.json' });

    const data = exportAllData();

    expect(Object.keys(data).sort()).toEqual(
      ['annotations', 'config', 'exportedAt', 'importHistory', 'note', 'theme'].sort()
    );
    expect(data.annotations['conv-1'].labels).toEqual(['accurate']);
    expect(data.theme).toBe('dark');
    // 备份不包含 API Key，其它配置字段保留
    expect(data.config.apiKey).toBeUndefined();
    expect(data.config.temperature).toBe(0.2);
    expect(typeof data.note).toBe('string');
    expect(data.importHistory).toHaveLength(1);
    expect(new Date(data.exportedAt).toISOString()).toBe(data.exportedAt);
  });

  it('importAllData 合并模式 → 标注合并、主题覆盖、白名单配置更新，API Key 不被覆盖', () => {
    saveAnnotations({ 'conv-1': { comment: '旧', score: 5 } });
    saveTheme('dark');
    updateConfig({ apiKey: 'old-key', temperature: 0.3 });

    const result = importAllData({
      annotations: { 'conv-2': { comment: '新增', score: 2 } },
      theme: 'light',
      config: { temperature: 0.5, aiModel: 'deepseek-reasoner', apiKey: 'injected-key' }
    });

    expect(result.restored).toBe(true);
    expect(result.fields).toEqual(['标注', '主题', '配置']);

    const annotations = getAnnotations();
    expect(Object.keys(annotations).sort()).toEqual(['conv-1', 'conv-2']);
    expect(getTheme()).toBe('light');

    const config = getConfig();
    expect(config.temperature).toBe(0.5);
    expect(config.aiModel).toBe('deepseek-reasoner');
    // 备份/导入不能改写本机 Key
    expect(config.apiKey).toBe('old-key');
  });

  it('importAllData 覆盖模式 → 标注整体替换，配置合并且保留本机 API Key', () => {
    saveAnnotations({ 'conv-1': { comment: '旧', score: 5 } });
    updateConfig({ apiKey: 'old-key', temperature: 0.3 });

    importAllData(
      {
        annotations: { 'conv-2': { comment: '新增', score: 2 } },
        theme: 'dark',
        config: { apiKey: 'new-key', temperature: 0.1 }
      },
      true
    );

    expect(getAnnotations()).toEqual({ 'conv-2': { comment: '新增', score: 2 } });
    expect(getTheme()).toBe('dark');

    const config = getConfig();
    expect(config.apiKey).toBe('old-key');
    expect(config.temperature).toBe(0.1);
  });

  it('importAllData 缺少有效字段时返回 empty，不影响已有数据', () => {
    saveAnnotations({ 'conv-1': { comment: '保留', score: 5 } });
    saveTheme('dark');

    const result = importAllData({});

    expect(result).toEqual({ restored: false, fields: [], reason: 'empty' });
    expect(getAnnotations()).toEqual({ 'conv-1': { comment: '保留', score: 5 } });
    expect(getTheme()).toBe('dark');
  });

  it('importAllData 传入非对象（null / 数组 / 原始值）→ 返回 invalid', () => {
    expect(importAllData(null).reason).toBe('invalid');
    expect(importAllData([]).reason).toBe('invalid');
    expect(importAllData('123').reason).toBe('invalid');
  });
});

describe('localStorage 异常处理', () => {
  it('setItem 抛 QuotaExceededError → 抛出「存储空间不足，请导出数据后清理」', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(window.Storage.prototype, 'setItem').mockImplementationOnce(() => {
      const error = new Error('quota');
      error.name = 'QuotaExceededError';
      throw error;
    });

    expect(() => saveAnnotation('conv-1', { labels: [] })).toThrow(
      '存储空间不足，请导出数据后清理'
    );
  });

  it('setItem 抛其他异常 → 抛出「保存数据失败」', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(window.Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('unknown');
    });

    expect(() => saveAnnotation('conv-1', { labels: [] })).toThrow('保存数据失败');
  });

  it('getItem 抛异常 → 读取返回默认值', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(window.Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('read fail');
    });

    expect(getAnnotations()).toEqual({});
  });

  it('removeItem / clear 抛异常时被吞掉，不向上抛出', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(window.Storage.prototype, 'removeItem').mockImplementationOnce(() => {
      throw new Error('remove fail');
    });
    vi.spyOn(window.Storage.prototype, 'clear').mockImplementationOnce(() => {
      throw new Error('clear fail');
    });

    expect(() => resetConfig()).not.toThrow();
    expect(() => storage.clear()).not.toThrow();
  });
});

describe('storage 导出对象', () => {
  it('包含 setItem / getItem / removeItem / clear / getStorageInfo', () => {
    expect(Object.keys(storage).sort()).toEqual(
      ['clear', 'getItem', 'getStorageInfo', 'removeItem', 'setItem'].sort()
    );
  });

  it('storage.setItem / getItem / removeItem / clear 可正常读写', () => {
    storage.setItem('demo-key', { a: 1 });
    expect(storage.getItem('demo-key')).toEqual({ a: 1 });
    expect(storage.getItem('missing', 'fallback')).toBe('fallback');

    storage.removeItem('demo-key');
    expect(storage.getItem('demo-key')).toBeNull();

    storage.setItem('another', 1);
    storage.clear();
    expect(storage.getItem('another')).toBeNull();
  });
});

describe('getStorageInfo / 容量告警', () => {
  it('返回 used / total / percent / usedMB / totalMB', () => {
    localStorage.setItem('aaa', 'bbbb'); // 3 + 4 = 7

    const info = storage.getStorageInfo();
    expect(info.used).toBe(7);
    expect(info.total).toBe(5 * 1024 * 1024);
    expect(info.percent).toBe(Math.round((7 / (5 * 1024 * 1024)) * 100));
    expect(info.usedMB).toBe((7 / 1024 / 1024).toFixed(2));
    expect(info.totalMB).toBe('5.00');
  });

  it('写入约 4.3MB → getStorageWarning 返回 80% 档提示，isStorageAlmostFull(80) 为 true', () => {
    localStorage.setItem('big', 'x'.repeat(4300000));

    const info = storage.getStorageInfo();
    expect(info.percent).toBeGreaterThanOrEqual(80);
    expect(info.percent).toBeLessThan(90);
    expect(getStorageWarning()).toContain(`存储空间使用较多（已使用 ${info.percent}%）`);
    expect(isStorageAlmostFull(80)).toBe(true);
    expect(isStorageAlmostFull(100)).toBe(false);
  });

  it('写入约 4.7MB → getStorageWarning 返回 90% 档提示', () => {
    localStorage.setItem('big', 'x'.repeat(4700000));

    const info = storage.getStorageInfo();
    expect(info.percent).toBeGreaterThanOrEqual(90);
    expect(getStorageWarning()).toContain(`存储空间即将用尽（已使用 ${info.percent}%）`);
    expect(isStorageAlmostFull(90)).toBe(true);
  });

  it('存储为空 → 告警为 null 且未达到阈值', () => {
    expect(getStorageWarning()).toBeNull();
    expect(isStorageAlmostFull()).toBe(false);
  });

  it('阈值等于当前百分比时即视为即将满（>= 边界）', () => {
    localStorage.setItem('big', 'x'.repeat(4300000));
    const info = storage.getStorageInfo();
    expect(isStorageAlmostFull(info.percent)).toBe(true);
    expect(isStorageAlmostFull(info.percent + 1)).toBe(false);
  });
});

describe('STORAGE_KEYS 使用情况', () => {
  it('标注写入到 annotation 对应的固定键', () => {
    saveAnnotation('conv-1', { comment: 'x' });
    const raw = localStorage.getItem(STORAGE_KEYS.annotations);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw)['conv-1'].comment).toBe('x');
  });

  it('主题写入到 theme 对应的固定键', () => {
    saveTheme('dark');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.theme))).toBe('dark');
  });
});
