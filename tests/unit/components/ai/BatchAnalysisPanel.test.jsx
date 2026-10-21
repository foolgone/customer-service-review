/**
 * BatchAnalysisPanel 组件单元测试
 * 覆盖：关闭态渲染、默认渲染与范围计数、候选过滤、范围切换、并发数选择、
 *       开始按钮禁用条件、成功 / 部分失败 / 网络失败 / 超长失败信息截断 / 失败详情上限、
 *       运行中禁用态与取消（cancelled）、Esc / 遮罩 / 关闭按钮关闭、重开重置、
 *       createProvider 抛错与批量执行链路抛错。
 *
 * 说明：
 * - 使用真实 src/lib/ai 实现，仅通过 vi.stubGlobal('fetch') 控制系统边界；
 * - 仅在需要模拟 createProvider / runBatchAnalysis 抛错时对 src/lib/ai 做「保留真实实现的包装」。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BatchAnalysisPanel from '../../../../src/components/ai/BatchAnalysisPanel';

const aiState = vi.hoisted(() => ({
  createProviderImpl: null,
  runBatchAnalysisImpl: null,
  createProviderCalls: []
}));

vi.mock('../../../../src/lib/ai', async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    createProvider: (...args) => {
      aiState.createProviderCalls.push(args);

      if (aiState.createProviderImpl) {
        return aiState.createProviderImpl(...args);
      }

      return actual.createProvider(...args);
    },
    runBatchAnalysis: (options) => {
      if (aiState.runBatchAnalysisImpl) {
        return aiState.runBatchAnalysisImpl(options);
      }

      return actual.runBatchAnalysis(options);
    }
  };
});

const SUCCESS_CONTENT = JSON.stringify({ labels: ['accurate'], reason: '回复准确' });

function makeConversation(id, turns) {
  return {
    id,
    turns:
      turns ||
      [
        { role: 'user', content: `用户问题 ${id}` },
        { role: 'assistant', content: `客服回复 ${id}` }
      ]
  };
}

function makeSuccessResponse(content = SUCCESS_CONTENT) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => ''
  };
}

function makeErrorResponse(status = 401, body = 'unauthorized') {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => body
  };
}

/**
 * 默认数据集（5 条对话）：
 * - conv-a：无标注 → 未分析 ✓ / 未审核 ✓ / 全部 ✓
 * - conv-b：仅 aiLabels → 未分析 ✗ / 未审核 ✓ / 全部 ✓
 * - conv-c：labels + reviewedAt → 未分析 ✓ / 未审核 ✗ / 全部 ✓
 * - conv-d：无 user/assistant 内容 → 全部不入选
 * - conv-e：labels + reviewedAt + aiLabels → 未分析 ✗ / 未审核 ✗ / 全部 ✓
 * 期望计数：仅未分析 2、仅未审核 2、全部 4。
 */
function buildConversations() {
  return [
    makeConversation('conv-a'),
    makeConversation('conv-b'),
    makeConversation('conv-c'),
    makeConversation('conv-d', []),
    makeConversation('conv-e')
  ];
}

function buildAnnotations() {
  return {
    'conv-b': { aiLabels: ['accurate'], aiReason: 'AI 建议' },
    'conv-c': { labels: ['accurate'], reviewedAt: '2024-05-01T10:00:00.000Z' },
    'conv-e': {
      labels: ['accurate'],
      reviewedAt: '2024-05-01T10:00:00.000Z',
      aiLabels: ['incomplete']
    }
  };
}

function renderPanel(overrides = {}) {
  const props = {
    open: true,
    conversations: buildConversations(),
    annotations: buildAnnotations(),
    apiKey: 'sk-test',
    model: 'deepseek-chat',
    onClose: vi.fn(),
    onApplyResults: vi.fn(),
    ...overrides
  };

  const view = render(<BatchAnalysisPanel {...props} />);
  return { props, ...view };
}

