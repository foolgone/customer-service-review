/**
 * src/lib/settings.js 单元测试
 * 覆盖：默认值、归一化（trim/非法模型/并发范围）、与 storage 配置的读写与旧字段兼容
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AI_MODEL_OPTIONS, DEFAULT_SETTINGS, normalizeSettings, loadSettings, saveSettings } from '../../../src/lib/settings.js';

const CONFIG_KEY = 'cs-review-config-v1';

function writeConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

beforeEach(() => {
  localStorage.clear();
});

describe('normalizeSettings', () => {
  it('空输入 → 默认值', () => {
    expect(normalizeSettings()).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it('apiKey 去首尾空格，非法类型归空', () => {
    expect(normalizeSettings({ apiKey: '  sk-test  ' }).apiKey).toBe('sk-test');
    expect(normalizeSettings({ apiKey: 123 }).apiKey).toBe('');
    expect(normalizeSettings({ apiKey: null }).apiKey).toBe('');
  });

  it('模型只接受白名单，其余回落默认', () => {
    expect(normalizeSettings({ model: 'deepseek-reasoner' }).model).toBe('deepseek-reasoner');
    expect(normalizeSettings({ model: 'gpt-4' }).model).toBe(DEFAULT_SETTINGS.model);
    expect(AI_MODEL_OPTIONS.map((item) => item.value)).toContain('deepseek-chat');
  });

  it('并发数取整并限制在 1~5', () => {
    expect(normalizeSettings({ concurrency: 3 }).concurrency).toBe(3);
    expect(normalizeSettings({ concurrency: 0 }).concurrency).toBe(1);
    expect(normalizeSettings({ concurrency: 9 }).concurrency).toBe(5);
    expect(normalizeSettings({ concurrency: 2.6 }).concurrency).toBe(3);
    expect(normalizeSettings({ concurrency: 'abc' }).concurrency).toBe(DEFAULT_SETTINGS.concurrency);
  });
});

describe('saveSettings / loadSettings', () => {
  it('保存后可读回', () => {
    saveSettings({ apiKey: 'sk-abc', model: 'deepseek-reasoner', concurrency: 2 });

    expect(loadSettings()).toEqual({ apiKey: 'sk-abc', model: 'deepseek-reasoner', concurrency: 2 });

    const raw = JSON.parse(localStorage.getItem(CONFIG_KEY));
    expect(raw.apiKey).toBe('sk-abc');
    expect(raw.aiModel).toBe('deepseek-reasoner');
    expect(raw.concurrency).toBe(2);
  });

  it('无配置时返回默认设置', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('旧配置 aiModel=deepseek 映射为具体默认模型', () => {
    writeConfig({ apiKey: 'sk-old', aiModel: 'deepseek' });

    const settings = loadSettings();

    expect(settings.apiKey).toBe('sk-old');
    expect(settings.model).toBe('deepseek-chat');
    expect(settings.concurrency).toBe(DEFAULT_SETTINGS.concurrency);
  });

  it('保存设置不会丢掉配置里的其它字段', () => {
    writeConfig({ autoSave: false, temperature: 0.2, apiKey: '' });

    saveSettings({ apiKey: 'sk-new', model: 'deepseek-chat', concurrency: 4 });

    const raw = JSON.parse(localStorage.getItem(CONFIG_KEY));
    expect(raw.autoSave).toBe(false);
    expect(raw.temperature).toBe(0.2);
    expect(raw.apiKey).toBe('sk-new');
  });
});

