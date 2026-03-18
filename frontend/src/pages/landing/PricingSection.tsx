import { PricingContent } from '../../components/marketing/PricingContent'
import { SVGBlobs } from '../../components/ui/SVGBlobs'

export function PricingSection() {
  return (
    <section
      id='pricing'
      className='relative isolate left-1/2 right-1/2 -mx-[50vw] w-screen overflow-x-clip scroll-mt-24 -mt-px border-t border-border/60'
    >
      <div className='pointer-events-none absolute -left-[14%] top-6 -z-10 w-[50%] overflow-hidden opacity-24 [mask-image:linear-gradient(to_right,#000_0%,#000_46%,transparent_100%)] select-none'>
        <SVGBlobs density='sparse' className='w-full' />
      </div>
      <div className='pointer-events-none absolute -right-[14%] top-6 -z-10 w-[50%] overflow-hidden opacity-24 [mask-image:linear-gradient(to_left,#000_0%,#000_46%,transparent_100%)] select-none'>
        <SVGBlobs density='sparse' className='w-full' />
      </div>
      <div className='mx-auto w-full max-w-5xl space-y-6 px-4 py-12 md:px-6'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h2 className='text-2xl font-pixel font-medium uppercase tracking-[2px] md:text-3xl'>
              Pricing
            </h2>
            <p className='mt-2 max-w-xl text-base text-muted-foreground'>
              Simple metering: 1 credit = 1 character, with prepaid packs and trial-first design +
              clone pricing.
            </p>
          </div>
        </div>

        <PricingContent />
      </div>
    </section>
  )
}
