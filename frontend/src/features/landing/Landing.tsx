import { DemoWall } from "./DemoWall";
import { FeaturesSection } from "./FeaturesSection";
import { LandingHero } from "./LandingHero";
import { PricingSection } from "./PricingSection";

export function LandingPage() {
  return (
    <div>
      <LandingHero />

      <DemoWall />

      <FeaturesSection />

      <PricingSection />
    </div>
  );
}
