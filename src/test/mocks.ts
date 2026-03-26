import { vi } from 'vitest';
import type { Profile, ChatMessage } from '@/lib/types/database';
import type { ChatAccessStatus } from '@/lib/utils/chatAccess';

/**
 * Create a mock Profile with sensible defaults
 */
export function mockProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'profile-001',
    auth_user_id: 'auth-001',
    email: 'test@example.com',
    created_at: '2026-01-01T00:00:00Z',
    user_type: 'FAN',
    onboarding_completed: true,
    display_name: 'Test User',
    profile_picture_url: null,
    banner_image_url: null,
    about_text: null,
    handle: null,
    wallet_address: null,
    age_verified: null,
    age_verified_at: null,
    tribute_alias: null,
    vip_cta_text: null,
    tagline: null,
    bio: null,
    kyc_status: null,
    ...overrides,
  };
}

/**
 * Create a mock ChatMessage with sensible defaults
 */
export function mockChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: `msg-${Date.now()}`,
    creator_id: 'creator-001',
    fan_id: 'fan-001',
    sender_id: 'fan-001',
    content: 'Hello!',
    created_at: new Date().toISOString(),
    is_locked: false,
    ppv_price_cents: null,
    media_id: null,
    comped_by_creator: null,
    ...overrides,
  };
}

/**
 * Create a mock ChatAccessStatus
 */
export function mockAccessStatus(overrides: Partial<ChatAccessStatus> = {}): ChatAccessStatus {
  return {
    hasAccess: true,
    accessUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    isExpired: false,
    timeRemaining: 30 * 24 * 60 * 60 * 1000,
    daysRemaining: 30,
    hoursRemaining: 0,
    minutesRemaining: 0,
    lastQualifyingPurchaseId: null,
    ...overrides,
  };
}

/**
 * Create a chainable mock Supabase query builder
 */
export function mockQueryBuilder(resolvedData: unknown = null, resolvedError: unknown = null) {
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'or',
    'order', 'limit', 'range', 'abortSignal',
  ];

  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }

  // Terminal methods
  builder.single = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError });
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: resolvedData, error: resolvedError });
  builder.then = vi.fn().mockImplementation((resolve) =>
    resolve({ data: Array.isArray(resolvedData) ? resolvedData : resolvedData ? [resolvedData] : [], error: resolvedError })
  );

  // Make the builder itself thenable (for queries without .single())
  const promise = Promise.resolve({ data: Array.isArray(resolvedData) ? resolvedData : resolvedData ? [resolvedData] : [], error: resolvedError });
  builder[Symbol.for('nodejs.util.inspect.custom')] = () => 'MockQueryBuilder';

  return Object.assign(promise, builder);
}

/**
 * Create a mock Supabase client
 */
export function mockSupabaseClient(queryData: unknown = null, queryError: unknown = null) {
  const client = {
    from: vi.fn().mockReturnValue(mockQueryBuilder(queryData, queryError)),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockImplementation((cb) => {
        if (cb) cb('SUBSCRIBED');
        return { unsubscribe: vi.fn() };
      }),
      track: vi.fn(),
      presenceState: vi.fn().mockReturnValue({}),
    }),
    removeChannel: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'auth-001' } }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'auth-001' } } }, error: null }),
    },
  };
  return client;
}
