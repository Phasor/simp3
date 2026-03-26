import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock modules before importing the handler
const mockGetUser = vi.fn();
const mockAdminFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockAdminFrom,
  })),
}));

// Stub env vars
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

import { GET } from '@/app/api/chat/messages/[creatorId]/[fanId]/route';

function makeRequest(creatorId: string, fanId: string, query = '') {
  return new Request(`http://localhost/api/chat/messages/${creatorId}/${fanId}${query}`);
}

function makeParams(creatorId: string, fanId: string) {
  return { params: Promise.resolve({ creatorId, fanId }) };
}

const CREATOR_ID = '11111111-1111-1111-1111-111111111111';
const FAN_ID = '22222222-2222-2222-2222-222222222222';

function setupAdminChain(profileData: unknown, messagesData: unknown) {
  const profileChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: profileData, error: null }),
  };
  const messagesChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    then: undefined as unknown,
  };
  // Make it resolve as a promise
  const messagesPromise = Promise.resolve({ data: messagesData, error: null });
  Object.assign(messagesChain, messagesPromise);
  // Override then so await works
  messagesChain.then = messagesPromise.then.bind(messagesPromise);

  let callCount = 0;
  mockAdminFrom.mockImplementation(() => {
    callCount++;
    return callCount === 1 ? profileChain : messagesChain;
  });
}

describe('GET /api/chat/messages/[creatorId]/[fanId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when getUser fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } });

    const response = await GET(
      makeRequest(CREATOR_ID, FAN_ID),
      makeParams(CREATOR_ID, FAN_ID)
    );
    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid UUID format', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null });

    const response = await GET(
      makeRequest('not-a-uuid', FAN_ID),
      makeParams('not-a-uuid', FAN_ID)
    );
    expect(response.status).toBe(400);
  });

  it('returns 403 when user is not a participant', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null });
    setupAdminChain(
      { id: '33333333-3333-3333-3333-333333333333', user_type: 'FAN' }, // not a participant
      []
    );

    const response = await GET(
      makeRequest(CREATOR_ID, FAN_ID),
      makeParams(CREATOR_ID, FAN_ID)
    );
    expect(response.status).toBe(403);
  });

  it('uses admin client for message queries (bypasses RLS)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null });
    setupAdminChain(
      { id: CREATOR_ID, user_type: 'CREATOR' },
      [
        { id: 'msg-1', creator_id: CREATOR_ID, fan_id: FAN_ID, sender_id: CREATOR_ID, content: 'Hello', created_at: '2026-01-01T00:00:00Z' },
      ]
    );

    const response = await GET(
      makeRequest(CREATOR_ID, FAN_ID),
      makeParams(CREATOR_ID, FAN_ID)
    );
    expect(response.status).toBe(200);

    // Verify admin client (from @supabase/supabase-js) was used for queries
    expect(mockAdminFrom).toHaveBeenCalled();
  });

  it('returns messages in chronological order', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null });
    const msgs = [
      { id: 'msg-2', created_at: '2026-01-02T00:00:00Z', content: 'Second' },
      { id: 'msg-1', created_at: '2026-01-01T00:00:00Z', content: 'First' },
    ];
    setupAdminChain({ id: CREATOR_ID, user_type: 'CREATOR' }, msgs);

    const response = await GET(
      makeRequest(CREATOR_ID, FAN_ID),
      makeParams(CREATOR_ID, FAN_ID)
    );
    const json = await response.json();

    // Messages should be reversed (oldest first)
    expect(json.messages[0].id).toBe('msg-1');
    expect(json.messages[1].id).toBe('msg-2');
  });
});
