-- Phase 10: Privy embedded wallets + USDC payments
-- Add privy_wallet_id to profiles so we can execute server-side transactions

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS privy_wallet_id TEXT; -- Privy server wallet cluster ID (e.g. walletcluster_...)

-- Index for webhook lookups (wallet.created event)
CREATE INDEX IF NOT EXISTS idx_profiles_privy_wallet_id ON profiles(privy_wallet_id) WHERE privy_wallet_id IS NOT NULL;
