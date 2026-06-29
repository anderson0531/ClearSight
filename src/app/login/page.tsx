'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthCard, AuthField } from '@/components/auth/AuthCard'
import { useUser } from '@/components/providers/UserProvider'
import { useTranslations } from '@/i18n/I18nProvider'

function LoginForm() {
  const t = useTranslations()
  const router = useRouter()
  const params = useSearchParams()
  const { refresh } = useUser()
  const nextUrl = params.get('next') || '/home'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? t('authGenericError'))
        return
      }
      await refresh()
      router.push(nextUrl)
      router.refresh()
    } catch {
      setError(t('authGenericError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      title={t('authLoginTitle')}
      subtitle={t('authLoginSubtitle')}
      footer={
        <>
          {t('authNoAccount')}{' '}
          <Link href="/signup" className="font-semibold text-[var(--accent)] hover:underline">
            {t('authSignUp')}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          label={t('authEmail')}
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          required
        />
        <AuthField
          label={t('authPassword')}
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />
        {error ? <p className="text-sm text-[var(--danger,#f87171)]">{error}</p> : null}
        <button type="submit" disabled={loading} className="btn-accent w-full justify-center">
          {loading ? t('authSigningIn') : t('authSignIn')}
        </button>
        <p className="text-center text-xs">
          <Link href="/forgot-password" className="text-[var(--muted-strong)] hover:underline">
            {t('authForgotPassword')}
          </Link>
        </p>
      </form>
    </AuthCard>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
