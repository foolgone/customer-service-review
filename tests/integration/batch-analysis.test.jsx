/**
 * 阶段 3 P1 · App 级 AI 批量分析集成测试
 *
 * 覆盖：A 入口与权限 / B 范围计数与切换 / C 成功流程（人工标注保护、持久化、Dashboard 回归）/
 *      D 失败隔离（401 全失败、部分失败）/ E 取消 / F 关闭与回归。
 *
 * 约束：仅依赖 tests/integration/helpers/appHarness.jsx 的 App 工装，不修改 src/**。
 * 说明：批量分析面板由 App 直接 import（非 lazy），点击入口后同步挂载，无需等待 chunk。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  DEEPSEEK_SUCCESS_BODY,
  DEEPSEEK_URL_PART,
  USER_001,
  USER_002,
  actionButton,
  analysisSection,
  currentLabelBox,
  getDeepSeekCalls,
  httpErrorResponse,
  installMatchMedia,
  jsonResponse,
  labelButton,
  readAnnotations,
  reviewedCard,
  saveStatus,
  scoreButton,
  setupApp,
  waitForWorkbench
} from './helpers/appHarness';

const BATCH_HEADING = { name: '批量 AI 分析' };
const START_BUTTON = /^开始分析 \d+ 条$/;

beforeEach(() => {
  localStorage.clear();
  installMatchMedia();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// -------------------- 本文件专用工装 --------------------

/** 通过 window.prompt 桩导入 API Key（与既有 app.ai-theme.test.jsx 保持同一路径） */
async function importApiKey(user, key = 'sk-test') {
  vi.spyOn(window, 'prompt').mockReturnValue(key);
  await user.click(actionButton('导入 API'));
}

/** 渲染 App、等待工作台、导入 API Key，返回 { user, fetchMock } */
async function setupWithKey(fetchOptions = {}) {
  const app = setupApp(fetchOptions);
  await waitForWorkbench();
  await importApiKey(app.user);
  return app;
}

/** 点击 ActionBar「批量分析」，等待面板标题渲染 */
async function openBatchPanel(user) {
  await user.click(actionButton('批量分析'));
  return screen.findByRole('heading', BATCH_HEADING, { timeout: 5000 });
}

function scopeButton(pattern) {
  return screen.getByRole('button', { name: pattern });
}

function startButton() {
  return screen.getByRole('button', { name: START_BUTTON });
}

function closeButtons() {
  return screen.getAllByRole('button', { name: '关闭' });
}

/**
 * 按「请求体里的对话内容」分发的 DeepSeek fetch（用于部分失败场景）。
 * 必须在 waitForWorkbench 之后安装：此前的对话数据请求已由 harness 处理完毕。
 */
