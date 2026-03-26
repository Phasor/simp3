import { describe, it, expect } from 'vitest';
import {
  generateConversationId,
  isSameConversation,
  parseConversationId,
  isUserInConversation,
  getOtherParticipant,
} from '../conversationUtils';

describe('generateConversationId', () => {
  it('produces sorted underscore format', () => {
    expect(generateConversationId('bbb', 'aaa')).toBe('aaa_bbb');
  });

  it('is idempotent regardless of argument order', () => {
    const id1 = generateConversationId('creator-123', 'fan-456');
    const id2 = generateConversationId('fan-456', 'creator-123');
    expect(id1).toBe(id2);
  });

  it('uses underscore separator not pipe', () => {
    const id = generateConversationId('aaa', 'bbb');
    expect(id).not.toContain('|');
    expect(id).toContain('_');
  });
});

describe('parseConversationId', () => {
  it('round-trips with generateConversationId', () => {
    const id = generateConversationId('creator-1', 'fan-2');
    const parsed = parseConversationId(id);
    expect(parsed).not.toBeNull();
    // Both IDs should be present (order is sorted)
    expect([parsed!.creatorId, parsed!.fanId].sort()).toEqual(['creator-1', 'fan-2'].sort());
  });

  it('returns null for invalid format', () => {
    expect(parseConversationId('no-underscore')).toBeNull();
  });
});

describe('isSameConversation', () => {
  it('detects identical conversations regardless of order', () => {
    expect(isSameConversation('aaa', 'bbb', 'bbb', 'aaa')).toBe(true);
  });

  it('rejects different conversations', () => {
    expect(isSameConversation('aaa', 'bbb', 'aaa', 'ccc')).toBe(false);
  });
});

describe('isUserInConversation', () => {
  it('returns true for creator', () => {
    expect(isUserInConversation('creator-1', 'creator-1', 'fan-1')).toBe(true);
  });

  it('returns true for fan', () => {
    expect(isUserInConversation('fan-1', 'creator-1', 'fan-1')).toBe(true);
  });

  it('returns false for non-participant', () => {
    expect(isUserInConversation('other', 'creator-1', 'fan-1')).toBe(false);
  });
});

describe('getOtherParticipant', () => {
  it('returns fan when current user is creator', () => {
    expect(getOtherParticipant('creator-1', 'creator-1', 'fan-1')).toBe('fan-1');
  });

  it('returns creator when current user is fan', () => {
    expect(getOtherParticipant('fan-1', 'creator-1', 'fan-1')).toBe('creator-1');
  });

  it('returns null for non-participant', () => {
    expect(getOtherParticipant('other', 'creator-1', 'fan-1')).toBeNull();
  });
});
