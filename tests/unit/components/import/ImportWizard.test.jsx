/**
 * ImportWizard 组件单元测试
 * 覆盖：open=false 不渲染、三步向导文案、JSON/CSV/XLSX 解析进入预览、
 *       字段映射不完整提示与恢复、确认导入回调与 meta、上一步、关闭方式（按钮/Esc/遮罩）、
 *       文件校验失败与解析失败、无有效数据、解析中 loading。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ImportWizard from '../../../../src/components/import/ImportWizard';
import {
  createCsvFile,
  createFile,
  createJsonFile,
  createXlsxFile,
  JSON_MIME,
  makeConversation
} from '../../../helpers/file';

const TWO_CONVERSATIONS = [
  makeConversation('conv-1', { userContent: '用户问题一', assistantContent: '客服回复一' }),
  makeConversation('conv-2', { userContent: '用户问题二', assistantContent: '客服回复二' })
];

function renderWizard(overrides = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    onImport: vi.fn(),
    ...overrides
  };
  const view = render(<ImportWizard {...props} />);

  return {
    ...view,
    ...props,
    input: () => view.container.querySelector('input[type="file"]')
  };
}

async function uploadJsonToPreview(user, view) {
  const file = createJsonFile(TWO_CONVERSATIONS);
  await user.upload(view.input(), file);
  await screen.findByText('数据预览');
  return file;
}

describe('ImportWizard', () => {
  it('open=false → 不渲染任何内容', () => {
    const view = renderWizard({ open: false });

    expect(view.container).toBeEmptyDOMElement();
    expect(screen.queryByText('导入对话数据')).not.toBeInTheDocument();
  });

  it('open=true → 显示标题、三步步骤名与关闭 / 取消按钮', () => {
    renderWizard();

    expect(screen.getByText('导入对话数据')).toBeInTheDocument();
    expect(screen.getByText('选择文件')).toBeInTheDocument();
    expect(screen.getByText('预览与映射')).toBeInTheDocument();
    expect(screen.getByText('确认导入')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
    expect(screen.getByText('拖拽文件到此处，或点击选择文件')).toBeInTheDocument();
  });

  it('选择合法 JSON 文件 → 自动解析进入预览，有效对话统计为 2', async () => {
    const view = renderWizard();
    const user = userEvent.setup();

    await uploadJsonToPreview(user, view);

    expect(screen.getByText('数据预览')).toBeInTheDocument();
    expect(
      screen.queryByText('文件解析完成，但没有可用的对话数据，请检查字段映射。')
    ).not.toBeInTheDocument();

    const validLabel = screen.getByText('有效对话');
    expect(within(validLabel.parentElement).getByText('2')).toBeInTheDocument();
    expect(screen.getByText('用户问题一')).toBeInTheDocument();
    expect(screen.getByText('客服回复二')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled();
  });

  it('预览点「下一步」→ 确认页显示文件信息与「确认导入 2 条」', async () => {
    const view = renderWizard();
    const user = userEvent.setup();

    await uploadJsonToPreview(user, view);
    await user.click(screen.getByRole('button', { name: '下一步' }));

    expect(screen.getByText('conversations.json')).toBeInTheDocument();
    expect(screen.getByText('JSON')).toBeInTheDocument();
    expect(screen.getByText('2 条')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认导入 2 条' })).toBeInTheDocument();
  });

  it('点击「确认导入 2 条」→ onImport 收到 2 条对话与 meta，按钮变为「导入中...」禁用', async () => {
    const view = renderWizard();
    const user = userEvent.setup();

    await uploadJsonToPreview(user, view);
    await user.click(screen.getByRole('button', { name: '下一步' }));
    await user.click(screen.getByRole('button', { name: '确认导入 2 条' }));

    expect(view.onImport).toHaveBeenCalledTimes(1);

    const { conversations, meta } = view.onImport.mock.calls[0][0];
    expect(conversations).toHaveLength(2);
    expect(conversations.map((item) => item.id)).toEqual(['conv-1', 'conv-2']);
    expect(meta).toEqual({
      fileName: 'conversations.json',
      format: 'JSON',
      total: 2,
      valid: 2,
      invalid: 0
    });

    expect(screen.getByRole('button', { name: '导入中...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '关闭' })).toBeDisabled();
  });

  it('导入中按 Escape 或点击遮罩 → 不会关闭向导', async () => {
    const view = renderWizard();
    const user = userEvent.setup();

    await uploadJsonToPreview(user, view);
    await user.click(screen.getByRole('button', { name: '下一步' }));
    await user.click(screen.getByRole('button', { name: '确认导入 2 条' }));

    await user.keyboard('{Escape}');
    fireEvent.click(view.container.firstChild);

    expect(view.onClose).not.toHaveBeenCalled();
  });

  it('CSV 文件进入预览并显示字段映射；映射不完整提示且禁用下一步，恢复后可继续', async () => {
    const view = renderWizard();
    const user = userEvent.setup();
    const csv = createCsvFile('id,user,assistant\nc1,用户一,客服一\nc2,用户二,客服二\n');

    await user.upload(view.input(), csv);
    await screen.findByText('数据预览');

    expect(screen.getByText('字段映射')).toBeInTheDocument();
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(3);
    expect(selects[0]).toHaveValue('id');
    expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled();

    await user.selectOptions(screen.getAllByRole('combobox')[0], '');

    expect(
      screen.getByText('请完整选择对话 ID、用户消息、客服回复三个字段')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一步' })).toBeDisabled();

    await user.selectOptions(screen.getAllByRole('combobox')[0], 'id');

    expect(
      screen.queryByText('请完整选择对话 ID、用户消息、客服回复三个字段')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByRole('button', { name: '确认导入 2 条' })).toBeInTheDocument();
  });

  it('选择不支持的扩展名 .pdf → 提示「不支持的文件扩展名」且停留在上传步骤', async () => {
    const view = renderWizard();

    fireEvent.change(view.input(), {
      target: { files: [createFile('%PDF-1.4', 'report.pdf', 'application/pdf')] }
    });

    expect(await screen.findByText(/不支持的文件扩展名：\.pdf/)).toBeInTheDocument();
    expect(screen.getByText('拖拽文件到此处，或点击选择文件')).toBeInTheDocument();
    expect(screen.queryByText('数据预览')).not.toBeInTheDocument();
  });

  it('选择 .txt（validator 放行但解析器不支持）→ 停留在上传步骤并提示不支持的文件格式', async () => {
    const view = renderWizard();

    fireEvent.change(view.input(), {
      target: { files: [createFile('id,user,assistant\n1,你好,您好', 'data.txt', 'text/plain')] }
    });

    expect(await screen.findByText(/不支持的文件格式：\.txt/)).toBeInTheDocument();
    expect(screen.queryByText('数据预览')).not.toBeInTheDocument();
  });

  it('扩展名合法但内容损坏的 JSON → 显示 JSON 解析错误并停留在上传步骤', async () => {
    const view = renderWizard();
    const user = userEvent.setup();

    await user.upload(
      view.input(),
      createFile('{ "conversations": [', 'broken.json', JSON_MIME)
    );

    expect(await screen.findByText(/JSON 格式错误/)).toBeInTheDocument();
    expect(screen.getByText('拖拽文件到此处，或点击选择文件')).toBeInTheDocument();
    expect(screen.queryByText('数据预览')).not.toBeInTheDocument();
  });

  it('CSV 解析成功但无有效对话 → 进入预览并提示无可用数据，下一步禁用', async () => {
    const view = renderWizard();
    const user = userEvent.setup();
    const csv = createCsvFile('id,user,assistant\nc1,,客服一\nc2,,客服二\n');

    await user.upload(view.input(), csv);
    await screen.findByText('数据预览');

    expect(
      await screen.findByText(/文件解析完成，但没有可用的对话数据/)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一步' })).toBeDisabled();

    const validLabel = screen.getByText('有效对话');
    expect(within(validLabel.parentElement).getByText('0')).toBeInTheDocument();
    const droppedLabel = screen.getByText('缺必填字段');
    expect(within(droppedLabel.parentElement).getByText('2')).toBeInTheDocument();
  });

  it('预览点「上一步」回到上传步骤；确认步骤点「上一步」回到预览', async () => {
    const view = renderWizard();
    const user = userEvent.setup();
    const file = createJsonFile(TWO_CONVERSATIONS);

    await user.upload(view.input(), file);
    await screen.findByText('数据预览');

    await user.click(screen.getByRole('button', { name: '上一步' }));
    expect(screen.getByText('拖拽文件到此处，或点击选择文件')).toBeInTheDocument();
    expect(screen.queryByText('数据预览')).not.toBeInTheDocument();

    await user.upload(view.input(), file);
    await screen.findByText('数据预览');
    await user.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByRole('button', { name: '确认导入 2 条' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '上一步' }));
    expect(screen.getByText('数据预览')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '确认导入 2 条' })).not.toBeInTheDocument();
  });

  it('点击「关闭」→ 调用 onClose', async () => {
    const view = renderWizard();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '关闭' }));

    expect(view.onClose).toHaveBeenCalledTimes(1);
  });

  it('点击「取消」→ 调用 onClose', async () => {
    const view = renderWizard();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(view.onClose).toHaveBeenCalledTimes(1);
  });

  it('按 Escape 或点击遮罩空白处 → 调用 onClose；点击内容区不关闭', async () => {
    const view = renderWizard();
    const user = userEvent.setup();

    await user.keyboard('{Escape}');
    expect(view.onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(view.container.firstChild);
    expect(view.onClose).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByText('导入对话数据'));
    expect(view.onClose).toHaveBeenCalledTimes(2);
  });

  it('文件解析未完成时 → 显示「正在解析文件...」与「解析中...」，上传区禁用', async () => {
    const jsonFile = createJsonFile(TWO_CONVERSATIONS);
    let resolveText = () => {};
    const pending = new Promise((resolve) => {
      resolveText = resolve;
    });
    jsonFile.text = () => pending;

    const view = renderWizard();
    const user = userEvent.setup();

    await user.upload(view.input(), jsonFile);

    expect(screen.getByText('正在解析文件...')).toBeInTheDocument();
    expect(screen.getByText('解析中...')).toBeInTheDocument();
    expect(view.input()).toBeDisabled();
    expect(screen.queryByText('数据预览')).not.toBeInTheDocument();

    resolveText(JSON.stringify(TWO_CONVERSATIONS));
    await screen.findByText('数据预览');
  });

  it('选择合法 xlsx 文件 → 进入预览并显示字段映射，调整映射后重新解析成功', async () => {
    const view = renderWizard();
    const user = userEvent.setup();
    const xlsx = createXlsxFile([
      { id: 'x1', user: 'Excel 用户一', assistant: 'Excel 客服一' },
      { id: 'x2', user: 'Excel 用户二', assistant: 'Excel 客服二' }
    ]);

    await user.upload(view.input(), xlsx);
    await screen.findByText('数据预览');

    expect(screen.getByText('字段映射')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(3);

    await user.selectOptions(screen.getAllByRole('combobox')[0], '');
    expect(screen.getByRole('button', { name: '下一步' })).toBeDisabled();

    await user.selectOptions(screen.getAllByRole('combobox')[0], 'id');
    expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '下一步' }));
    expect(screen.getByText('Excel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认导入 2 条' })).toBeInTheDocument();
  });
});
