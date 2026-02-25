import { useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { creditPacks } from '../../content/plans'
import { apiJson } from '../../lib/api'
import { useCreditsUsage } from '../hooks'

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border py-3 text-sm">
      <div className="text-muted-foreground">{k}</div>
      <div className="font-semibold">{v}</div>
    </div>
  )
}

export function AccountBillingPage() {
  const { data, loading, error, refresh } = useCreditsUsage(90)
  const [activePackId, setActivePackId] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const packLabelById = useMemo(
    () =>
      Object.fromEntries(
        creditPacks.map((pack) => [pack.id, pack.name] as const),
      ),
    [],
  )

  const paidEvents = useMemo(
    () =>
      (data?.events ?? []).filter(
        (event) => event.operation === 'paid_purchase',
      ),
    [data?.events],
  )

  async function startCheckout(packId: string) {
    setCheckoutError(null)
    setActivePackId(packId)

    try {
      const res = await apiJson<{ url: string }>('/api/billing/checkout', {
        method: 'POST',
        json: { pack_id: packId },
      })
      if (!res.url) throw new Error('Checkout URL missing from response')
      window.location.assign(res.url)
    } catch (e) {
      setCheckoutError(
        e instanceof Error ? e.message : 'Failed to start checkout session',
      )
      setActivePackId(null)
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <section className="border border-border bg-subtle p-4 text-sm text-red-600 shadow-elevated">
          {error}
        </section>
      ) : null}

      {checkoutError ? (
        <section className="border border-border bg-subtle p-4 text-sm text-red-600 shadow-elevated">
          {checkoutError}
        </section>
      ) : null}

      <section className="border border-border bg-background p-5 shadow-elevated">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-wide">
              Credit balance
            </div>
            <div className="mt-2 text-xl font-semibold">
              {data ? data.balance.toLocaleString() : '—'} credits
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {data?.credit_unit ?? '1 credit = 1 character'}
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void refresh()}>
            Refresh
          </Button>
        </div>

        <div className="mt-4 border border-border bg-subtle px-4 shadow-elevated">
          <Row k="Status" v={loading ? 'Loading…' : 'Active'} />
          <Row
            k="Design trials remaining"
            v={data ? String(data.trials.design_remaining) : '—'}
          />
          <Row
            k="Clone trials remaining"
            v={data ? String(data.trials.clone_remaining) : '—'}
          />
        </div>
      </section>

      <section className="border border-border bg-background p-5 shadow-elevated">
        <div className="text-[12px] font-semibold uppercase tracking-wide">
          Buy credits
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {creditPacks.map((pack) => (
            <div
              key={pack.id}
              className="border border-border bg-subtle p-4 shadow-elevated"
            >
              <div className="text-[12px] font-semibold uppercase tracking-wide">
                {pack.name}
              </div>
              <div className="mt-2 text-xl font-semibold">
                ${pack.priceUsd} · {pack.credits.toLocaleString()} credits
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {pack.blurb}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {pack.highlights.map((item) => (
                  <span
                    key={item}
                    className="border border-border px-2 py-1 uppercase tracking-wide"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <div className="mt-4">
                <Button
                  size="sm"
                  loading={activePackId === pack.id}
                  onClick={() => void startCheckout(pack.id)}
                  disabled={Boolean(activePackId)}
                >
                  Checkout
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border border-border bg-background p-5 shadow-elevated">
        <div className="text-[12px] font-semibold uppercase tracking-wide">
          Purchased credits
        </div>

        {paidEvents.length === 0 ? (
          <div className="mt-4 border border-border bg-subtle p-4 text-sm text-muted-foreground shadow-elevated">
            No purchased credit events yet.
          </div>
        ) : (
          <div className="mt-4 overflow-hidden border border-border shadow-elevated">
            <div className="grid grid-cols-[0.9fr_1fr_1fr_1fr] border-b border-border bg-subtle px-4 py-3 text-[12px] font-semibold uppercase tracking-wide">
              <div>Pack</div>
              <div>Credits</div>
              <div>Balance after</div>
              <div>When</div>
            </div>
            <div className="divide-y divide-border">
              {paidEvents.map((event) => (
                <div
                  key={event.id}
                  className="grid grid-cols-[0.9fr_1fr_1fr_1fr] px-4 py-3 text-sm"
                >
                  <div>
                    {typeof event.metadata.pack_id === 'string'
                      ? (packLabelById[event.metadata.pack_id] ??
                        event.metadata.pack_id)
                      : 'paid_purchase'}
                  </div>
                  <div className="font-semibold">
                    {`+${event.amount.toLocaleString()}`}
                  </div>
                  <div>{event.balance_after.toLocaleString()}</div>
                  <div className="text-muted-foreground">
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
