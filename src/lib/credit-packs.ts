import { toUnits } from '@/lib/credit-units'

/** Priced on-demand credit top-up pack. */
export interface OnDemandCreditPack {
  id: 'starter' | 'standard' | 'power'
  credits: number
  priceUsd: number
  priceLabel: string
}

export const ON_DEMAND_CREDIT_PACKS: OnDemandCreditPack[] = [
  { id: 'starter', credits: 5, priceUsd: 3.49, priceLabel: '$3.49' },
  { id: 'standard', credits: 15, priceUsd: 8.99, priceLabel: '$8.99' },
  { id: 'power', credits: 50, priceUsd: 24.99, priceLabel: '$24.99' },
]

export function onDemandPackByCredits(credits: number): OnDemandCreditPack | undefined {
  return ON_DEMAND_CREDIT_PACKS.find((p) => p.credits === credits)
}

/** @deprecated Use ON_DEMAND_CREDIT_PACKS */
export const CREDIT_PACKS = ON_DEMAND_CREDIT_PACKS.map((p) => p.credits) as readonly number[]

export type CreditPack = (typeof CREDIT_PACKS)[number]

export function isCreditPack(value: unknown): value is CreditPack {
  return typeof value === 'number' && ON_DEMAND_CREDIT_PACKS.some((p) => p.credits === value)
}

export function isOnDemandCreditPack(value: unknown): value is number {
  return typeof value === 'number' && ON_DEMAND_CREDIT_PACKS.some((p) => p.credits === value)
}

export function onDemandPackUnits(credits: number): number {
  return toUnits(credits)
}
