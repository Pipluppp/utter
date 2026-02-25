export type CreditPackId = 'pack_150k' | 'pack_500k'

export type CreditPack = {
  id: CreditPackId
  name: string
  priceUsd: number
  credits: number
  blurb: string
  highlights: string[]
  featured?: boolean
}

export const creditPacks: CreditPack[] = [
  {
    id: 'pack_150k',
    name: 'Starter pack',
    priceUsd: 10,
    credits: 150_000,
    blurb: 'Great for occasional generation and voice iteration.',
    highlights: ['One-time purchase', 'Credits do not expire in this phase'],
  },
  {
    id: 'pack_500k',
    name: 'Studio pack',
    priceUsd: 25,
    credits: 500_000,
    blurb: 'Best value for high-throughput production workloads.',
    highlights: ['One-time purchase', 'Best credits per dollar'],
    featured: true,
  },
]

export type CreditRate = {
  action: string
  cost: string
  note: string
}

export const creditRates: CreditRate[] = [
  {
    action: 'Generate speech',
    cost: '1 credit / character',
    note: 'Charged from submitted text length.',
  },
  {
    action: 'Voice design preview',
    cost: 'First 2 free, then 5,000 credits',
    note: 'Flat price after design trials are used.',
  },
  {
    action: 'Voice clone finalize',
    cost: 'First 2 free, then 1,000 credits',
    note: 'Flat price after clone trials are used.',
  },
]