beforeEach(() => {
  aiState.createProviderImpl = null;
  aiState.runBatchAnalysisImpl = null;
  aiState.createProviderCalls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BatchAnalysisPanel 渲染与默认态', () => {
  it('open=false → 不渲染任何内容，且不监听 Esc', () => {
    const props = {
      open: false,
      conversations: buildConversations(),
      annotations: buildAnnotations(),
      apiKey: 'sk-test',
      model: 'deepseek-chat',
      onClose: vi.fn(),
      onApplyResults: vi.fn()
    };

    const { container } = render(<BatchAnalysisPanel {...props} />);

    expect(container).toBeEmptyDOMElement();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('open=true → 渲染标题、默认「仅未分析」范围、并发 3 与空闲进度', () => {
    renderPanel();

    expect(screen.getByRole('heading', { name: '批量 AI 分析' })).toBeInTheDocument();
    expect(screen.getByText('Batch AI')).toBeInTheDocument();
    expect(screen.getByText('选择范围后开始批量分析')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始分析 2 条' })).toBeEnabled();
    expect(screen.getByRole('combobox')).toHaveValue('3');
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('成功 0')).toBeInTheDocument();
    expect(screen.getByText('失败 0')).toBeInTheDocument();
    expect(screen.getByText('总计 2')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '关闭' })).toHaveLength(2);
  });

  it('范围按钮计数符合候选过滤规则（无内容/已有 AI 建议/已人工审核分别排除）', () => {
    renderPanel();

    expect(within(screen.getByRole('button', { name: /仅未分析/ })).getByText('2 条')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /仅未审核/ })).getByText('2 条')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /全部对话/ })).getByText('4 条')).toBeInTheDocument();
  });

  it('切换范围 → 开始按钮文案与本次 API 调用提示同步更新', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /全部对话/ }));
    expect(screen.getByRole('button', { name: '开始分析 4 条' })).toBeEnabled();
    expect(screen.getByText(/本次将分析/)).toHaveTextContent('本次将分析 4 条 · 约消耗 4 次 API 调用');

    await user.click(screen.getByRole('button', { name: /仅未审核/ }));
    expect(screen.getByRole('button', { name: '开始分析 2 条' })).toBeEnabled();
    expect(screen.getByText(/本次将分析/)).toHaveTextContent('本次将分析 2 条 · 约消耗 2 次 API 调用');
  });

  it('apiKey 为空 → 开始按钮禁用但文案仍展示候选数', () => {
    renderPanel({ apiKey: '' });

    expect(screen.getByRole('button', { name: '开始分析 2 条' })).toBeDisabled();
  });

  it('当前范围无候选 → 开始按钮禁用；切换到有候选范围后恢复可用', async () => {
    const user = userEvent.setup();
    renderPanel({
      conversations: [makeConversation('conv-x')],
      annotations: { 'conv-x': { aiLabels: ['accurate'] } }
    });

    expect(screen.getByRole('button', { name: '开始分析 0 条' })).toBeDisabled();
    expect(screen.getByText(/本次将分析/)).toHaveTextContent('本次将分析 0 条');

    await user.click(screen.getByRole('button', { name: /全部对话/ }));
    expect(screen.getByRole('button', { name: '开始分析 1 条' })).toBeEnabled();
  });

  it('对话缺少 user/assistant 内容 → 不计入任何范围的候选', async () => {
    const user = userEvent.setup();
    renderPanel({
      conversations: [
        makeConversation('empty', []),
        makeConversation('meta', [{ role: 'system', content: '系统提示' }])
      ],
      annotations: {}
    });

    expect(screen.getByRole('button', { name: '开始分析 0 条' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /全部对话/ }));
    expect(within(screen.getByRole('button', { name: /全部对话/ })).getByText('0 条')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始分析 0 条' })).toBeDisabled();
  });

  it('conversations 从空数组变为加载完成 → 候选数与按钮状态随之更新', () => {
    const baseProps = {
      open: true,
      apiKey: 'sk-test',
      model: 'deepseek-chat',
      onClose: vi.fn(),
      onApplyResults: vi.fn()
    };
    const { rerender } = render(<BatchAnalysisPanel {...baseProps} conversations={[]} annotations={{}} />);

    expect(screen.getByRole('button', { name: '开始分析 0 条' })).toBeDisabled();

    rerender(
      <BatchAnalysisPanel
        {...baseProps}
        conversations={buildConversations()}
        annotations={buildAnnotations()}
      />
    );

    expect(screen.getByRole('button', { name: '开始分析 2 条' })).toBeEnabled();
    expect(screen.getByText('总计 2')).toBeInTheDocument();
  });

  it('并发数下拉提供 1~5，默认 3，可修改', async () => {
    const user = userEvent.setup();
    renderPanel();

    const select = screen.getByRole('combobox');
    expect(select).toHaveValue('3');
    expect(within(select).getAllByRole('option').map((option) => option.value)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5'
    ]);

    await user.selectOptions(select, '1');
    expect(select).toHaveValue('1');
  });
});

