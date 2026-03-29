import { ChevronDown } from "lucide-react";
import { Button as AriaButton, Disclosure, DisclosurePanel, Heading } from "react-aria-components";
import { GUIDE_SCRIPTS } from "../../../data/guide-scripts";
import { cn } from "../../../lib/cn";

interface RecordingGuideProps {
  recording: boolean;
  counting: boolean;
}

export function RecordingGuide({ recording }: RecordingGuideProps) {
  return (
    <Disclosure>
      {({ isExpanded }) => (
        <>
          <Heading className="contents">
            <AriaButton
              slot="trigger"
              isDisabled={recording && isExpanded}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs text-faint",
                "data-[hovered]:text-foreground data-[pressed]:text-foreground",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                "data-[disabled]:opacity-50 data-[disabled]:cursor-default",
              )}
            >
              <ChevronDown
                className={cn(
                  "icon-xs transition-transform duration-200",
                  isExpanded && "rotate-180",
                )}
                aria-hidden="true"
              />
              {isExpanded ? "Hide guide script" : "Need something to read?"}
            </AriaButton>
          </Heading>
          {isExpanded ? (
            <DisclosurePanel className="mt-2 rounded-lg bg-muted px-4 py-3">
              <div className="text-[10px] uppercase tracking-widest text-faint">Guide Script</div>
              <ul className="mt-2 space-y-3" aria-label="Guide scripts to read aloud">
                {GUIDE_SCRIPTS.map((line, i) => (
                  <li
                    key={line}
                    className={cn(
                      "text-sm font-medium leading-snug text-foreground",
                      recording && "animate-text-shimmer",
                    )}
                    style={recording ? { animationDelay: `${i * -3.5}s` } : undefined}
                  >
                    {line}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-faint">Read these aloud while recording.</p>
            </DisclosurePanel>
          ) : null}
        </>
      )}
    </Disclosure>
  );
}
