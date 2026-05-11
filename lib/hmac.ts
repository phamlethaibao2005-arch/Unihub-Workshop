// HMAC-SHA256 using Web Crypto API — works in both browser and Node.js 18+.
// Output is hex-encoded, compatible with server-side QRVerifier.verify().

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

export async function hmacHex(code: string, secret: string): Promise<string> {
  const key = await importKey(secret)
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(code))
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Constant-time comparison to avoid timing attacks.
export async function hmacVerify(code: string, signature: string, secret: string): Promise<boolean> {
  if (!signature) return false
  const expected = await hmacHex(code, secret)
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }
  return diff === 0
}
