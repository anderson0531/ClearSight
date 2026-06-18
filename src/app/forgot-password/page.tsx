'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AuthCard, AuthField } from '@/components/auth/AuthCard'
import { useTranslations } from '@/i18n/I18nProvider'

export default function ForgotPasswordPage() {
  const t = useTranslations()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [resetUrl, setResetUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => null)
      setResetUrl(data?.resetUrl ?? null)
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      title={t('authForgotTitle')}
      subtitle={t('authForgotSubtitle')}
      footer={
        <Link href="/login" className="font-semibold text-[var(--accent)] hover:underline">
          {t('authBackToLogin')}
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">{t('authForgotSent')}</p>
          {resetUrl ? (
            <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-3">
              <p className="text-xs text-[var(--muted-strong)]">{t('authDevLinkNote')}</p>
              <Link href={resetUrl} className="mt-1 block break-all text-sm font-medium text-[var(--accent)] hover:underline">
                {resetUrl}
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField
            label={t('authEmail')}
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="email"
            required
          />
          <button type="submit" disabled={loading} className="btn-accent w-full justify-center">
            {loading ? t('accountProcessing') : t('authForgotSubmit')}
          </button>
        </form>
      )}
    </AuthCard>
  )
}