function installDeepSeekFetchByPrompt() {
  const fetchMock = vi.fn(async (input, options = {}) => {
    const url = String(input);

    if (url.includes(DEEPSEEK_URL_PART)) {
      const body = JSON.parse(options.body || '{}');
      const prompt = body.messages?.[1]?.content || '';
      // 001 成功、002 失败，与请求发起顺序无关，避免并发调度造成的顺序偶发
      return prompt.includes(USER_001) ? jsonResponse(DEEPSEEK_SUCCESS_BODY) : httpErrorResponse(401, 'unauthorized');
    }

    throw new Error(`未预期的 fetch 请求：${url}`);
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// -------------------- A. 入口与权限 --------------------

describe('A. 入口与权限', () => {
  it('初始未配置 API Key → 「AI 分析」与「批量分析」均禁用，配置状态显示未配置', async () => {
    setupApp();
    await waitForWorkbench();

    expect(actionButton('AI 分析')).toBeDisabled();
    expect(actionButton('批量分析')).toBeDisabled();
    expect(screen.getByText(/当前状态：未配置/)).toBeInTheDocument();
  });

  it('通过「导入 API」输入 sk-test（含首尾空格）→ 状态「已配置」、批量分析按钮启用且不发起 DeepSeek 请求', async () => {
    const { user, fetchMock } = setupApp();
    await waitForWorkbench();

    await importApiKey(user, '  sk-test  ');

    expect(screen.getByText(/当前状态：已配置/)).toBeInTheDocument();
    expect(actionButton('AI 分析')).toBeEnabled();
    expect(actionButton('批量分析')).toBeEnabled();
    expect(saveStatus()).toHaveTextContent('DeepSeek API Key 已导入到当前会话');
    // 仅导入 Key 不应产生任何 AI 调用
    expect(getDeepSeekCalls(fetchMock)).toHaveLength(0);
  });

  it('已配置 Key 后点击「批量分析」→ 面板出现，默认范围「仅未分析」，候选 2 条、开始按钮「开始分析 2 条」', async () => {
    const { user } = await setupWithKey();

    await openBatchPanel(user);

    // 默认范围：仅未分析（选中态）
    expect(scopeButton(/仅未分析 2 条/)).toHaveClass('border-cyan-400');
    expect(scopeButton(/仅未审核 2 条/)).toBeInTheDocument();
    expect(scopeButton(/全部对话 2 条/)).toBeInTheDocument();
    // 两条对话都还没有 AI 建议，候选数 = 2
    expect(startButton()).toHaveTextContent('开始分析 2 条');
    expect(startButton()).toBeEnabled();
    // 默认并发数 3，空闲摘要文案
    expect(screen.getByRole('combobox')).toHaveValue('3');
    expect(screen.getByText('选择范围后开始批量分析')).toBeInTheDocument();
  });
});

// -------------------- B. 范围计数与切换 --------------------

describe('B. 范围计数与切换', () => {
  it('001 已有人工标签 → 仅未分析仍 2 条、仅未审核 1 条；点击「仅未审核」后开始按钮变为「开始分析 1 条」', async () => {
    const { user } = await setupWithKey();

    await user.click(labelButton('风险回复'));
    await waitFor(() => expect(currentLabelBox()).toHaveTextContent('风险回复'));

    await openBatchPanel(user);

    // 人工标签不影响 AI 分析范围：仅未分析仍为 2
    expect(scopeButton(/仅未分析 2 条/)).toBeInTheDocument();
    // 001 已有人工标签 → 仅未审核只剩 002
    expect(scopeButton(/仅未审核 1 条/)).toBeInTheDocument();
    expect(scopeButton(/全部对话 2 条/)).toBeInTheDocument();
    expect(startButton()).toHaveTextContent('开始分析 2 条');

    await user.click(scopeButton(/仅未审核/));

    expect(scopeButton(/仅未审核 1 条/)).toHaveClass('border-cyan-400');
    expect(startButton()).toHaveTextContent('开始分析 1 条');
  });

  it('已完成一次成功批量分析 → 重新打开面板「仅未分析 0 条」且开始按钮被禁用', async () => {
    const { user } = await setupWithKey();

    await openBatchPanel(user);
    await user.click(startButton());
    await screen.findByText('分析完成：成功 2 条');

    // 关闭后重新打开（面板状态随卸载重置）
    await user.click(closeButtons()[0]);
    expect(screen.queryByRole('heading', BATCH_HEADING)).not.toBeInTheDocument();
    await openBatchPanel(user);

    expect(scopeButton(/仅未分析 0 条/)).toBeInTheDocument();
    expect(scopeButton(/全部对话 2 条/)).toBeInTheDocument();
    const start = startButton();
    expect(start).toHaveTextContent('开始分析 0 条');
    expect(start).toBeDisabled();
  });
});

// -------------------- C. 成功流程 --------------------

describe('C. 成功流程（mock DeepSeek 成功）', () => {
  it('开始批量分析 → 面板显示「分析完成：成功 2 条」，001/002 的 aiLabels/aiReason/aiAt 写入 localStorage', async () => {
    const { user, fetchMock } = await setupWithKey();

    await openBatchPanel(user);
    await user.click(startButton());

    expect(await screen.findByText('分析完成：成功 2 条')).toBeInTheDocument();

    // 每条对话一次 DeepSeek 请求，鉴权与模型参数正确
    const deepSeekCalls = getDeepSeekCalls(fetchMock);
    expect(deepSeekCalls).toHaveLength(2);
    const prompts = deepSeekCalls.map(([, options]) => {
      expect(options.headers.Authorization).toBe('Bearer sk-test');
      const body = JSON.parse(options.body);
      expect(body.model).toBe('deepseek-chat');
      return body.messages[1].content;
    });
    expect(prompts.some((prompt) => prompt.includes(USER_001))).toBe(true);
    expect(prompts.some((prompt) => prompt.includes(USER_002))).toBe(true);

    await waitFor(() => {
      const stored = readAnnotations();
      ['001', '002'].forEach((id) => {
        expect(stored[id].aiLabels).toEqual(['accurate']);
        expect(stored[id].aiReason).toBe('回复准确，符合政策');
        expect(stored[id].aiAt).toBeTruthy();
      });
    });

    // BUG-15：批量完成提示不再被自动保存覆盖；BUG-14：纯 AI 建议不算人工审核
    await waitFor(() => expect(saveStatus()).toHaveTextContent('批量分析完成：2 条 AI 建议已保存'));
    expect(reviewedCard()).toHaveTextContent('0 / 2');
    expect(screen.getByText('AI 建议采纳率').parentElement).toHaveTextContent('0%');

    // 完成后面板两个「关闭」按钮恢复可用
    expect(closeButtons()).toHaveLength(2);
    closeButtons().forEach((button) => expect(button).toBeEnabled());
  });

  it('人工已标注（风险回复 / 4 分 / 人工结论）→ 批量成功只写 AI 字段，人工 labels/score/comment 保持不变', async () => {
    const { user } = await setupWithKey();

    await user.click(labelButton('风险回复'));
    await user.click(scoreButton('4 分'));
    await user.type(screen.getByPlaceholderText(/填写人工审核备注/), '人工结论');
    await waitFor(() => {
      const stored = readAnnotations()['001'];
      expect(stored.labels).toEqual(['risky']);
      expect(stored.score).toBe(4);
      expect(stored.comment).toBe('人工结论');
    });

    await openBatchPanel(user);
    // 人工标签已存在也不影响「仅未分析」候选（2 条）
    await user.click(startButton());
    await screen.findByText('分析完成：成功 2 条');

    await waitFor(() => {
      const stored = readAnnotations()['001'];
      // 人工结论不被覆盖
      expect(stored.labels).toEqual(['risky']);
      expect(stored.score).toBe(4);
      expect(stored.comment).toBe('人工结论');
      // AI 建议正常写入
      expect(stored.aiLabels).toEqual(['accurate']);
      expect(stored.aiReason).toBe('回复准确，符合政策');
      expect(stored.aiAt).toBeTruthy();
    });
  });

  it('批量结果写入后当前会话 AnalysisPanel 展示 AI 建议，切换下一条仍展示，页面不报错', async () => {
    const { user } = await setupWithKey();

    await openBatchPanel(user);
    await user.click(startButton());
    await screen.findByText('分析完成：成功 2 条');
    await user.click(closeButtons()[0]);

    const panelHeading = await screen.findByRole('heading', { name: '已得到 AI 建议' });
    expect(panelHeading).toBeInTheDocument();
    const panel = analysisSection('已得到 AI 建议');
    expect(within(panel).getByText('回复准确')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'AI 理由' }));
    expect(within(panel).getByText('回复准确，符合政策')).toBeInTheDocument();

    await user.click(actionButton('下一条'));
    // 顶部「当前对话 ID」卡片切换到 002；002 同样有 AI 建议，AnalysisPanel 仍为成功态
    await waitFor(() => expect(screen.getByText('当前对话 ID').parentElement).toHaveTextContent('002'));
    expect(screen.getByRole('heading', { name: '已得到 AI 建议' })).toBeInTheDocument();
  });
});

// -------------------- D. 失败隔离 --------------------

describe('D. 失败隔离', () => {
  it('DeepSeek 全部 401 → 面板「分析完成：成功 0 条 · 失败 2 条」、可查看 2 条失败原因，人工标注不被写入 AI 字段', async () => {
    const { user } = setupApp({ deepseekResponse: () => httpErrorResponse(401, 'unauthorized') });
    await waitForWorkbench();
    await importApiKey(user);

    // 先有人工标注，验证失败时 annotations 不被写脏
    await user.click(labelButton('风险回复'));
    await waitFor(() => expect(currentLabelBox()).toHaveTextContent('风险回复'));

    await openBatchPanel(user);
    await user.click(startButton());

    expect(await screen.findByText(/分析完成：成功 0 条 · 失败 2 条/)).toBeInTheDocument();
    expect(screen.getByText('查看 2 条失败原因')).toBeInTheDocument();
    await user.click(screen.getByText('查看 2 条失败原因'));
    expect(screen.getAllByText(/DeepSeek 请求失败：401 unauthorized/)).toHaveLength(2);

    await waitFor(() => {
      const stored = readAnnotations()['001'];
      expect(stored.labels).toEqual(['risky']);
      expect(stored.aiLabels).toEqual([]);
      expect(stored.aiReason).toBe('');
      expect(stored.aiAt).toBe('');
      expect(readAnnotations()['002']).toBeUndefined();
    });

    // 页面不崩溃，主工作台仍在
    expect(screen.getByRole('heading', { name: 'AI 质检分析平台' })).toBeInTheDocument();
  });

  it('部分失败（001 成功 / 002 返回 401）→ 计数闭合为成功 1 / 失败 1，仅成功项写入 AI 字段', async () => {
    const { user } = setupApp();
    await waitForWorkbench();
    const fetchMock = installDeepSeekFetchByPrompt();
    await importApiKey(user);

    await openBatchPanel(user);
    await user.click(startButton());

    expect(await screen.findByText(/分析完成：成功 1 条 · 失败 1 条/)).toBeInTheDocument();
    expect(getDeepSeekCalls(fetchMock)).toHaveLength(2);
    expect(screen.getByText('查看 1 条失败原因')).toBeInTheDocument();
    await user.click(screen.getByText('查看 1 条失败原因'));
    expect(screen.getAllByText(/DeepSeek 请求失败：401 unauthorized/)).toHaveLength(1);
    expect(screen.getByText(/#002：/)).toBeInTheDocument();

    await waitFor(() => {
      const stored = readAnnotations();
      // 成功项写入
      expect(stored['001'].aiLabels).toEqual(['accurate']);
      expect(stored['001'].aiReason).toBe('回复准确，符合政策');
      // 失败项不写入（002 没有人工标注，也不会因失败新增记录）
      expect(stored['002']).toBeUndefined();
    });
  });
});

// -------------------- E. 取消 --------------------

describe('E. 取消', () => {
  it('分析过程中点击「取消」→ 关闭按钮禁用；挂起请求返回后状态为「已取消：完成 1 条」，仅已发出项写入', async () => {
    let resolvePending;
    const pending = new Promise((resolve) => {
      resolvePending = resolve;
    });
    const { user, fetchMock } = setupApp({ deepseekResponse: () => pending });
    await waitForWorkbench();
    await importApiKey(user);

    await openBatchPanel(user);
    // 并发数设为 1：确保取消时只有 001 的请求已发出，002 尚未开始
    await user.selectOptions(screen.getByRole('combobox'), '1');
    await user.click(startButton());

    expect(await screen.findByText('正在分析：0 / 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
    expect(closeButtons().every((button) => button.disabled)).toBe(true);
    await waitFor(() => expect(getDeepSeekCalls(fetchMock)).toHaveLength(1));

    await user.click(screen.getByRole('button', { name: '取消' }));

    // 已发出的请求先返回（受控 Promise resolve），随后进入取消态
    await act(async () => {
      resolvePending(jsonResponse(DEEPSEEK_SUCCESS_BODY));
    });

    expect(await screen.findByText(/已取消：完成 1 条/)).toBeInTheDocument();
    // 取消后不再显示「取消」按钮，关闭按钮恢复可用
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
    expect(closeButtons().every((button) => !button.disabled)).toBe(true);

    await waitFor(() => {
      const stored = readAnnotations();
      // 已发出的 001 成功结果仍作为 AI 建议写入
      expect(stored['001'].aiLabels).toEqual(['accurate']);
      // 未发起的 002 不写入
      expect(stored['002']).toBeUndefined();
    });

    await user.click(closeButtons()[0]);
    expect(screen.queryByRole('heading', BATCH_HEADING)).not.toBeInTheDocument();
  });
});

// -------------------- F. 关闭与回归 --------------------

describe('F. 关闭与回归', () => {
  it('点击面板「关闭」按钮 → 面板关闭，主工作台仍可切换对话与打标签', async () => {
    const { user } = await setupWithKey();
    await openBatchPanel(user);

    await user.click(closeButtons()[0]);
    expect(screen.queryByRole('heading', BATCH_HEADING)).not.toBeInTheDocument();
    expect(screen.getByText(USER_001)).toBeInTheDocument();

    await user.click(actionButton('下一条'));
    expect(await screen.findByText(USER_002)).toBeInTheDocument();

    await user.click(labelButton('未解决问题'));
    expect(currentLabelBox()).toHaveTextContent('未解决问题');
    expect(reviewedCard()).toHaveTextContent('1 / 2');
  });

  it('按 Esc → 面板关闭且不触发 AI 分析，主工作台仍可用', async () => {
    const { user, fetchMock } = await setupWithKey();
    await openBatchPanel(user);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByRole('heading', BATCH_HEADING)).not.toBeInTheDocument();
    expect(getDeepSeekCalls(fetchMock)).toHaveLength(0);
    expect(screen.getByRole('heading', { name: 'AI 质检分析平台' })).toBeInTheDocument();
    expect(actionButton('下一条')).toBeEnabled();
  });

  it('切换范围后关闭再打开 → 恢复默认范围「仅未分析」与空闲状态', async () => {
    const { user } = await setupWithKey();
    await user.click(labelButton('风险回复'));
    await openBatchPanel(user);

    await user.click(scopeButton(/仅未审核/));
    expect(startButton()).toHaveTextContent('开始分析 1 条');

    // 关闭再打开：面板重新挂载，范围与进度重置
    await user.click(closeButtons()[1]);
    await openBatchPanel(user);

    expect(scopeButton(/仅未分析 2 条/)).toHaveClass('border-cyan-400');
    expect(startButton()).toHaveTextContent('开始分析 2 条');
    expect(screen.getByText('选择范围后开始批量分析')).toBeInTheDocument();
  });

  it('Ctrl+A 组合键 → 不误触发 AI 分析、不打开批量面板（沿用既有快捷键行为）', async () => {
    const { fetchMock } = await setupWithKey();

    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });

    expect(getDeepSeekCalls(fetchMock)).toHaveLength(0);
    expect(screen.queryByRole('heading', BATCH_HEADING)).not.toBeInTheDocument();
    expect(actionButton('切换深色模式')).toBeInTheDocument();
  });
});
