import { createHash } from 'crypto'

/**
 * Generate a Bunny CDN token-authenticated URL.
 * Uses Bunny's standard token auth: SHA256(SecurityKey + URL_path + Expiry)
 * https://docs.bunny.net/docs/cdn-token-authentication
 *
 * Falls back to plain CDN URL if BUNNY_TOKEN_AUTH_KEY is not set.
 */
export function signBunnyUrl(cdnUrl: string, ttlSeconds = 300): string {
  const tokenKey = process.env.BUNNY_TOKEN_AUTH_KEY
  if (!tokenKey) {
    // No token auth configured — return plain URL
    // In production set BUNNY_TOKEN_AUTH_KEY to enable signed URLs
    return cdnUrl
  }

  const expiry = Math.floor(Date.now() / 1000) + ttlSeconds

  try {
    const url = new URL(cdnUrl)
    const path = url.pathname  // e.g. /wall-images/abc123.jpg

    // token = base64url( SHA256( key + path + expiry ) )
    const raw = createHash('sha256')
      .update(tokenKey + path + expiry)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')

    url.searchParams.set('token', raw)
    url.searchParams.set('expires', String(expiry))
    return url.toString()
  } catch {
    return cdnUrl
  }
}
