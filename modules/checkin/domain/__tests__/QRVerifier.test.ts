import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { QRVerifier } from '../QRVerifier'

const SECRET = 'test-secret-32-bytes-hex-string!'
const CODE = 'UNIHUB-reg123-1700000000000'

function sign(code: string, secret: string): string {
  return createHmac('sha256', secret).update(code).digest('hex')
}

describe('QRVerifier.verify', () => {
  it('returns true for a valid signature', () => {
    const sig = sign(CODE, SECRET)
    expect(QRVerifier.verify(CODE, sig, SECRET)).toBe(true)
  })

  it('returns false when secret is wrong', () => {
    const sig = sign(CODE, SECRET)
    expect(QRVerifier.verify(CODE, sig, 'wrong-secret')).toBe(false)
  })

  it('returns false when code is tampered', () => {
    const sig = sign(CODE, SECRET)
    expect(QRVerifier.verify(CODE + 'x', sig, SECRET)).toBe(false)
  })

  it('returns false when signature is tampered', () => {
    const sig = sign(CODE, SECRET)
    const tampered = sig.slice(0, -2) + '00'
    expect(QRVerifier.verify(CODE, tampered, SECRET)).toBe(false)
  })

  it('returns false for an empty signature (different length)', () => {
    expect(QRVerifier.verify(CODE, '', SECRET)).toBe(false)
  })

  it('returns false for a non-hex signature', () => {
    expect(QRVerifier.verify(CODE, 'not-hex!!', SECRET)).toBe(false)
  })
})
