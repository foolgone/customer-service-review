/**
 * src/lib/storage.js 备份契约专项回归测试（BUG-26 / BUG-27）
 * 与既有 storage.test.js 互补，聚焦：
 * - exportAllData 的字段白名单与 API Key 剔除
 * - importAllData 的格式/空数据校验、返回结构、白名单与 Key 保护
 * - 导入导出的 roundtrip 契约
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  exportAllData,
  getAnnotations,
  getConfig,
  getImportHistory,
  getTheme,
  importAllData,
  saveAnnotations,
  saveConfig,
  saveTheme
} from '../../../src/lib/storage.js';

const CONFIG_KEY = 'cs-review-config-v1';

beforeEach(() => {
  localStorage.clear();
});

function readRawConfig() {
  const raw = localStorage.getItem(CONFIG_KEY);
  return raw ? JSON.parse(raw) : null;
}

describe('exportAllData 字段白名单与 Key 剔除（BUG-26）', () => {
  it('剔除 apiKey，仅保留白名单配置字段，并附带 note 说明', () => {
    saveConfig({
      apiKey: 'sk-secret',
      aiModel: 'deepseek-reasoner',
      temperature: 0.2,
      maxTokens: 1500,
      autoSave: false,
      concurrency: 4,
      hacking: 'unknown-field'
    });
    saveAnnotations({ '001': { labels: ['accurate'] } });
    saveTheme('dark');

    const backup = exportAllData();

    expect(backup.config.apiKey).toBeUndefined();
    expect(backup.config).toEqual({
      aiModel: 'deepseek-reasoner',
      temperature: 0.2,
      maxTokens: 1500,
      autoSave: false,
      concurrency: 4
    });
    expect(backup.annotations).toEqual({ '001': { labels: ['accurate'] } });
    expect(backup.theme).toBe('dark');
    expect(backup.exportedAt).toEqual(expect.any(String));
    expect(backup.note).toContain('API Key');
  });

  it('JSON 序列化后备份文本中不出现任何 API Key 明文', () => {
    saveConfig({ ...getConfig(), apiKey: 'sk-leak-check-999' });

    const raw = JSON.stringify(exportAllData());

    expect(raw).not.toContain('sk-leak-check-999');
    expect(raw).not.toContain('apiKey');
  });
});

describe('importAllData 入参格式校验（BUG-27）', () => {
  it('非对象入参（null/undefined/数组/原始值）→ invalid 且不写入任何数据', () => {
    saveAnnotations({ '001': { labels: ['accurate'] } });
    saveTheme('light');

    const invalidInputs = [null, undefined, [], '123', 42, true];

    invalidInputs.forEach((input) => {
      expect(importAllData(input)).toEqual({ restored: false, fields: [], reason: 'invalid' });
    });

    expect(getAnnotations()['001'].labels).toEqual(['accurate']);
    expect(getTheme()).toBe('light');
  });

  it('无任何有效字段（{} / 只有非法字段）→ empty 且不写入', () => {
    expect(importAllData({})).toEqual({ restored: false, fields: [], reason: 'empty' });
    expect(importAllData({ annotations: 'bad', theme: 'blue', config: 'bad' })).toEqual({
      restored: false,
      fields: [],
      reason: 'empty'
    });
    expect(getTheme()).toBe('light');
  });
});

describe('importAllData 白名单与 Key 保护（BUG-26）', () => {
  it('配置走白名单：apiKey 与未知字段被剔除，合法字段写入', () => {
    saveConfig({ ...getConfig(), apiKey: 'sk-local' });

    const result = importAllData({
      config: {
        apiKey: 'sk-injected',
        aiModel: 'deepseek-reasoner',
        temperature: 0.9,
        hacking: 'x',
        nested: { deep: true }
      }
    });

    expect(result).toEqual({ restored: true, fields: ['配置'], reason: 'ok' });
    const config = getConfig();
    expect(config.apiKey).toBe('sk-local');
    expect(config.aiModel).toBe('deepseek-reasoner');
    expect(config.temperature).toBe(0.9);
    expect(config.hacking).toBeUndefined();
    expect(config.nested).toBeUndefined();
  });

  it('本机无 Key 时导入备份也不会写入 Key', () => {
    const result = importAllData({ config: { apiKey: 'sk-injected', concurrency: 2 } });

    expect(result.restored).toBe(true);
    expect(getConfig().apiKey || '').toBe('');
    expect(readRawConfig().apiKey || '').toBe('');
    expect(getConfig().concurrency).toBe(2);
  });

  it('导入配置是合并而非替换：备份未提供的已有字段保留', () => {
    saveConfig({ apiKey: 'sk-local', temperature: 0.1, maxTokens: 2000, autoSave: true });

    importAllData({ config: { concurrency: 5 } });

    expect(getConfig()).toMatchObject({
      apiKey: 'sk-local',
      concurrency: 5,
      temperature: 0.1,
      maxTokens: 2000,
      autoSave: true
    });
  });

  it('主题只接受 light/dark/system，非法值被忽略', () => {
    saveTheme('light');

    expect(importAllData({ theme: 'blue' }).reason).toBe('empty');
    expect(importAllData({ theme: 123 }).reason).toBe('empty');
    expect(getTheme()).toBe('light');

    expect(importAllData({ theme: 'dark' })).toEqual({ restored: true, fields: ['主题'], reason: 'ok' });
    expect(getTheme()).toBe('dark');
  });
});

describe('importAllData 标注合并/覆盖与 fields 汇总', () => {
  it('合并模式保留已有标注；覆盖模式整体替换', () => {
    saveAnnotations({ old: { labels: ['risky'] } });

    importAllData({ annotations: { '001': { labels: ['accurate'] } } }, false);
    expect(Object.keys(getAnnotations()).sort()).toEqual(['001', 'old']);

    importAllData({ annotations: { '002': { labels: ['risky'] } } }, true);
    expect(Object.keys(getAnnotations())).toEqual(['002']);
  });

  it('fields 按 标注 → 主题 → 配置 顺序汇总', () => {
    const result = importAllData({
      annotations: { '001': { labels: ['accurate'] } },
      theme: 'dark',
      config: { concurrency: 2 }
    });

    expect(result).toEqual({ restored: true, fields: ['标注', '主题', '配置'], reason: 'ok' });
  });

  it('annotations 为非对象（数组/字符串）时被忽略，不污染本地标注', () => {
    saveAnnotations({ keep: { labels: ['accurate'] } });

    expect(importAllData({ annotations: ['001'] }).reason).toBe('empty');
    expect(importAllData({ annotations: 'bad' }).reason).toBe('empty');
    expect(getAnnotations()).toEqual({ keep: { labels: ['accurate'] } });
  });
});

describe('导出 → 导入 roundtrip 契约', () => {
  it('导出的备份可原样导入：标注/主题/配置恢复，Key 保持本机值', () => {
    saveConfig({ apiKey: 'sk-local', aiModel: 'deepseek-chat', concurrency: 3, temperature: 0.2 });
    saveAnnotations({ '001': { labels: ['incomplete'], score: 2, comment: '测试' } });
    saveTheme('dark');
    const backup = exportAllData();

    // 模拟换环境：清空本地数据后导入备份（本机原有 Key 应被保留）
    localStorage.clear();
    saveConfig({ ...getConfig(), apiKey: 'sk-new-machine' });

    const result = importAllData(backup, true);

    expect(result).toEqual({ restored: true, fields: ['标注', '主题', '配置'], reason: 'ok' });
    expect(getAnnotations()['001']).toMatchObject({ labels: ['incomplete'], score: 2, comment: '测试' });
    expect(getTheme()).toBe('dark');
    expect(getConfig()).toMatchObject({ apiKey: 'sk-new-machine', concurrency: 3, temperature: 0.2 });
  });

  it('备份不会携带 importHistory（导出含该字段，但导入不消费）', () => {
    const result = importAllData({ importHistory: [{ fileName: 'x.csv' }] });
    expect(result.reason).toBe('empty');
    expect(getImportHistory()).toEqual([]);
  });
});
