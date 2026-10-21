/**
 * src/lib/utils.js 单元测试
 * 覆盖：对话文本提取、ID、日期/时长格式化、防抖/节流、深拷贝、下载、
 *      文件校验、JSON 安全处理、文本截断、时间与进度计算、数组去重、空值判断
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getConversationText,
  generateId,
  formatDate,
  formatDuration,
  debounce,
  throttle,
  deepClone,
  downloadFile,
  getFileExtension,
  validateFileType,
  validateFileSize,
  formatFileSize,
  sleep,
  safeJsonParse,
  safeJsonStringify,
  truncateText,
  getNowIso,
  getDurationMs,
  getProgressLabel,
  uniqueArray,
  isEmpty
} from '../../../src/lib/utils.js';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('getConversationText', () => {
  const conversation = {
    turns: [
      { role: 'assistant', content: '第一条客服回复' },
      { role: 'user', content: '第一条用户问题' },
      { role: 'assistant', content: '第二条客服回复' }
    ]
  };

  it('正常对话 → 返回对应角色的首条消息内容', () => {
    expect(getConversationText(conversation, 'user')).toBe('第一条用户问题');
    expect(getConversationText(conversation, 'assistant')).toBe('第一条客服回复');
  });

  it('不存在该角色 → 返回空字符串', () => {
    expect(getConversationText(conversation, 'system')).toBe('');
  });

  it('conversation 为 null 或缺少 turns → 返回空字符串', () => {
    expect(getConversationText(null, 'user')).toBe('');
    expect(getConversationText(undefined, 'user')).toBe('');
    expect(getConversationText({}, 'user')).toBe('');
  });

  it('命中 turn 但 content 为空 → 返回空字符串', () => {
    expect(getConversationText({ turns: [{ role: 'user', content: '' }] }, 'user')).toBe('');
    expect(getConversationText({ turns: [{ role: 'user' }] }, 'user')).toBe('');
  });
});

describe('generateId', () => {
  it('返回非空字符串且形如「时间戳-随机串」', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(id).toMatch(/^\d+-[a-z0-9]+$/);
  });

  it('以当前时间戳开头', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    expect(generateId().startsWith('1700000000000-')).toBe(true);
  });

  it('两次调用生成不同 ID', () => {
    expect(generateId()).not.toBe(generateId());
  });
});

describe('formatDate', () => {
  // 用本地时间构造，避免依赖运行时区
  const sample = new Date(2024, 4, 1, 9, 5, 7);

  it('date 格式 → YYYY-MM-DD', () => {
    expect(formatDate(sample, 'date')).toBe('2024-05-01');
  });

  it('time 格式 → HH:mm:ss', () => {
    expect(formatDate(sample, 'time')).toBe('09:05:07');
  });

  it('不传格式（默认 datetime）→ YYYY-MM-DD HH:mm:ss', () => {
    expect(formatDate(sample)).toBe('2024-05-01 09:05:07');
    expect(formatDate(sample, 'datetime')).toBe('2024-05-01 09:05:07');
  });

  it('未知格式 → 回退到 datetime', () => {
    expect(formatDate(sample, 'unknown')).toBe('2024-05-01 09:05:07');
  });

  it('传入 ISO 字符串 → 与 Date 对象结果一致', () => {
    expect(formatDate(sample.toISOString(), 'date')).toBe('2024-05-01');
    expect(formatDate(sample.toISOString())).toBe('2024-05-01 09:05:07');
  });

  it('无效日期 → 返回空字符串', () => {
    expect(formatDate('not-a-date')).toBe('');
    expect(formatDate('2024-13-45')).toBe('');
  });

  it('空值 → 返回空字符串', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });
});

describe('formatDuration', () => {
  it('0 或负数 → "0秒"', () => {
    expect(formatDuration(0)).toBe('0秒');
    expect(formatDuration(-1000)).toBe('0秒');
    expect(formatDuration()).toBe('0秒');
  });

  it('秒级 → "N秒"', () => {
    expect(formatDuration(1000)).toBe('1秒');
    expect(formatDuration(59999)).toBe('59秒');
  });

  it('分钟级 → "N分N秒"', () => {
    expect(formatDuration(150000)).toBe('2分30秒');
    expect(formatDuration(60000)).toBe('1分0秒');
  });

  it('小时级 → "N小时N分钟"', () => {
    expect(formatDuration(3900000)).toBe('1小时5分钟');
    expect(formatDuration(7200000)).toBe('2小时0分钟');
  });

  it('毫秒部分向下取整', () => {
    expect(formatDuration(1234)).toBe('1秒');
    expect(formatDuration(61999)).toBe('1分1秒');
  });
});

describe('debounce', () => {
  it('连续调用只执行最后一次，且使用最后一次参数与调用时的 this', () => {
    vi.useFakeTimers();
    const calls = [];
    function original(...args) {
      calls.push({ args, self: this });
    }
    const debounced = debounce(original, 300);
    const context = { name: 'last-context' };

    debounced.call({ name: 'first-context' }, 1);
    debounced.call(context, 2, 'b');

    expect(calls).toHaveLength(0);
    vi.advanceTimersByTime(299);
    expect(calls).toHaveLength(0);

    vi.advanceTimersByTime(1);
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toEqual([2, 'b']);
    expect(calls[0].self).toBe(context);
  });

  it('等待 delay 后仅执行一次，之后再次调用会重新计时', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);

    debounced();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('throttle', () => {
  it('首次调用立即执行', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1700000000000));
    const fn = vi.fn();
    const throttled = throttle(fn, 300);

    throttled('first');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('first');
  });

  it('间隔内调用被忽略，超过间隔后再次执行', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1700000000000));
    const fn = vi.fn();
    const throttled = throttle(fn, 300);

    throttled('a');
    vi.advanceTimersByTime(100);
    throttled('b');
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(200); // 距上次执行满 300ms
    throttled('c');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith('c');
  });
});

describe('deepClone', () => {
  it('基本类型与 null 原样返回', () => {
    expect(deepClone(1)).toBe(1);
    expect(deepClone('abc')).toBe('abc');
    expect(deepClone(true)).toBe(true);
    expect(deepClone(null)).toBeNull();
    expect(deepClone(undefined)).toBeUndefined();
  });

  it('嵌套对象/数组深拷贝，修改副本不影响原对象', () => {
    const original = { a: 1, nested: { b: [1, 2, { c: 3 }] } };
    const cloned = deepClone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned.nested).not.toBe(original.nested);
    expect(cloned.nested.b).not.toBe(original.nested.b);

    cloned.nested.b[2].c = 99;
    cloned.a = 2;
    expect(original.nested.b[2].c).toBe(3);
    expect(original.a).toBe(1);
  });

  it('数组深拷贝且元素也复制', () => {
    const original = [{ x: 1 }, [2, 3]];
    const cloned = deepClone(original);

    expect(cloned).toEqual(original);
    expect(cloned).not.toBe(original);
    expect(cloned[0]).not.toBe(original[0]);
    expect(cloned[1]).not.toBe(original[1]);
  });

  it('Date 克隆为新的 Date 实例且时间相同', () => {
    const original = new Date(2024, 0, 2, 3, 4, 5);
    const cloned = deepClone(original);

    expect(cloned).toBeInstanceOf(Date);
    expect(cloned).not.toBe(original);
    expect(cloned.getTime()).toBe(original.getTime());
  });

  it('RegExp 克隆为等价新实例（BUG-11 已修复）', () => {
    const original = /ab+c/gi;
    const cloned = deepClone(original);

    expect(cloned).toBeInstanceOf(RegExp);
    expect(cloned).not.toBe(original);
    expect(cloned.source).toBe('ab+c');
    expect(cloned.flags).toBe('gi');
  });

  it('Map / Set 深拷贝且元素独立（BUG-11 已修复）', () => {
    const original = { map: new Map([['a', { n: 1 }]]), set: new Set([{ m: 2 }]) };
    const cloned = deepClone(original);

    expect(cloned.map).toBeInstanceOf(Map);
    expect(cloned.map).not.toBe(original.map);
    expect(cloned.map.get('a')).toEqual({ n: 1 });
    expect(cloned.map.get('a')).not.toBe(original.map.get('a'));
    expect(cloned.set).toBeInstanceOf(Set);
    expect([...cloned.set][0]).not.toBe([...original.set][0]);
  });

  it('空原型对象 Object.create(null) 可克隆且保持无原型（BUG-11 已修复）', () => {
    const original = Object.create(null);
    original.a = 1;

    const cloned = deepClone(original);

    expect(cloned.a).toBe(1);
    expect(Object.getPrototypeOf(cloned)).toBeNull();
    expect(cloned).not.toBe(original);
  });
});

describe('downloadFile', () => {
  it('创建对象 URL、构造带 download/href 的 a 标签并点击、随后释放 URL', () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const anchorList = [];
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag, ...rest) => {
      const element = originalCreateElement(tag, ...rest);
      if (String(tag).toLowerCase() === 'a') anchorList.push(element);
      return element;
    });

    const blob = new Blob(['hello'], { type: 'text/plain' });
    downloadFile(blob, '测试文件.txt');

    expect(createSpy).toHaveBeenCalledWith(blob);
    expect(anchorList).toHaveLength(1);
    const link = anchorList[0];
    expect(link.download).toBe('测试文件.txt');
    expect(link.href).toBe('blob:mock-url');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(link.isConnected).toBe(false); // 点击后已从 body 移除
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url');

    createSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });
});

describe('getFileExtension', () => {
  it('正常扩展名 → 小写返回', () => {
    expect(getFileExtension('a.JSON')).toBe('json');
    expect(getFileExtension('data.xlsx')).toBe('xlsx');
  });

  it('多后缀 → 只取最后一段', () => {
    expect(getFileExtension('archive.tar.gz')).toBe('gz');
  });

  it('无扩展名 → 空字符串', () => {
    expect(getFileExtension('README')).toBe('');
  });

  it('空值 → 空字符串', () => {
    expect(getFileExtension('')).toBe('');
    expect(getFileExtension(null)).toBe('');
    expect(getFileExtension(undefined)).toBe('');
  });
});

describe('validateFileType', () => {
  const jsonFile = new File(['{}'], 'a.json', { type: 'application/json' });

  it('MIME 命中允许列表 → true', () => {
    expect(validateFileType(jsonFile, ['application/json', 'text/csv'])).toBe(true);
  });

  it('MIME 未命中允许列表 → false', () => {
    expect(validateFileType(jsonFile, ['text/csv'])).toBe(false);
    expect(validateFileType(jsonFile, [])).toBe(false);
  });
});

describe('validateFileSize', () => {
  const file = new File(['12345'], 'a.txt', { type: 'text/plain' }); // size = 5

  it('小于上限 → true', () => {
    expect(validateFileSize(file, 10)).toBe(true);
  });

  it('恰好等于上限（相等边界）→ true', () => {
    expect(validateFileSize(file, 5)).toBe(true);
  });

  it('超过上限 → false', () => {
    expect(validateFileSize(file, 4)).toBe(false);
  });
});

describe('formatFileSize', () => {
  it('0 字节 → "0 B"', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  it('KB 级 → 保留两位小数', () => {
    expect(formatFileSize(1024)).toBe('1.00 KB');
    expect(formatFileSize(1536)).toBe('1.50 KB');
  });

  it('MB / GB 级', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.00 MB');
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.00 GB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.00 MB');
  });
});

describe('sleep', () => {
  it('在指定毫秒后才 resolve', async () => {
    vi.useFakeTimers();
    let resolved = false;
    const promise = sleep(1000).then(() => {
      resolved = true;
    });

    await vi.advanceTimersByTimeAsync(999);
    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(resolved).toBe(true);
  });
});

describe('safeJsonParse', () => {
  it('合法 JSON → 返回解析结果', () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
    expect(safeJsonParse('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('非法 JSON → 返回默认值并 console.warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(safeJsonParse('{bad json', { fallback: true })).toEqual({ fallback: true });
    expect(warn).toHaveBeenCalled();
  });

  it('非法 JSON 且未传默认值 → 返回 null', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(safeJsonParse('not json')).toBeNull();
  });
});

describe('safeJsonStringify', () => {
  it('普通对象 → 返回 JSON 字符串', () => {
    expect(safeJsonStringify({ a: 1 })).toBe('{"a":1}');
    expect(safeJsonStringify([1, 'b'])).toBe('[1,"b"]');
  });

  it('循环引用抛错 → 返回默认值并 console.warn', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const a = {};
    a.self = a;
    expect(safeJsonStringify(a)).toBe('{}');
    expect(safeJsonStringify(a, 'DEFAULT')).toBe('DEFAULT');
  });
});

describe('truncateText', () => {
  it('短文本原样返回', () => {
    expect(truncateText('short', 10)).toBe('short');
    expect(truncateText('abc', 3)).toBe('abc');
  });

  it('超长文本截断并追加默认后缀 "..."', () => {
    expect(truncateText('abcdefghij', 4)).toBe('abcd...');
  });

  it('自定义后缀', () => {
    expect(truncateText('abcdefghij', 4, '…')).toBe('abcd…');
  });

  it('空值原样返回', () => {
    expect(truncateText('')).toBe('');
    expect(truncateText(null)).toBeNull();
    expect(truncateText(undefined)).toBeUndefined();
  });
});

describe('getNowIso', () => {
  it('返回可被 new Date() 解析的 ISO 字符串', () => {
    const iso = getNowIso();
    expect(typeof iso).toBe('string');
    expect(new Date(iso).toISOString()).toBe(iso);
    expect(Math.abs(Date.now() - new Date(iso).getTime())).toBeLessThan(5000);
  });
});

describe('getDurationMs', () => {
  it('过去时间 → 返回毫秒差（>0）', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T12:00:00.000Z'));
    expect(getDurationMs('2024-06-01T11:59:00.000Z')).toBe(60000);
  });

  it('未来时间 → 返回 0', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T12:00:00.000Z'));
    expect(getDurationMs('2024-06-01T12:30:00.000Z')).toBe(0);
  });

  it('非法时间字符串 → 返回 0', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-06-01T12:00:00.000Z'));
    expect(getDurationMs('not-a-date')).toBe(0);
    expect(getDurationMs('')).toBe(0);
  });
});

describe('getProgressLabel', () => {
  it('total 为 0 或 undefined → "0 / 0"', () => {
    expect(getProgressLabel(0, 0)).toBe('0 / 0');
    expect(getProgressLabel(0, undefined)).toBe('0 / 0');
    expect(getProgressLabel(5, null)).toBe('0 / 0');
  });

  it('正常 → 显示「当前索引+1 / 总数」', () => {
    expect(getProgressLabel(2, 10)).toBe('3 / 10');
    expect(getProgressLabel(0, 10)).toBe('1 / 10');
    expect(getProgressLabel(9, 10)).toBe('10 / 10');
  });
});

describe('uniqueArray', () => {
  it('基本类型去重', () => {
    expect(uniqueArray([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
    expect(uniqueArray(['a', 'a', 'b'])).toEqual(['a', 'b']);
  });

  it('对象数组按 key 去重（保留首次出现项）', () => {
    const input = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
      { id: 1, name: 'c' }
    ];
    expect(uniqueArray(input, 'id')).toEqual([
      { id: 1, name: 'a' },
      { id: 2, name: 'b' }
    ]);
  });

  it('非数组 → 返回空数组', () => {
    expect(uniqueArray('abc')).toEqual([]);
    expect(uniqueArray(null)).toEqual([]);
    expect(uniqueArray(undefined)).toEqual([]);
    expect(uniqueArray({})).toEqual([]);
  });
});

describe('isEmpty', () => {
  it('null / undefined / 空白字符串 / 空数组 / 空对象 → true', () => {
    expect(isEmpty(null)).toBe(true);
    expect(isEmpty(undefined)).toBe(true);
    expect(isEmpty('')).toBe(true);
    expect(isEmpty('   ')).toBe(true);
    expect(isEmpty([])).toBe(true);
    expect(isEmpty({})).toBe(true);
  });

  it('非空值 / 0 / false → false', () => {
    expect(isEmpty('a')).toBe(false);
    expect(isEmpty(0)).toBe(false);
    expect(isEmpty(false)).toBe(false);
    expect(isEmpty([1])).toBe(false);
    expect(isEmpty({ a: 1 })).toBe(false);
  });
});
