import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetUser = vi.fn();
const mockAdminFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockAdminFrom,
  })),
}));

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');

import { POST } from '../../send/route';

const CREATOR_ID = '11111111-1111-1111-1111-111111111111';
const FAN_ID = '22222222-2222-2222-2222-222222222222';

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/chat/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/chat/send', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses getUser() for authentication (not getSession)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null });

    // Set up admin chain to return profile, conversation, and inserted message
    const chain = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    let callCount = 0;
    mockAdminFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Profile lookup
        chain.single.mockResolvedValueOnce({ data: { id: CREATOR_ID, user_type: 'CREATOR' }, error: null });
      } else if (callCount === 2) {
        // Conversation lookup
        chain.single.mockResolvedValueOnce({ data: { id: 'conv-1', creator_id: CREATOR_ID, fan_id: FAN_ID }, error: null });
      } else {
        // Message insert
        chain.single.mockResolvedValueOnce({ data: { id: 'msg-1', sender_id: CREATOR_ID, content: 'Hello' }, error: null });
      }
      return chain;
    });

    await POST(makeRequest({ creatorId: CREATOR_ID, fanId: FAN_ID, content: 'Hello' }));

    // Verify getUser was called (not getSession)
    expect(mockGetUser).toHaveBeenCalled();
  });

  it('returns 401 when getUser fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'expired' } });

    const response = await POST(
      makeRequest({ creatorId: CREATOR_ID, fanId: FAN_ID, content: 'Hello' })
    );
    expect(response.status).toBe(401);
  });

  it('returns 400 for missing required fields', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null });

    const response = await POST(
      makeRequest({ creatorId: CREATOR_ID, fanId: FAN_ID, content: '' })
    );
    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid UUID format', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-1' } }, error: null });

    const response = await POST(
      makeRequest({ creatorId: 'not-a-uuid', fanId: FAN_ID, content: 'Hello' })
    );
    expect(response.status).toBe(400);
  });
});
