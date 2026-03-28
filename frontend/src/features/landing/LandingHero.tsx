import { ArrowRight } from "lucide-react";
import { FeatureEntryLink } from "../../app/FeatureEntryLink";
import { buttonStyle } from "../../components/atoms/Button.styles";
import { Link } from "../../components/atoms/Link";
import { GridArt } from "../../components/molecules/GridArt";
import { TextReveal } from "./TextReveal";

export function LandingHero() {
  return (
    <section className="relative isolate left-1/2 right-1/2 -mx-[50vw] w-screen overflow-x-clip pt-0 pb-14 md:pt-1 md:pb-20">
      <div className="pointer-events-none absolute inset-0 -z-10 select-none [mask-image:linear-gradient(180deg,transparent_0%,black_10%,black_80%,transparent_100%)] [-webkit-mask-image:linear-gradient(180deg,transparent_0%,black_10%,black_80%,transparent_100%)]">
        <GridArt
          className="opacity-[0.19] dark:opacity-[0.14]"
          lineClassName="stroke-foreground/[0.09]"
          highlightOpacityScale={1.3}
          glyphOpacity={0.1}
        />
      </div>
      <div className="mx-auto max-w-4xl px-4 text-center">
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
