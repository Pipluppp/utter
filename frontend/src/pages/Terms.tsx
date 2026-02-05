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

export function TermsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold uppercase tracking-[2px]">
          Terms & Conditions
        </h2>
        <div className="mt-2 text-sm text-muted-foreground">
          Effective date: February 5, 2026
        </div>
      </div>

      <div className="space-y-4">
        <Section title="Using the service">
          Don’t upload content you don’t have rights to. Don’t impersonate
          others without permission. Don’t use generated audio for fraud or
          harassment.
        </Section>
        <Section title="Your content">
          You retain ownership of your uploads and text. You grant us the right
          to process them to provide the service (generation, storage, and
          playback).
        </Section>
        <Section title="Accounts & billing">
          Subscriptions renew monthly unless cancelled. Usage limits and plan
          definitions may change as we move to the Supabase-backed deployment.
        </Section>
        <Section title="Availability">
          We aim for reliability but can’t guarantee uninterrupted service.
          Scheduled maintenance and provider outages may occur.
        </Section>
      </div>
    </div>
  )
}