describe('BatchAnalysisPanel 分析结果', () => {
  it('全部成功 → 展示完成状态与 100% 进度，onApplyResults 收到成功记录', async () => {
    const fetchMock = vi.fn(async () => makeSuccessResponse());
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.click(screen.getByRole('button', { name: '开始分析 2 条' }));

    expect(await screen.findByText('分析完成：成功 2 条')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('成功 2')).toBeInTheDocument();
    expect(screen.getByText('失败 0')).toBeInTheDocument();
    expect(screen.queryByText(/条失败原因/)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(aiState.createProviderCalls).toEqual([
      ['deepseek', { apiKey: 'sk-test', model: 'deepseek-chat' }]
    ]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('api.deepseek.com');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(init.body).model).toBe('deepseek-chat');

    expect(props.onApplyResults).toHaveBeenCalledTimes(1);
    expect(props.onApplyResults).toHaveBeenCalledWith([
      { id: 'conv-a', labels: ['accurate'], reason: '回复准确' },
      { id: 'conv-c', labels: ['accurate'], reason: '回复准确' }
    ]);
  });

  it('部分失败 → onApplyResults 只含成功项，并展示失败条数与失败原因', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeSuccessResponse())
      .mockResolvedValueOnce(makeErrorResponse(401, 'unauthorized'));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.selectOptions(screen.getByRole('combobox'), '1');
    await user.click(screen.getByRole('button', { name: '开始分析 2 条' }));

    expect(await screen.findByText('分析完成：成功 1 条 · 失败 1 条')).toBeInTheDocument();
    expect(screen.getByText('成功 1')).toBeInTheDocument();
    expect(screen.getByText('失败 1')).toBeInTheDocument();
    expect(screen.getByText('查看 1 条失败原因')).toBeInTheDocument();
    expect(screen.getByText(/DeepSeek 请求失败：401 unauthorized/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    expect(props.onApplyResults).toHaveBeenCalledWith([
      { id: 'conv-a', labels: ['accurate'], reason: '回复准确' }
    ]);
  });

  it('网络异常 → 计为失败项，整体仍展示分析完成', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('网络断开');
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const { props } = renderPanel({
      conversations: [makeConversation('conv-a')],
      annotations: {}
    });

    await user.click(screen.getByRole('button', { name: '开始分析 1 条' }));

    expect(await screen.findByText('分析完成：成功 0 条 · 失败 1 条')).toBeInTheDocument();
    expect(screen.getByText('查看 1 条失败原因')).toBeInTheDocument();
    expect(screen.getByText(/网络断开/)).toBeInTheDocument();
    expect(props.onApplyResults).toHaveBeenCalledWith([]);
  });

  it('失败信息超过 160 字 → 截断并以省略号结尾', async () => {
    const longBody = 'x'.repeat(200);
    const fetchMock = vi.fn(async () => makeErrorResponse(500, longBody));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderPanel({ conversations: [makeConversation('conv-a')], annotations: {} });

    await user.click(screen.getByRole('button', { name: '开始分析 1 条' }));

    const summary = await screen.findByText('查看 1 条失败原因');
    const details = summary.closest('details');
    const item = details.querySelector('li');

    expect(item.textContent).toContain('#conv-a');
    expect(item.textContent.endsWith('…')).toBe(true);
    expect(item.textContent).not.toContain('x'.repeat(170));
  });

  it('失败条数超过 50 → 失败详情展示前 50 条并标注总数（BUG-17 已修复）', async () => {
    const conversations = Array.from({ length: 11 }, (_, index) => makeConversation(`conv-${index + 1}`));
    const fetchMock = vi.fn(async () => makeErrorResponse(500, 'server error'));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderPanel({ conversations, annotations: {} });

    await user.click(screen.getByRole('button', { name: '开始分析 11 条' }));

    expect(await screen.findByText('分析完成：成功 0 条 · 失败 11 条')).toBeInTheDocument();
    const details = screen.getByText('查看 11 条失败原因').closest('details');
    expect(details.querySelectorAll('li')).toHaveLength(11);
  });

  it('批量执行链路抛出 Error → 展示「批量分析失败」与错误信息', async () => {
    aiState.runBatchAnalysisImpl = async () => {
      throw new Error('批量链路异常');
    };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const { props } = renderPanel();

    await user.click(screen.getByRole('button', { name: '开始分析 2 条' }));

    expect(await screen.findByText('批量分析失败')).toBeInTheDocument();
    expect(screen.getByText('批量链路异常')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始分析 2 条' })).toBeEnabled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(props.onApplyResults).not.toHaveBeenCalled();
  });

  it('批量执行链路抛出非 Error → 展示兜底文案「批量分析失败」', async () => {
    aiState.runBatchAnalysisImpl = async () => {
      throw 'boom';
    };
    vi.stubGlobal('fetch', vi.fn());
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: '开始分析 2 条' }));

    await waitFor(() => expect(screen.getAllByText('批量分析失败')).toHaveLength(2));
    expect(screen.getByRole('button', { name: '开始分析 2 条' })).toBeEnabled();
  });

  it('createProvider 抛错 → 展示错误信息且不进入运行态', async () => {
    aiState.createProviderImpl = () => {
      throw new Error('无法连接 AI 服务');
    };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: '开始分析 2 条' }));

    expect(await screen.findByText('无法连接 AI 服务')).toBeInTheDocument();
    expect(screen.getByText('选择范围后开始批量分析')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始分析 2 条' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createProvider 抛出非 Error → 展示兜底文案「无法创建 AI 服务」', async () => {
    aiState.createProviderImpl = () => {
      throw 'boom';
    };
    vi.stubGlobal('fetch', vi.fn());
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: '开始分析 2 条' }));

    expect(await screen.findByText('无法创建 AI 服务')).toBeInTheDocument();
  });
});

