import { ArrowRight } from "lucide-react";
import { FeatureEntryLink } from "../../app/FeatureEntryLink";
import { buttonStyle } from "../../components/atoms/Button.styles";
import { Link } from "../../components/atoms/Link";
import { SVGBlobs } from "./SVGBlobs";
import { TextReveal } from "./TextReveal";

export function LandingHero() {
  return (
    <section className="relative isolate overflow-x-clip py-6 md:py-14">
      <div className="pointer-events-none absolute -left-[18%] top-0 -z-10 w-[56%] overflow-hidden opacity-32 [mask-image:linear-gradient(to_right,#000_0%,#000_50%,transparent_100%)] select-none">
        <SVGBlobs density="sparse" className="w-full" />
      </div>
      <div className="pointer-events-none absolute -right-[18%] top-0 -z-10 w-[56%] overflow-hidden opacity-32 [mask-image:linear-gradient(to_left,#000_0%,#000_50%,transparent_100%)] select-none">
        <SVGBlobs density="sparse" className="w-full" />
      </div>
      <div className="mx-auto max-w-4xl text-center">
        <TextReveal lines={["Clone voices.", "Design new ones.", "Generate speech."]} />

        <p className="mx-auto mt-5 max-w-2xl text-sm text-muted-foreground">
          Qwen-powered voice cloning, voice design, and speech generation. Hear real demos first,
          then create voices and queue speech in your own workspace. Supports 10 Qwen TTS languages.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/"
            hash="demos"
            className={buttonStyle({ variant: "primary", size: "md", className: "min-w-[200px]" })}
          >
            {"Hear the demos"} <ArrowRight className="icon-sm" aria-hidden="true" />
          </Link>
          <FeatureEntryLink
            to="/clone"
            className={buttonStyle({
              variant: "secondary",
              size: "md",
              className: "min-w-[200px]",
            })}
          >
            {"Clone a voice"} <ArrowRight className="icon-sm" aria-hidden="true" />
          </FeatureEntryLink>
        </div>
      </div>
    </section>
  );
}
