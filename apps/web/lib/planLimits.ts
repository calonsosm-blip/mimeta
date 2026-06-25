export const PLAN_LIMITS = {
  free: {
    planned_payments: 2,
    debts: 2,
    savings_goals: 2,
    categories: 10,
    history_months: 6,
  },
  premium: {
    planned_payments: Infinity,
    debts: Infinity,
    savings_goals: Infinity,
    categories: Infinity,
    history_months: Infinity,
  },
} as const

export type PlanType = 'free' | 'premium'

export function getLimits(plan: PlanType | string) {
  return plan === 'premium' ? PLAN_LIMITS.premium : PLAN_LIMITS.free
}

export function isPremiumAccent(accent: string) {
  return accent !== 'mimeta'
}
