import { createHmac } from 'crypto'
import { ValueObject } from '@/shared/domain/ValueObject'

interface QRTicketProps {
  code: string
  signature: string
}

export class QRTicket extends ValueObject<QRTicketProps> {
  static issue(registrationId: string, secret: string): QRTicket {
    const ts = Date.now()
    const code = `UNIHUB-${registrationId}-${ts}`
    const signature = createHmac('sha256', secret).update(code).digest('hex')
    return new QRTicket({ code, signature })
  }

  get code() { return this.props.code }
  get signature() { return this.props.signature }
}
