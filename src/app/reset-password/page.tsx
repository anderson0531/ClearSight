'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthCard, AuthField } from '@/components/auth/AuthCard'
import { useUser } from '@/components/providers/UserProvider'
import { useTranslations } from '@/i18n/I18nProvider'

function ResetForm() {
  const t = useTranslations()
  const router = useRouter()
  const params = useSearchParams()
  const { refresh } = useUser()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError(t('authResetInvalid'))
      return
    }
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
      const res = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.error ?? t('authResetInvalid'))
        return
      }
      await refresh()
      router.push('/account')
      router.refresh()
    } catch {
      setError(t('authGenericError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      title={t('authResetTitle')}
      subtitle={t('authResetSubtitle')}
      footer={
        <Link href="/login" className="font-semibold text-[var(--accent)] hover:underline">
          {t('authBackToLogin')}
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          label={t('authNewPassword')}
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
          {loading ? t('accountProcessing') : t('authResetSubmit')}
        </button>
      </form>
    </AuthCard>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  )
}
