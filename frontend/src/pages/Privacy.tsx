function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2 border border-border bg-background p-5 shadow-elevated">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide">
        {title}
      </h3>
      <div className="text-sm text-muted-foreground">{children}</div>
    </section>
  )
}

export function PrivacyPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-pixel font-medium uppercase tracking-[2px]">
          Privacy Policy
        </h2>
        <div className="mt-2 text-sm text-muted-foreground">
          Effective date: February 5, 2026
        </div>
      </div>

      <div className="space-y-4">
        <Section title="What we collect">
          Account identifiers (email), voice assets you upload, text you submit
          for generation, and basic usage events (to operate and improve the
          service).
        </Section>
        <Section title="How we use it">
          Provide the app, generate audio, prevent abuse, and understand product
          usage (aggregate analytics). Billing data is processed by a payment
          provider.
        </Section>
        <Section title="Data retention">
          You control stored voices and generated clips; retention rules will be
          finalized with the production database. Expect per-workspace deletion
          tools under Account.
        </Section>
        <Section title="Your choices">
          Export and delete your voices and generated clips from the Account
          pages once auth is enabled. Contact support for access requests.
        </Section>
      </div>
    </div>
  )
}
