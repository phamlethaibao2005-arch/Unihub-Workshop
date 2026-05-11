import { Resend } from 'resend'
import type { INotificationStrategy } from '../domain/INotificationStrategy'
import type { NotificationPayload } from '../domain/NotificationPayload'

const FROM = process.env.RESEND_FROM_EMAIL ?? 'UniHub Workshop <noreply@unihub.edu.vn>'

function buildHtml(payload: NotificationPayload): { subject: string; html: string } {
  switch (payload.type) {
    case 'REGISTRATION_CONFIRMED':
      return {
        subject: `Xác nhận đăng ký: ${payload.data.workshopTitle}`,
        html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#111">Đăng ký thành công!</h2>
  <p>Bạn đã đăng ký tham gia <strong>${payload.data.workshopTitle}</strong>.</p>
  <table style="border-collapse:collapse;width:100%">
    <tr><td style="padding:6px 0;color:#555">Ngày:</td><td>${payload.data.workshopDate}</td></tr>
    <tr><td style="padding:6px 0;color:#555">Phòng:</td><td>${payload.data.workshopRoom}</td></tr>
  </table>
  <p style="margin-top:24px">Mã QR của bạn (xuất trình khi check-in):</p>
  <img src="${payload.data.qrCodeDataUrl}" alt="QR Code" style="width:200px;height:200px" />
  <p style="margin-top:24px;color:#888;font-size:12px">UniHub Workshop — Đừng chia sẻ mã QR này.</p>
</div>`,
      }

    case 'PAYMENT_FAILED':
      return {
        subject: `Thanh toán thất bại: ${payload.data.workshopTitle}`,
        html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#d30005">Thanh toán không thành công</h2>
  <p>Thanh toán cho <strong>${payload.data.workshopTitle}</strong> (${payload.data.workshopDate}) đã thất bại.</p>
  ${payload.data.reason ? `<p>Lý do: ${payload.data.reason}</p>` : ''}
  <p>Vui lòng thử lại hoặc liên hệ BTC để được hỗ trợ.</p>
</div>`,
      }

    case 'WORKSHOP_CANCELLED':
      return {
        subject: `Workshop bị huỷ: ${payload.data.workshopTitle}`,
        html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#d30005">Workshop đã bị huỷ</h2>
  <p>Workshop <strong>${payload.data.workshopTitle}</strong> ngày ${payload.data.workshopDate} đã bị huỷ.</p>
  <p>Chúng tôi xin lỗi vì sự bất tiện này. Nếu bạn đã thanh toán, hoàn tiền sẽ được xử lý trong vòng 5–7 ngày làm việc.</p>
</div>`,
      }

    case 'WORKSHOP_UPDATED':
      return {
        subject: `Cập nhật workshop: ${payload.data.workshopTitle}`,
        html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#111">Workshop có thay đổi</h2>
  <p>Workshop <strong>${payload.data.workshopTitle}</strong> vừa được cập nhật.</p>
  <p>${payload.data.changes}</p>
</div>`,
      }

    case 'CHECKIN_REMINDER':
      return {
        subject: `Nhắc nhở: ${payload.data.workshopTitle} sắp bắt đầu`,
        html: `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#111">Workshop sắp bắt đầu!</h2>
  <p><strong>${payload.data.workshopTitle}</strong> sẽ bắt đầu trong 30 phút nữa.</p>
  <p>Địa điểm: ${payload.data.workshopRoom}</p>
  <p>Đừng quên mang theo mã QR của bạn.</p>
</div>`,
      }
  }
}

export class EmailNotificationStrategy implements INotificationStrategy {
  readonly channel = 'EMAIL' as const

  private readonly resend: Resend

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY)
  }

  async send(payload: NotificationPayload): Promise<void> {
    const { subject, html } = buildHtml(payload)
    const { error } = await this.resend.emails.send({
      from: FROM,
      to: payload.userEmail,
      subject,
      html,
    })
    if (error) throw new Error(`Resend error: ${error.message}`)
  }
}
