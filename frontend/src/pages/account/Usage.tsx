import { useCreditsUsage } from '../hooks'

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
      <div className="mt-2 text-xl font-pixel font-medium">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{hint}</div>
    </div>
  )
}

function formatTier(value: string) {
  if (!value) return '—'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatSignedAmount(value: number) {
  if (value === 0) return '0'
  if (value > 0) return `+${value.toLocaleString()}`
  return value.toLocaleString()
}

function eventLabel(value: string) {
  if (value === 'generate') return 'Generate speech'
  if (value === 'design_preview') return 'Voice design preview'
  if (value === 'clone') return 'Voice clone'
  if (value === 'monthly_allocation') return 'Monthly allocation'
  if (value === 'manual_adjustment') return 'Manual adjustment'
  return value
}

export function AccountUsagePage() {
  const { data, loading, error } = useCreditsUsage(30)

  const planTier = formatTier(data?.plan.tier ?? '')
  const monthlyCredits = data?.plan.monthly_credits ?? 0
  const creditsRemaining = data?.balance ?? 0
  const creditsUsed = data?.usage.debited ?? 0

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Stat
          label="Plan"
          value={planTier}
          hint={`${monthlyCredits.toLocaleString()} credits / month`}
        />
        <Stat
          label="Credits remaining"
          value={creditsRemaining.toLocaleString()}
          hint={data?.credit_unit ?? '1 credit = 1 character'}
        />
        <Stat
          label="Credits used"
          value={creditsUsed.toLocaleString()}
          hint={`Last ${data?.window_days ?? 30} days`}
        />
      </div>

      {loading ? (
        <section className="border border-border bg-subtle p-4 text-sm text-muted-foreground shadow-elevated">
          Loading credit usage…
        </section>
      ) : null}

      {error ? (
        <section className="border border-border bg-subtle p-4 text-sm text-red-600 shadow-elevated">
          {error}
        </section>
      ) : null}

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
            {(data?.rate_card ?? []).map((r) => (
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

      <section className="border border-border bg-background p-5 shadow-elevated">
        <div className="text-[12px] font-semibold uppercase tracking-wide">
          Recent credit events
        </div>

        {(data?.events.length ?? 0) === 0 ? (
          <div className="mt-4 border border-border bg-subtle p-4 text-sm text-muted-foreground shadow-elevated">
            No credit events yet.
          </div>
        ) : (
          <div className="mt-4 overflow-hidden border border-border shadow-elevated">
            <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] border-b border-border bg-subtle px-4 py-3 text-[12px] font-semibold uppercase tracking-wide">
              <div>Action</div>
              <div>Amount</div>
              <div>Balance after</div>
              <div>When</div>
            </div>
            <div className="divide-y divide-border">
              {data?.events.map((event) => (
                <div
                  key={event.id}
                  className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] px-4 py-3"
                >
                  <div className="text-sm">
                    <div className="font-semibold uppercase tracking-wide text-[12px]">
                      {eventLabel(event.operation)}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {event.event_kind}
                    </div>
                  </div>
                  <div className="text-sm font-semibold">
                    {formatSignedAmount(event.signed_amount)}
                  </div>
                  <div className="text-sm">
                    {event.balance_after.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(event.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
