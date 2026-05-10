export interface IPaymentService {
  initiatePayment(
    registrationId: string,
    amount: number,
    idempotencyKey: string,
  ): Promise<{ paymentUrl: string }>
}