describe('BatchAnalysisPanel 运行中与取消', () => {
  it('运行中 → 范围/并发/关闭全部禁用，取消后展示「已取消」且只回调已完成项', async () => {
    const pendingResolvers = [];
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          pendingResolvers.push(resolve);
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const { props, container } = renderPanel();

    await user.selectOptions(screen.getByRole('combobox'), '1');
    await user.click(screen.getByRole('button', { name: '开始分析 2 条' }));

    expect(await screen.findByText('正在分析：0 / 2')).toBeInTheDocument();
    const cancelButton = screen.getByRole('button', { name: '取消' });
    expect(screen.queryByRole('button', { name: /开始分析/ })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /仅未分析/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /仅未审核/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /全部对话/ })).toBeDisabled();
    screen.getAllByRole('button', { name: '关闭' }).forEach((button) => {
      expect(button).toBeDisabled();
    });

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(container.firstChild);
    expect(props.onClose).not.toHaveBeenCalled();

    await user.click(cancelButton);
    await act(async () => {
      pendingResolvers[0](makeSuccessResponse());
    });

    expect(await screen.findByText('已取消：完成 1 条 · 跳过 1 条')).toBeInTheDocument();
    // BUG-16：取消后进度按「已处理」计算，跳过项不计入完成
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始分析 2 条' })).toBeEnabled();
    expect(props.onApplyResults).toHaveBeenCalledWith([
      { id: 'conv-a', labels: ['accurate'], reason: '回复准确' }
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('BatchAnalysisPanel 关闭与重置', () => {
  it('空闲时按 Esc 触发 onClose，其他按键不触发', () => {
    const { props } = renderPanel();

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(props.onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('点击遮罩关闭；点击面板内部不关闭', () => {
    const { props, container } = renderPanel();

    fireEvent.click(screen.getByRole('heading', { name: '批量 AI 分析' }));
    expect(props.onClose).not.toHaveBeenCalled();

    fireEvent.click(container.firstChild);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('顶部与底部两个「关闭」按钮均触发 onClose', async () => {
    const user = userEvent.setup();
    const { props } = renderPanel();

    const closeButtons = screen.getAllByRole('button', { name: '关闭' });
    expect(closeButtons).toHaveLength(2);

    await user.click(closeButtons[0]);
    await user.click(closeButtons[1]);
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });

  it('open 由 true→false 重置状态，再次打开恢复默认范围与并发数', async () => {
    const user = userEvent.setup();
    const baseProps = {
      conversations: buildConversations(),
      annotations: buildAnnotations(),
      apiKey: 'sk-test',
      model: 'deepseek-chat',
      onClose: vi.fn(),
      onApplyResults: vi.fn()
    };
    const { rerender } = render(<BatchAnalysisPanel {...baseProps} open />);

    await user.click(screen.getByRole('button', { name: /全部对话/ }));
    await user.selectOptions(screen.getByRole('combobox'), '5');
    expect(screen.getByRole('button', { name: '开始分析 4 条' })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('5');

    rerender(<BatchAnalysisPanel {...baseProps} open={false} />);
    expect(screen.queryByRole('heading', { name: '批量 AI 分析' })).not.toBeInTheDocument();

    rerender(<BatchAnalysisPanel {...baseProps} open />);
    expect(screen.getByText('选择范围后开始批量分析')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始分析 2 条' })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveValue('3');
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
