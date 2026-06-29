'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthCard, AuthField } from '@/components/auth/AuthCard'
import { useUser } from '@/components/providers/UserProvider'
import { useTranslations } from '@/i18n/I18nProvider'
import { isPlan } from '@/lib/plans'

function SignupForm() {
  const t = useTranslations()
  const router = useRouter()
  const params = useSearchParams()
  const { refresh, applyUser } = useUser()
  const planParam = params.get('plan')
  const nextUrl = params.get('next') || (planParam && planParam !== 'FREE' ? '/premium' : '/home')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError(t('authPasswordTooShort'))
      return
    }
    if (password !== confirm) {
      setError(t('authPasswordMismatch'))
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: name.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? t('authGenericError'))
        return
      }

      await refresh()

      const planToActivate = planParam && isPlan(planParam) ? planParam : 'FREE'
      const sub = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planToActivate }),
      })
      const subData = (await sub.json().catch(() => null)) as {
        user?: Parameters<typeof applyUser>[0]
        error?: string
      } | null
      if (!sub.ok || !subData?.user) {
        setError(subData?.error ?? t('authGenericError'))
        return
      }
      applyUser(subData.user)
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
      title={t('authSignupTitle')}
      subtitle={t('authSignupSubtitle')}
      footer={
        <>
          {t('authHaveAccount')}{' '}
          <Link href="/login" className="font-semibold text-[var(--accent)] hover:underline">
            {t('authSignIn')}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField label={t('authNameOptional')} type="text" value={name} onChange={setName} autoComplete="name" />
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
          autoComplete="new-password"
          required
        />
        <AuthField
          label={t('authConfirmPassword')}
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          required
        />
        {error ? <p className="text-sm text-[var(--danger,#f87171)]">{error}</p> : null}
        <button type="submit" disabled={loading} className="btn-accent w-full justify-center">
          {loading ? t('authCreatingAccount') : t('authSignUp')}
        </button>
      </form>
    </AuthCard>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}
