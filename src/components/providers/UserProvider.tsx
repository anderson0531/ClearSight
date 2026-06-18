'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Plan } from '@/lib/plans'

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
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<UserContextValue, 'refresh'>>({
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

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/me')
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

  const value = useMemo(() => ({ ...state, refresh }), [state, refresh])

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) {
    throw new Error('useUser must be used within UserProvider')
  }
  return ctx
}
