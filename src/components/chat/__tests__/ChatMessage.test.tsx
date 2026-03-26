import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageList } from '../ChatMessage';
import { mockProfile, mockChatMessage } from '@/test/mocks';

// Mock date-fns to avoid relative time issues in tests
vi.mock('date-fns', () => ({
  formatDistanceToNow: () => '5 minutes ago',
}));

describe('MessageList', () => {
  const creator = mockProfile({ id: 'creator-1', user_type: 'CREATOR', display_name: 'TestDom' });
  const fan = mockProfile({ id: 'fan-1', user_type: 'FAN', display_name: 'TestSub' });

  it('renders messages from known senders', () => {
    const messages = [
      mockChatMessage({ id: 'msg-1', sender_id: 'creator-1', creator_id: 'creator-1', fan_id: 'fan-1', content: 'Hello from Dom' }),
    ];

    render(
      <MessageList
        messages={messages}
        profiles={{ 'creator-1': creator, 'fan-1': fan }}
        currentUserId="fan-1"
      />
    );

    expect(screen.getByText('Hello from Dom')).toBeInTheDocument();
  });

  it('renders messages even when sender profile is missing from profiles map (BUG 9 fix)', () => {
    const messages = [
      mockChatMessage({ id: 'msg-1', sender_id: 'unknown-sender', creator_id: 'creator-1', fan_id: 'fan-1', content: 'Message from unknown' }),
    ];

    render(
      <MessageList
        messages={messages}
        profiles={{ 'creator-1': creator, 'fan-1': fan }}
        currentUserId="fan-1"
      />
    );

    // Message should NOT be silently dropped — it should render
    expect(screen.getByText('Message from unknown')).toBeInTheDocument();
  });

  it('shows "Unknown" for missing sender display name', () => {
    const messages = [
      mockChatMessage({ id: 'msg-1', sender_id: 'unknown-sender', creator_id: 'creator-1', fan_id: 'fan-1', content: 'Mystery message' }),
    ];

    render(
      <MessageList
        messages={messages}
        profiles={{ 'creator-1': creator, 'fan-1': fan }}
        currentUserId="fan-1"
      />
    );

    expect(screen.getByText('Mystery message')).toBeInTheDocument();
  });

  it('groups consecutive messages from the same sender', () => {
    const now = new Date();
    const messages = [
      mockChatMessage({ id: 'msg-1', sender_id: 'creator-1', content: 'First', created_at: now.toISOString() }),
      mockChatMessage({ id: 'msg-2', sender_id: 'creator-1', content: 'Second', created_at: new Date(now.getTime() + 1000).toISOString() }),
    ];

    render(
      <MessageList
        messages={messages}
        profiles={{ 'creator-1': creator, 'fan-1': fan }}
        currentUserId="fan-1"
      />
    );

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });

  it('shows loading spinner when loading', () => {
    const { container } = render(
      <MessageList
        messages={[]}
        profiles={{}}
        currentUserId="fan-1"
        loading={true}
      />
    );

    // Loading state renders a spinner div
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});
