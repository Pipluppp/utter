function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className='space-y-2 border border-border bg-background p-5 shadow-elevated'>
      <h3 className='text-[12px] font-semibold uppercase tracking-wide'>{title}</h3>
      <div className='text-sm text-muted-foreground'>{children}</div>
    </section>
  )
}

export function PrivacyPage() {
  return (
    <div className='space-y-8'>
      <div>
        <h2 className='text-xl font-pixel font-medium uppercase tracking-[2px]'>Privacy Policy</h2>
      </div>

      <div className='space-y-4'>
        <Section title='What you provide'>
          You provide account information (through Supabase Auth), reference audio and transcript
          text for voice cloning, voice design prompts and preview text, and generation text.
        </Section>

        <Section title='What Utter stores'>
          Utter stores the data needed to run your workspace, including:
          <ul className='ml-5 mt-2 list-disc space-y-1'>
            <li>reference audio files in a private storage bucket (`references`)</li>
            <li>generated audio files in a private storage bucket (`generations`)</li>
            <li>clone transcripts and generation text in our database</li>
            <li>task status/results for queued jobs</li>
            <li>credit and billing ledger records</li>
          </ul>
        </Section>

        <Section title='How Qwen processing fits in'>
          When you run clone, design, or generation, relevant text/audio is sent to Alibaba Cloud
          Model Studio (Qwen) to perform synthesis. Based on Alibaba&apos;s published Model Studio
          privacy notice (checked March 2026), direct API calls are described as not storing
          conversation content and not using customer API content to train models, while call status
          metadata may be recorded. We do not use the Model Studio Assistant API path for Utter TTS
          jobs.
        </Section>

        <Section title='How long we keep data'>
          We keep account and product data while your account is active and while it is needed to
          operate the service, enforce abuse controls, and maintain billing/credit records. Some
          provider artifacts are temporary by design (for example, provider-hosted synthesis URLs
          are short-lived and Utter stores durable copies in our own storage).
        </Section>

        <Section title='How deletion works today'>
          You can delete generated items from History, which removes both the database record and
          stored generation audio. You can also delete voices from your voice list. Today, voice
          deletion is a soft-delete in the app database, and underlying reference artifacts may be
          retained until our retention/deletion workflow is expanded.
        </Section>

        <Section title='Acceptable use and abuse review'>
          We may review account/task metadata and investigate reported misuse to protect the service
          (for example fraud, harassment, impersonation, or other abuse). We do not promise
          always-on automated moderation and we may suspend access for policy or legal violations.
        </Section>
      </div>
    </div>
  )
}
