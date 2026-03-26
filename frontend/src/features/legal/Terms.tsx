function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border border-border bg-background p-5 shadow-elevated">
      <h3 className="text-caption font-semibold uppercase tracking-wide">{title}</h3>
      <div className="text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

export function TermsPage() {
  return (
    <div className="max-w-[65ch] space-y-8">
      <div>
        <h2 className="text-xl font-pixel font-medium uppercase tracking-[2px]">
          Terms & Conditions
        </h2>
      </div>

      <div className="space-y-4">
        <Section title="Who can use Utter">
          You must use Utter lawfully and follow these terms. If you use Utter for a team or
          business, you are responsible for people using your workspace.
        </Section>

        <Section title="Your rights and responsibilities">
          You must have the legal right to upload or submit any audio, transcript, prompts, and text
          you use in Utter. You are responsible for getting any required permissions, notices, or
          consent from people represented in voice data.
        </Section>

        <Section title="Ownership and service license">
          You keep ownership of your inputs and outputs. You grant Utter a limited license to host,
          process, store, and transmit that content only as needed to run the service (including
          queue processing, synthesis requests, playback, storage, and account operations).
        </Section>

        <Section title="Prohibited use">
          You may not use Utter for unlawful activity, fraud, harassment, non-consensual
          impersonation, or rights-infringing content. We may limit or suspend access if we detect
          or receive reports of misuse.
        </Section>

        <Section title="Credits and billing">
          Utter currently uses prepaid credit packs (one-time purchases), not auto-renewing
          subscriptions. Credits are consumed as you use clone, design, and generation features
          under the current in-product rate card. Pricing and credit costs may change in future
          updates.
        </Section>

        <Section title="Availability">
          Utter depends on third-party infrastructure and model providers, including Alibaba Cloud
          Model Studio (Qwen). Queue delays, provider rate limits, regional routing behavior, or
          outages can delay or interrupt tasks. We do not guarantee uninterrupted availability.
        </Section>

        <Section title="Changes to these terms">
          We may update these terms as the product evolves. Continued use after an update means you
          accept the revised terms.
        </Section>
      </div>
    </div>
  );
}
