/**
 * ChatBubble 组件单元测试
 * 覆盖：用户/客服角色文案、内容渲染、轮次与消息序号、空内容兜底。
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChatBubble from '../../../src/components/ChatBubble';

describe('ChatBubble', () => {
  it('用户消息：渲染「用户」标签、内容、第 1 轮 / 消息 1', () => {
    render(<ChatBubble turn={{ role: 'user', content: '请问什么时候发货？' }} index={0} turnIndex={0} />);

    expect(screen.getByText('用户')).toBeInTheDocument();
    expect(screen.getByText('请问什么时候发货？')).toBeInTheDocument();
    expect(screen.getByText('第 1 轮')).toBeInTheDocument();
    expect(screen.getByText('消息 1')).toBeInTheDocument();
    expect(screen.getByText('U')).toBeInTheDocument();
    expect(screen.queryByText('客服')).not.toBeInTheDocument();
  });

  it('客服消息：渲染「客服」标签与内容', () => {
    render(<ChatBubble turn={{ role: 'assistant', content: '预计 48 小时内发出' }} index={1} turnIndex={0} />);

    expect(screen.getByText('客服')).toBeInTheDocument();
    expect(screen.getByText('预计 48 小时内发出')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.queryByText('用户')).not.toBeInTheDocument();
  });

  it('按传入的 index / turnIndex 渲染序号', () => {
    render(<ChatBubble turn={{ role: 'user', content: '第三条消息' }} index={3} turnIndex={2} />);

    expect(screen.getByText('第 3 轮')).toBeInTheDocument();
    expect(screen.getByText('消息 4')).toBeInTheDocument();
  });

  it('content 为空字符串：显示「暂无内容」兜底', () => {
    render(<ChatBubble turn={{ role: 'assistant', content: '' }} index={0} turnIndex={0} />);

    expect(screen.getByText('暂无内容')).toBeInTheDocument();
  });

  it('content 缺失（undefined）：显示「暂无内容」兜底', () => {
    render(<ChatBubble turn={{ role: 'user' }} index={0} turnIndex={0} />);

    expect(screen.getByText('暂无内容')).toBeInTheDocument();
  });
});
