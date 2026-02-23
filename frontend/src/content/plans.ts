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
    cost: 'text chars + description chars',
    note: 'Charged from preview text plus voice description.',
  },
  {
    action: 'Voice clone',
    cost: 'transcript chars',
    note: 'Charged from submitted transcript length.',
  },
]
