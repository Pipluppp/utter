import { Button } from "../../../components/atoms/Button";
import type { CreditPack } from "../../../content/plans";
import { cn } from "../../../lib/cn";
import { formatCredits, formatUsd } from "../accountData";

interface CreditPackCardProps {
  pack: CreditPack;
  isPending: boolean;
  onBuy: () => void;
}

export function CreditPackCard({ pack, isPending, onBuy }: CreditPackCardProps) {
  return (
    <div
      className={cn(
        "relative border border-border bg-subtle p-5 shadow-elevated",
        pack.featured && "border-border-strong",
      )}
    >
      {pack.featured ? (
        <div className="absolute -top-3 left-4 border border-border-strong bg-background px-2 py-1 text-[11px] font-pixel font-medium uppercase tracking-wide">
          Best value
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {pack.name}
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-3">
            <div className="text-3xl font-pixel font-medium">{formatUsd(pack.priceUsd)}</div>
            <div className="text-[15px] leading-6 text-foreground/68">
              {formatCredits(pack.credits)} credits
            </div>
          </div>
        </div>
        <Button size="sm" onPress={onBuy} isPending={isPending} isDisabled>
          Buy
        </Button>
      </div>

      <div className="mt-3 max-w-md text-[15px] leading-7 text-foreground/68">{pack.blurb}</div>

      <div className="mt-4 flex flex-wrap gap-2">
        {pack.highlights.map((item) => (
          <span
            key={item}
            className="border border-border bg-background px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
