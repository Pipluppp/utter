export type BillingPlanId = 'creator' | 'pro'

export type BillingPlan = {
  id: BillingPlanId
  name: string
  priceMonthlyUsd: number
  creditsMonthly: number
  priority: 'standard' | 'priority'
  blurb: string
  highlights: string[]
}

export const billingPlans: BillingPlan[] = [
  {
    id: 'creator',
    name: 'Creator',
    priceMonthlyUsd: 10,
    creditsMonthly: 15_000,
    priority: 'standard',
    blurb: 'Best for consistent personal use and small projects.',
    highlights: ['Clone, design, generate', 'Exports: WAV + MP3'],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthlyUsd: 25,
    creditsMonthly: 45_000,
    priority: 'priority',
    blurb: 'For creators shipping frequently and working in longer scripts.',
    highlights: ['Faster turnaround under load', 'Commercial usage'],
  },
]

export function getBillingPlan(id: BillingPlanId): BillingPlan {
  const plan = billingPlans.find((p) => p.id === id)
  return plan ?? billingPlans[0]
}

export type CreditRate = {
  action: string
  cost: string
  note: string
}

export const creditRates: CreditRate[] = [
  {
    action: 'Generate speech',
    cost: '50 credits / minute',
    note: 'Billed by output duration (rounded up).',
  },
  {
    action: 'Voice design preview',
    cost: '300 credits',
    note: 'Per preview generation.',
  },
  {
    action: 'Voice clone',
    cost: '500 credits',
    note: 'Per clone submission.',
  },
]
