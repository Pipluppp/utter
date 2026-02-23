import { PricingContent } from '../../components/marketing/PricingContent'

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="relative left-1/2 right-1/2 -mx-[50vw] w-screen scroll-mt-24 -mt-px border-t border-border/60"
    >
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-12 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-pixel font-medium uppercase tracking-[2px] md:text-3xl">
              Pricing
            </h2>
            <p className="mt-2 max-w-xl text-base text-muted-foreground">
              Simple metering: 1 credit = 1 character. Pick a plan that matches
              your monthly output.
            </p>
          </div>
        </div>

        <PricingContent />
      </div>
    </section>
  )
}
