import { createHmac } from 'node:crypto'
import { describe, it, expect } from 'vitest'
import { hmacHex, hmacVerify } from '../hmac'

function nodeHmac(code: string, secret: string): string {
  return createHmac('sha256', secret).update(code).digest('hex')
}

describe('hmacHex', () => {
  it('matches Node.js createHmac output', async () => {
    const code = 'UNIHUB-abc123-1715000000'
    const secret = 'test-secret-key'
    expect(await hmacHex(code, secret)).toBe(nodeHmac(code, secret))
  })

  it('produces different output for different secrets', async () => {
    const code = 'some-code'
    const a = await hmacHex(code, 'secret-a')
    const b = await hmacHex(code, 'secret-b')
    expect(a).not.toBe(b)
  })

  it('produces different output for different codes', async () => {
    const secret = 'shared-secret'
    const a = await hmacHex('code-a', secret)
    const b = await hmacHex('code-b', secret)
    expect(a).not.toBe(b)
  })

  it('output is 64 hex characters (SHA-256)', async () => {
    const result = await hmacHex('x', 'y')
    expect(result).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('hmacVerify', () => {
  it('returns true for a valid signature', async () => {
    const code = 'UNIHUB-reg1-1715000000'
    const secret = 'my-hmac-key'
    const sig = nodeHmac(code, secret)
    expect(await hmacVerify(code, sig, secret)).toBe(true)
  })

  it('returns false for a tampered code', async () => {
    const code = 'UNIHUB-reg1-1715000000'
    const secret = 'my-hmac-key'
    const sig = nodeHmac(code, secret)
    expect(await hmacVerify('UNIHUB-reg2-1715000000', sig, secret)).toBe(false)
  })

  it('returns false for a wrong secret', async () => {
    const code = 'UNIHUB-reg1-1715000000'
    const sig = nodeHmac(code, 'correct-secret')
    expect(await hmacVerify(code, sig, 'wrong-secret')).toBe(false)
  })

  it('returns false for an empty signature', async () => {
    expect(await hmacVerify('code', '', 'secret')).toBe(false)
  })

  it('returns false for a truncated signature', async () => {
    const code = 'code'
    const secret = 'secret'
    const sig = nodeHmac(code, secret).slice(0, 32)
    expect(await hmacVerify(code, sig, secret)).toBe(false)
  })
})
