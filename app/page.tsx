import { ArrowRight } from "lucide-react"
import { PillButton } from "@/components/PillButton"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white px-8">
      <h1 className="font-display text-6xl uppercase text-ink">UniHub Workshop</h1>
      <p className="font-sans text-sm text-[#707072]">Nike design system — acceptance test</p>
      <div className="flex flex-wrap items-center gap-3">
        <PillButton variant="primary">
          Test <ArrowRight className="w-4 h-4" />
        </PillButton>
        <PillButton variant="ghost">Ghost Variant</PillButton>
        <PillButton variant="outline-image">Outline Image</PillButton>
      </div>
    </main>
  )
}
