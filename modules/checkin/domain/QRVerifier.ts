import { createHmac, timingSafeEqual } from 'crypto'

export class QRVerifier {
  static verify(code: string, signature: string, secret: string): boolean {
    const expected = createHmac('sha256', secret).update(code).digest('hex')
    try {
      return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))
    } catch {
      // timingSafeEqual throws if buffers have different lengths
      return false
    }
  }
}
