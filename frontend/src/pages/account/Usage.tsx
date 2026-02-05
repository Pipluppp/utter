import { creditRates, getBillingPlan } from '../../content/plans'

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="border border-border bg-background p-4 shadow-elevated">
      <div className="text-[12px] font-semibold uppercase tracking-wide">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{hint}</div>
    </div>
  )
}

export function AccountUsagePage() {
  const plan = getBillingPlan('creator')
  const creditsRemaining = plan.creditsMonthly
  const creditsUsed = 0

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Stat
          label="Plan"
          value={plan.name}
          hint={`${plan.creditsMonthly.toLocaleString()} credits / month`}
        />
        <Stat
          label="Credits remaining"
          value={creditsRemaining.toLocaleString()}
          hint="Updates as you generate audio"
        />
        <Stat
          label="Credits used"
          value={creditsUsed.toLocaleString()}
          hint="Current billing period"
        />
      </div>

      <section className="border border-border bg-background p-5 shadow-elevated">
        <div className="text-[12px] font-semibold uppercase tracking-wide">
          Rate card
        </div>
        <div className="mt-4 overflow-hidden border border-border shadow-elevated">
          <div className="grid grid-cols-[1fr_170px] border-b border-border bg-subtle px-4 py-3 text-[12px] font-semibold uppercase tracking-wide">
            <div>Action</div>
            <div>Cost</div>
          </div>
          <div className="divide-y divide-border">
            {creditRates.map((r) => (
              <div
                key={r.action}
                className="grid grid-cols-[1fr_170px] px-4 py-3"
              >
                <div className="text-sm">
                  <div className="font-semibold uppercase tracking-wide text-[12px]">
                    {r.action}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {r.note}
                  </div>
                </div>
                <div className="text-sm font-semibold">{r.cost}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
