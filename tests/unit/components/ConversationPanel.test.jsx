/**
 * ConversationPanel 组件单元测试
 * 覆盖：头部元信息（#id/进度/总数/轮次）、消息气泡逐条渲染、空 turns 兜底、conversation undefined 容错。
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConversationPanel from '../../../src/components/ConversationPanel';
import { makeConversation } from '../../helpers/file';

describe('ConversationPanel', () => {
  it('渲染 #id、当前第几条、总数与轮次统计', () => {
    const conversation = makeConversation('conv-42', {
      userContent: '请问什么时候发货？',
      assistantContent: '48 小时内发货'
    });

    render(<ConversationPanel conversation={conversation} currentIndex={2} totalCount={10} />);

    expect(screen.getByText('#conv-42')).toBeInTheDocument();
    expect(screen.getByText('第 3 条')).toBeInTheDocument();
    expect(screen.getByText('共 10 条')).toBeInTheDocument();
    expect(screen.getByText('2 轮消息')).toBeInTheDocument();
  });

  it('逐条渲染对话气泡：用户与客服文案都出现在页面中', () => {
    const conversation = makeConversation('conv-1', {
      userContent: '我要退款',
      assistantContent: '已为您登记退款'
    });

    render(<ConversationPanel conversation={conversation} currentIndex={0} totalCount={1} />);

    expect(screen.getByText('用户')).toBeInTheDocument();
    expect(screen.getByText('客服')).toBeInTheDocument();
    expect(screen.getByText('我要退款')).toBeInTheDocument();
    expect(screen.getByText('已为您登记退款')).toBeInTheDocument();
    expect(screen.getByText('消息 1')).toBeInTheDocument();
    expect(screen.getByText('消息 2')).toBeInTheDocument();
  });

  it('conversation.turns 为空数组时显示「暂无对话消息」与 0 轮消息', () => {
    render(<ConversationPanel conversation={{ id: 'conv-empty', turns: [] }} currentIndex={0} totalCount={0} />);

    expect(screen.getByText('暂无对话消息')).toBeInTheDocument();
    expect(screen.getByText('0 轮消息')).toBeInTheDocument();
    expect(screen.getByText('#conv-empty')).toBeInTheDocument();
  });

  it('conversation.turns 缺失时显示「暂无对话消息」', () => {
    render(<ConversationPanel conversation={{ id: 'conv-no-turns' }} currentIndex={0} totalCount={0} />);

    expect(screen.getByText('暂无对话消息')).toBeInTheDocument();
    expect(screen.getByText('0 轮消息')).toBeInTheDocument();
  });

  it('conversation 为 undefined 时不崩溃，并显示占位 #-', () => {
    expect(() =>
      render(<ConversationPanel conversation={undefined} currentIndex={0} totalCount={0} />)
    ).not.toThrow();

    expect(screen.getByText('#-')).toBeInTheDocument();
    expect(screen.getByText('第 1 条')).toBeInTheDocument();
    expect(screen.getByText('共 0 条')).toBeInTheDocument();
    expect(screen.getByText('暂无对话消息')).toBeInTheDocument();
  });

  it('conversation 缺少 id 时：显示占位 #- 且仍渲染消息气泡', () => {
    render(
      <ConversationPanel
        conversation={{ turns: makeConversation('conv-temp').turns }}
        currentIndex={0}
        totalCount={1}
      />
    );

    expect(screen.getByText('#-')).toBeInTheDocument();
    expect(screen.getByText('用户问题')).toBeInTheDocument();
    expect(screen.getByText('客服回复')).toBeInTheDocument();
  });
});
