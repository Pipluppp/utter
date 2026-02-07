import { DemoWall } from './landing/DemoWall'
import { FeaturesSection } from './landing/FeaturesSection'
import { LandingHero } from './landing/LandingHero'
import { PricingSection } from './landing/PricingSection'

export function LandingPage() {
  return (
    <div>
      <LandingHero />

      <DemoWall />

      <FeaturesSection />

      <PricingSection />
    </div>
  )
}
