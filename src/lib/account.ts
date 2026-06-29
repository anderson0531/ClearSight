import { isPaymentBypassEnabled } from '@/lib/payments'
import { DEMO_USER_ID } from '@/lib/session'
import { fromUnits } from '@/lib/credit-units'
import type { Plan } from '@/lib/plans'

export interface SerializableUser {
  id: string
  email: string | null
  name?: string | null
  plan: Plan
  coreTokens: number
  subscriptionActive: boolean
}

export interface PublicUser {
  id: string | null
  email: string | null
  name: string | null
  plan: Plan
  coreTokens: number
  subscriptionActive: boolean
  authenticated: boolean
  demoMode: boolean
  paymentBypass: boolean
}

export function serializeUser(user: SerializableUser, authenticated: boolean): PublicUser {
  return {
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    plan: user.plan,
    coreTokens: fromUnits(user.coreTokens),
    subscriptionActive: user.subscriptionActive,
    authenticated,
    demoMode: user.id === DEMO_USER_ID,
    paymentBypass: isPaymentBypassEnabled(),
  }
}

export const ANONYMOUS_USER: PublicUser = {
  id: null,
  email: null,
  name: null,
  plan: 'FREE',
  coreTokens: 0,
  subscriptionActive: false,
  authenticated: false,
  demoMode: false,
  paymentBypass: isPaymentBypassEnabled(),
}
