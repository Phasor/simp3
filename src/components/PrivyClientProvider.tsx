'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { base, baseSepolia } from 'viem/chains'

// Use Base Sepolia (testnet) when running locally, Base mainnet in production
const IS_DEV = process.env.NODE_ENV === 'development'

export default function PrivyClientProvider({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  // If no Privy app ID configured, skip the provider (development without Privy)
  if (!appId) {
    return <>{children}</>
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email'],
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
        },
        defaultChain: IS_DEV ? baseSepolia : base,
        supportedChains: [baseSepolia, base],
      }}
    >
      {children}
    </PrivyProvider>
  )
}
