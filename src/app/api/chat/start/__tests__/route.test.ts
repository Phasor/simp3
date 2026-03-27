import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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

import { POST } from '../../start/route';

const CREATOR_ID = '11111111-1111-1111-1111-111111111111';
const FAN_ID = '22222222-2222-2222-2222-222222222222';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/chat/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setupAdminCalls(...results: Array<{ data: unknown; error: unknown }>) {
  let callIdx = 0;
  mockAdminFrom.mockImplementation(() => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(results[callIdx] ?? { data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue(results[callIdx] ?? { data: null, error: null }),
    };
    callIdx++;
    return chain;
  });
}

describe('POST /api/chat/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'expired' } });

    const response = await POST(makeRequest({ domId: CREATOR_ID }));
    expect(response.status).toBe(401);
  });

  it('fan can start conversation with active VIP access', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-fan' } }, error: null });
    setupAdminCalls(
      { data: { id: FAN_ID, user_type: 'FAN' }, error: null },      // profile
      { data: { id: 'access-1' }, error: null },                      // chat_access
      { data: null, error: null },                                     // existing conversation (none)
      { data: { id: 'conv-1', creator_id: CREATOR_ID, fan_id: FAN_ID }, error: null }, // created
    );

    const response = await POST(makeRequest({ domId: CREATOR_ID }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.conversation).toBeDefined();
  });

  it('fan is rejected when no VIP access', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-fan' } }, error: null });
    setupAdminCalls(
      { data: { id: FAN_ID, user_type: 'FAN' }, error: null },
      { data: null, error: null },  // no access record
    );

    const response = await POST(makeRequest({ domId: CREATOR_ID }));
    expect(response.status).toBe(403);
  });

  it('creator can start conversation with fan who has active VIP access', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-creator' } }, error: null });
    setupAdminCalls(
      { data: { id: CREATOR_ID, user_type: 'CREATOR' }, error: null }, // profile (creator)
      { data: { id: 'access-1' }, error: null },                       // chat_access
      { data: null, error: null },                                      // existing conversation (none)
      { data: { id: 'conv-1', creator_id: CREATOR_ID, fan_id: FAN_ID }, error: null }, // created
    );

    const response = await POST(makeRequest({ domId: FAN_ID }));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.conversation).toBeDefined();
  });

  it('creator is rejected when fan has no VIP access', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-creator' } }, error: null });
    setupAdminCalls(
      { data: { id: CREATOR_ID, user_type: 'CREATOR' }, error: null },
      { data: null, error: null },  // no access record
    );

    const response = await POST(makeRequest({ domId: FAN_ID }));
    expect(response.status).toBe(403);
  });

  it('returns existing conversation if one already exists (idempotent)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'auth-fan' } }, error: null });
    const existingConv = { id: 'conv-existing', creator_id: CREATOR_ID, fan_id: FAN_ID };
    setupAdminCalls(
      { data: { id: FAN_ID, user_type: 'FAN' }, error: null },
      { data: { id: 'access-1' }, error: null },
      { data: existingConv, error: null },  // existing conversation found
    );

    const response = await POST(makeRequest({ domId: CREATOR_ID }));
    const json = await response.json();
    expect(json.conversation.id).toBe('conv-existing');
  });
});
