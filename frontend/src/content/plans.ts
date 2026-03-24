export type CreditPackId = "pack_30k" | "pack_120k";

export type CreditPack = {
  id: CreditPackId;
  name: string;
  priceUsd: number;
  credits: number;
  blurb: string;
  highlights: string[];
  featured?: boolean;
};

export const creditPacks: CreditPack[] = [
  {
    id: "pack_30k",
    name: "Starter pack",
    priceUsd: 2.99,
    credits: 30_000,
    blurb: "Great for trying workflows and light production use.",
    highlights: ["One-time purchase", "About 80 minutes of generated audio"],
  },
  {
    id: "pack_120k",
    name: "Studio pack",
    priceUsd: 9.99,
    credits: 120_000,
    blurb: "Best value for frequent generation and iteration loops.",
    highlights: ["One-time purchase", "About 320 minutes of generated audio"],
    featured: true,
  },
];

export function getCreditPackById(packId: string): CreditPack | null {
  if (packId === "pack_30k" || packId === "pack_120k") {
    return creditPacks.find((pack) => pack.id === packId) ?? null;
  }

  return null;
}

export type CreditRate = {
  action: string;
  cost: string;
  note: string;
};

export const creditRates: CreditRate[] = [
  {
    action: "Generate speech",
    cost: "1 credit / character",
    note: "Charged from submitted text length.",
  },
  {
    action: "Voice design preview",
    cost: "2,400 credits",
    note: "Flat price per design preview.",
  },
  {
    action: "Voice clone finalize",
    cost: "200 credits",
    note: "Flat price per clone finalization.",
  },
];
