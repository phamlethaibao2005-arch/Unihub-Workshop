import { WorkshopForm } from '@/components/admin/WorkshopForm'

export default function AdminWorkshopNewPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-ink/60">ADMIN / WORKSHOPS</p>
        <h1 className="font-display text-[48px] uppercase leading-[0.9] text-ink">Tạo Workshop Mới</h1>
      </div>

      <WorkshopForm />
    </div>
  )
}
