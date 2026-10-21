/**
 * LabelSelector 组件单元测试
 * 覆盖：6 个标签与快捷键渲染、点击回调 value、选中态激活样式。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LabelSelector from '../../../src/components/LabelSelector';
import { LABELS } from '../../../src/lib/constants';

describe('LabelSelector', () => {
  it('渲染 6 个标签按钮，包含全部中文标签与快捷键数字', () => {
    render(<LabelSelector selectedLabels={[]} onToggleLabel={vi.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(LABELS.length);
    expect(LABELS).toHaveLength(6);

    LABELS.forEach((item) => {
      expect(screen.getByRole('button', { name: new RegExp(item.label) })).toBeInTheDocument();
      expect(screen.getByText(item.shortcut)).toBeInTheDocument();
    });

    ['回复准确', '跑题', '编造信息', '态度差', '未解决问题', '风险回复'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('点击某个标签：回调收到对应的 value', async () => {
    const onToggleLabel = vi.fn();
    const user = userEvent.setup();
    render(<LabelSelector selectedLabels={[]} onToggleLabel={onToggleLabel} />);

    await user.click(screen.getByRole('button', { name: /跑题/ }));

    expect(onToggleLabel).toHaveBeenCalledTimes(1);
    expect(onToggleLabel).toHaveBeenCalledWith('off_topic');
  });

  it('点击每个标签都会回传对应的 value', async () => {
    const onToggleLabel = vi.fn();
    const user = userEvent.setup();
    render(<LabelSelector selectedLabels={[]} onToggleLabel={onToggleLabel} />);

    for (const item of LABELS) {
      // 避免「编造信息」等文本中包含的关键字冲突，用完整可见名称定位
      const button = screen
        .getAllByRole('button')
        .find((element) => element.getAttribute('type') === 'button' && element.textContent.includes(item.label));
      await user.click(button);
    }

    expect(onToggleLabel.mock.calls.map(([value]) => value)).toEqual(LABELS.map((item) => item.value));
  });

  it('selectedLabels 含某标签时：该按钮激活（ring-4 / bg-cyan-500/10），其余未激活', () => {
    render(<LabelSelector selectedLabels={['risky']} onToggleLabel={vi.fn()} />);

    const activeButton = screen.getByRole('button', { name: /风险回复/ });
    expect(activeButton).toHaveClass('ring-4');
    expect(activeButton).toHaveClass('bg-cyan-500/10');

    const inactiveButton = screen.getByRole('button', { name: /回复准确/ });
    expect(inactiveButton).not.toHaveClass('ring-4');
    expect(inactiveButton).not.toHaveClass('bg-cyan-500/10');

    const ringButtons = screen.getAllByRole('button').filter((button) => button.className.includes('ring-4'));
    expect(ringButtons).toHaveLength(1);
  });

  it('选中多个标签时：对应多个按钮同时激活', () => {
    render(<LabelSelector selectedLabels={['accurate', 'incomplete']} onToggleLabel={vi.fn()} />);

    const activeButtons = screen.getAllByRole('button').filter((button) => button.className.includes('ring-4'));
    expect(activeButtons).toHaveLength(2);
    expect(screen.getByRole('button', { name: /回复准确/ })).toHaveClass('ring-4');
    expect(screen.getByRole('button', { name: /未解决问题/ })).toHaveClass('ring-4');
  });
});
