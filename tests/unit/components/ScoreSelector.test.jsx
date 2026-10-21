/**
 * ScoreSelector 组件单元测试
 * 覆盖：当前评分文案、5 个评分按钮、点击回调数字 value、选中态激活样式。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScoreSelector from '../../../src/components/ScoreSelector';
import { SCORE_LEVELS } from '../../../src/lib/constants';

describe('ScoreSelector', () => {
  it('显示「当前评分：X 分」', () => {
    render(<ScoreSelector selectedScore={3} onChangeScore={vi.fn()} />);

    expect(screen.getByText('当前评分：3 分')).toBeInTheDocument();
  });

  it('渲染 5 个评分按钮（5 分…1 分）', () => {
    render(<ScoreSelector selectedScore={3} onChangeScore={vi.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(SCORE_LEVELS.length);
    expect(SCORE_LEVELS.map((level) => level.label)).toEqual(['5 分', '4 分', '3 分', '2 分', '1 分']);

    SCORE_LEVELS.forEach((level) => {
      expect(screen.getByRole('button', { name: new RegExp(level.label) })).toBeInTheDocument();
    });
  });

  it('点击某评分：回调收到对应的数字 value', async () => {
    const onChangeScore = vi.fn();
    const user = userEvent.setup();
    render(<ScoreSelector selectedScore={3} onChangeScore={onChangeScore} />);

    await user.click(screen.getByRole('button', { name: /4 分/ }));

    expect(onChangeScore).toHaveBeenCalledTimes(1);
    expect(onChangeScore).toHaveBeenCalledWith(4);
    expect(typeof onChangeScore.mock.calls[0][0]).toBe('number');
  });

  it('selectedScore 对应的按钮处于激活态（ring-4）', () => {
    render(<ScoreSelector selectedScore={4} onChangeScore={vi.fn()} />);

    expect(screen.getByRole('button', { name: /4 分/ })).toHaveClass('ring-4');
    expect(screen.getByRole('button', { name: /5 分/ })).not.toHaveClass('ring-4');

    const ringButtons = screen.getAllByRole('button').filter((button) => button.className.includes('ring-4'));
    expect(ringButtons).toHaveLength(1);
  });

  it('切换 selectedScore 后激活态随之转移', () => {
    const { rerender } = render(<ScoreSelector selectedScore={5} onChangeScore={vi.fn()} />);
    expect(screen.getByRole('button', { name: /5 分/ })).toHaveClass('ring-4');

    rerender(<ScoreSelector selectedScore={1} onChangeScore={vi.fn()} />);

    expect(screen.getByRole('button', { name: /1 分/ })).toHaveClass('ring-4');
    expect(screen.getByRole('button', { name: /5 分/ })).not.toHaveClass('ring-4');
    expect(screen.getByText('当前评分：1 分')).toBeInTheDocument();
  });
});
