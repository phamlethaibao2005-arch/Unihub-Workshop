export interface CreatePaymentUrlInput {
  amount: number
  orderId: string       // payment.id used as vnp_TxnRef (globally unique)
  description: string
  returnUrl: string
  ipnUrl: string
  ipAddress: string
}

export interface IPaymentGateway {
  createPaymentUrl(input: CreatePaymentUrlInput): Promise<string>
  /** Verifies HMAC-SHA512 signature on the callback params. */
  verifyCallback(params: Record<string, string>): boolean
  queryStatus(txnRef: string): Promise<'SUCCESS' | 'FAILED' | 'PENDING'>
}
