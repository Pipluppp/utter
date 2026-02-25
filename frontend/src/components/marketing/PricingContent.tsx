import { creditRates } from '../../content/plans'
import { PricingGrid } from './PricingGrid'

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="border border-border bg-subtle p-4 shadow-elevated">
      <div className="text-[12px] font-semibold uppercase tracking-wide">
        {q}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{a}</div>
    </div>
  )
}

export function PricingContent() {
  return (
    <>
      <PricingGrid />

      <section className="space-y-4">
        <div className="mx-auto w-full max-w-4xl space-y-4">
          <div className="text-[12px] font-semibold uppercase tracking-[2px]">
            Credit rates
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {creditRates.map((r) => (
              <div
                key={r.action}
                className="border border-border bg-background p-4 shadow-elevated"
              >
                <div className="text-[12px] font-semibold uppercase tracking-wide">
                  {r.action}
                </div>
                <div className="mt-2 text-xl font-semibold">{r.cost}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {r.note}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="mx-auto w-full max-w-4xl space-y-4">
          <div className="text-[12px] font-semibold uppercase tracking-[2px]">
            FAQ
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <FAQItem
              q="Do credits reset?"
              a="No monthly reset in this phase. Purchased credits stay on your balance."
            />
            <FAQItem
              q="How are credits measured?"
              a="Generate is 1 credit = 1 character. Design preview and clone each include 2 free trials, then switch to flat credit pricing."
            />
            <FAQItem
              q="Where do purchases appear?"
              a="Account → Billing shows balance, purchase actions, and paid credit history from ledger events."
            />
          </div>
        </div>
      </section>
    </>
  )
}
