import Link from 'next/link'

const FOOTER_LINKS = [
  {
    title: 'Tài nguyên',
    items: [
      { label: 'Lịch workshop', href: '/workshops' },
      { label: 'Hướng dẫn tham gia', href: '/support' },
      { label: 'Cộng đồng', href: '/community' },
      { label: 'Câu hỏi thường gặp', href: '/support' },
    ],
  },
  {
    title: 'Hỗ trợ',
    items: [
      { label: 'Liên hệ', href: '/support' },
      { label: 'Hỗ trợ kỹ thuật', href: '/support' },
      { label: 'Chính sách hoàn phí', href: '/support' },
      { label: 'Báo lỗi', href: '/support' },
    ],
  },
  {
    title: 'Về UniHub',
    items: [
      { label: 'Câu chuyện', href: '/about' },
      { label: 'Đội ngũ', href: '/about' },
      { label: 'Đối tác', href: '/partners' },
      { label: 'Tuyển dụng', href: '/about' },
    ],
  },
  {
    title: 'Pháp lý',
    items: [
      { label: 'Điều khoản', href: '/legal' },
      { label: 'Bảo mật', href: '/legal' },
      { label: 'Quy tắc cộng đồng', href: '/legal' },
      { label: 'Bản quyền', href: '/legal' },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-hairline bg-canvas">
      <div className="grid grid-cols-2 gap-8 px-4 py-12 md:grid-cols-4 md:px-6 lg:px-10">
        {FOOTER_LINKS.map((group) => (
          <div key={group.title}>
            <h3 className="mb-4 text-[14px] font-semibold text-ink">{group.title}</h3>
            <ul className="space-y-2 text-[13px] text-ink/60">
              {group.items.map((item) => (
                <li key={item.label}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-hairline px-4 py-4 text-[9px] uppercase tracking-[0.25em] text-ink/60 md:px-6 lg:px-10">
        <span>© 2026 UniHub Workshop</span>
        <span>Việt Nam / UTC+7</span>
      </div>
    </footer>
  )
}
