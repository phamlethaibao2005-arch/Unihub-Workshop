import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PillButton } from '@/components/PillButton'

const CTA_IMAGE = 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=1800&q=80'

export function EditorialCTA() {
  return (
    <section className="relative overflow-hidden">
      <div className="relative h-[70vh] min-h-[480px]">
        <Image
          src={CTA_IMAGE}
          alt="UniHub campaign"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-black/45" />

        <div className="absolute bottom-8 left-6 z-10 max-w-[760px] md:left-10">
          <h2
            className="font-display uppercase leading-[0.9] text-white"
            style={{ fontSize: 'clamp(56px, 7vw, 96px)' }}
          >
            ĐĂNG KÝ NGAY HÔM NAY
          </h2>
          <div className="mt-6">
            <PillButton variant="outline-image" asChild>
              <Link href="/signup">
                Tạo Tài Khoản <ArrowRight className="h-4 w-4" />
              </Link>
            </PillButton>
          </div>
        </div>
      </div>
    </section>
  )
}
