import { createHmac, timingSafeEqual } from 'crypto'
import type {
  IPaymentGateway,
  CreatePaymentUrlInput,
} from '../domain/IPaymentGateway'

export interface VNPayConfig {
  tmnCode: string
  hashSecret: string
  paymentUrl: string    // e.g. https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
  queryUrl: string      // e.g. https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
}

// Format date as yyyyMMddHHmmss in Vietnam timezone (UTC+7)
function vnpDate(d: Date = new Date()): string {
  const vn = new Date(d.getTime() + 7 * 3_600_000)
  return vn.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
}

// Build a URLSearchParams, sort it, and HMAC-SHA512-sign its query string.
function buildSignedParams(
  params: Record<string, string>,
  secret: string,
): URLSearchParams {
  const sp = new URLSearchParams(params)
  sp.sort()
  const signData = sp.toString()
  const hash = createHmac('sha512', secret).update(signData).digest('hex')
  sp.append('vnp_SecureHash', hash)
  return sp
}

export class VNPayGateway implements IPaymentGateway {
  constructor(private readonly config: VNPayConfig) {}

  async createPaymentUrl(input: CreatePaymentUrlInput): Promise<string> {
    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.config.tmnCode,
      vnp_Amount: String(input.amount * 100),
      vnp_CurrCode: 'VND',
      vnp_TxnRef: input.orderId,
      vnp_OrderInfo: input.description,
      vnp_Locale: 'vn',
      vnp_ReturnUrl: input.returnUrl,
      vnp_IpAddr: input.ipAddress,
      vnp_CreateDate: vnpDate(),
      vnp_OrderType: 'other',
    }

    const sp = buildSignedParams(params, this.config.hashSecret)
    return `${this.config.paymentUrl}?${sp.toString()}`
  }

  verifyCallback(params: Record<string, string>): boolean {
    const { vnp_SecureHash, ...rest } = params
    if (!vnp_SecureHash) return false

    const sp = new URLSearchParams(rest)
    sp.sort()
    const signData = sp.toString()
    const expected = createHmac('sha512', this.config.hashSecret)
      .update(signData)
      .digest('hex')

    try {
      const expBuf = Buffer.from(expected, 'hex')
      const recvBuf = Buffer.from(vnp_SecureHash.toLowerCase(), 'hex')
      if (expBuf.length !== recvBuf.length) return false
      return timingSafeEqual(expBuf, recvBuf)
    } catch {
      return false
    }
  }

  async queryStatus(txnRef: string): Promise<'SUCCESS' | 'FAILED' | 'PENDING'> {
    const now = vnpDate()
    const requestId = crypto.randomUUID().replace(/-/g, '').slice(0, 32)

    const params: Record<string, string> = {
      vnp_RequestId: requestId,
      vnp_Version: '2.1.0',
      vnp_Command: 'querydr',
      vnp_TmnCode: this.config.tmnCode,
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: 'Query transaction',
      vnp_TransDate: now,
      vnp_CreateDate: now,
      vnp_IpAddr: '127.0.0.1',
    }

    const sp = buildSignedParams(params, this.config.hashSecret)
    const body: Record<string, string> = {}
    sp.forEach((v, k) => { body[k] = v })

    const res = await fetch(this.config.queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`VNPAY query failed: HTTP ${res.status}`)

    const data = (await res.json()) as Record<string, string>
    const rc = data.vnp_ResponseCode
    const ts = data.vnp_TransactionStatus

    if (rc !== '00') return 'PENDING'            // not found yet
    if (ts === '00') return 'SUCCESS'
    if (ts === '01' || ts === '02') return 'PENDING'
    return 'FAILED'
  }
}
