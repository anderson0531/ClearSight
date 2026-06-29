'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Plan } from '@/lib/plans'
import { fetchWithTimeout } from '@/lib/client-fetch'

import type { PublicUser } from '@/lib/account'

export interface UserContextValue {
  id: string | null
  plan: Plan
  coreTokens: number | null
  subscriptionActive: boolean
  email: string | null
  name: string | null
  authenticated: boolean
  demoMode: boolean
  paymentBypass: boolean
  loading: boolean
  refresh: () => Promise<void>
  applyUser: (user: PublicUser) => void
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<UserContextValue, 'refresh' | 'applyUser'>>({
    id: null,
    plan: 'FREE',
    coreTokens: null,
    subscriptionActive: false,
    email: null,
    name: null,
    authenticated: false,
    demoMode: false,
    paymentBypass: false,
    loading: true,
  })

  const applyUser = useCallback((user: PublicUser) => {
    setState({
      id: user.id,
      plan: user.plan,
      coreTokens: user.coreTokens,
      subscriptionActive: user.subscriptionActive,
      email: user.email,
      name: user.name,
      authenticated: user.authenticated,
      demoMode: user.demoMode,
      paymentBypass: user.paymentBypass,
      loading: false,
    })
  }, [])

  const refresh = useCallback(async () => {
    try {
      const res = await fetchWithTimeout('/api/me', {}, 15_000)
      // Transient failure (e.g. DB blip → 503): keep the prior auth state rather
      // than bouncing a logged-in user to anonymous over a momentary outage.
      if (!res.ok) {
        setState((prev) => ({ ...prev, loading: false }))
        return
      }
      const data = (await res.json()) as {
        id?: string | null
        plan?: Plan
        coreTokens?: number
        subscriptionActive?: boolean
        email?: string | null
        name?: string | null
        authenticated?: boolean
        demoMode?: boolean
        paymentBypass?: boolean
      }
      setState({
        id: data.id ?? null,
        plan: data.plan ?? 'FREE',
        coreTokens: data.coreTokens ?? null,
        subscriptionActive: Boolean(data.subscriptionActive),
        email: data.email ?? null,
        name: data.name ?? null,
        authenticated: Boolean(data.authenticated),
        demoMode: Boolean(data.demoMode),
        paymentBypass: Boolean(data.paymentBypass),
        loading: false,
      })
    } catch {
      setState((prev) => ({ ...prev, loading: false }))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const value = useMemo(() => ({ ...state, refresh, applyUser }), [state, refresh, applyUser])

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) {
    throw new Error('useUser must be used within UserProvider')
  }
  return ctx
}
