'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageShell } from '@/components/layout/PageShell'
import { useUser } from '@/components/providers/UserProvider'
import { useI18n, useTranslations } from '@/i18n/I18nProvider'
import { CREDIT_PACKS, PLAN_DETAILS, PLANS, type Plan } from '@/lib/plans'
import { formatCreditsDisplay } from '@/lib/credit-units'

interface CreditTxn {
  id: string
  amount: number
  balanceAfter: number
  type: 'SUBSCRIPTION' | 'PURCHASE' | 'GENERATION' | 'REFUND' | 'ADJUSTMENT'
  description: string | null
  createdAt: string
}

const TXN_LABEL_KEYS: Record<CreditTxn['type'], string> = {
  SUBSCRIPTION: 'txnSubscription',
  PURCHASE: 'txnPurchase',
  GENERATION: 'txnGeneration',
  REFUND: 'txnRefund',
  ADJUSTMENT: 'txnAdjustment',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-5 sm:p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--accent-credit)]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function AccountPage() {
  const t = useTranslations()
  const { locale } = useI18n()
  const router = useRouter()
  const {
    plan,
    coreTokens,
    email,
    name,
    authenticated,
    subscriptionActive,
    paymentBypass,
    loading,
    refresh,
  } = useUser()

  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profileMsg, setProfileMsg] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [pwMsg, setPwMsg] = useState<string | null>(null)
  const [savingPw, setSavingPw] = useState(false)

  const [busy, setBusy] = useState<string | null>(null)
  const [history, setHistory] = useState<CreditTxn[]>([])

  useEffect(() => {
    setProfileName(name ?? '')
    setProfileEmail(email ?? '')
  }, [name, email])

  const loadHistory = useCallback(async () => {
    if (!authenticated) return
    try {
      const res = await fetch('/api/billing/history')
      if (!res.ok) return
      const data = await res.json()
      setHistory(data.transactions ?? [])
    } catch {
      /* ignore */
    }
  }, [authenticated])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  if (loading) {
    return (
      <PageShell title={t('accountTitle')}>
        <p className="text-sm text-[var(--muted)]">…</p>
      </PageShell>
    )
  }

  if (!authenticated) {
    return (
      <PageShell title={t('accountTitle')}>
        <div className="rounded-xl border border-[var(--border)] bg-white/[0.03] p-6 text-center">
          <p className="text-base font-semibold text-[var(--foreground)]">{t('accountSignedOut')}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">{t('accountSignedOutHint')}</p>
          <div className="mt-5 flex justify-center gap-3">
            <Link href="/login?next=/account" className="btn-accent">
              {t('authSignIn')}
            </Link>
            <Link href="/signup?next=/account" className="btn-ghost">
              {t('authSignUp')}
            </Link>
          </div>
        </div>
      </PageShell>
    )
  }

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    setProfileMsg(null)
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profileName.trim() || null, email: profileEmail.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setProfileMsg(data?.error ?? t('authGenericError'))
        return
      }
      await refresh()
      setProfileMsg(t('accountSaved'))
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingPw(true)
    setPwMsg(null)
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setPwMsg(data?.error ?? t('authGenericError'))
        return
      }
      setCurrentPassword('')
      setNewPassword('')
      setPwMsg(t('accountPasswordUpdated'))
    } finally {
      setSavingPw(false)
    }
  }

  const handleSubscribe = async (targetPlan: Plan) => {
    setBusy(`plan:${targetPlan}`)
    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: targetPlan }),
      })
      const data = await res.json().catch(() => null)
      if (data?.bypass === false && data?.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank', 'noopener,noreferrer')
      } else {
        await refresh()
        await loadHistory()
      }
    } finally {
      setBusy(null)
    }
  }

  const handleCancel = async () => {
    if (!window.confirm(t('accountCancelConfirm'))) return
    setBusy('cancel')
    try {
      await fetch('/api/billing/cancel', { method: 'POST' })
      await refresh()
      await loadHistory()
    } finally {
      setBusy(null)
    }
  }

  const handleBuyCredits = async (pack: number) => {
    setBusy(`pack:${pack}`)
    try {
      await fetch('/api/billing/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack }),
      })
      await refresh()
      await loadHistory()
    } finally {
      setBusy(null)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    await refresh()
    router.push('/')
    router.refresh()
  }

  const handleDelete = async () => {
    if (!window.confirm(t('accountDeleteConfirm'))) return
    setBusy('delete')
    try {
      await fetch('/api/account', { method: 'DELETE' })
      await refresh()
      router.push('/')
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const canBuyCredits = plan === 'PREMIUM' || plan === 'CREATOR'

  return (
    <PageShell title={t('accountTitle')}>
      <div className="space-y-6">
        {paymentBypass ? (
          <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs text-[var(--muted-strong)]">
            {t('accountBypassNote')}
          </p>
        ) : null}

        <Section title={t('accountProfile')}>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                {t('authName')}
              </span>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                {t('accountEmail')}
              </span>
              <input
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={savingProfile} className="btn-accent">
                {savingProfile ? t('accountSaving') : t('accountSaveChanges')}
              </button>
              {profileMsg ? <span className="text-sm text-[var(--muted)]">{profileMsg}</span> : null}
            </div>
          </form>
          <p className="mt-4 text-xs text-[var(--muted-strong)]">
            {t('accountLanguage')}: {locale.nativeName} — {t('accountLanguageHint')}
          </p>
        </Section>

        <Section title={t('accountBilling')}>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-[var(--muted-strong)]">{t('accountCurrentPlan')}</dt>
              <dd className="font-medium text-[var(--foreground)]">
                {PLAN_DETAILS[plan].name} — {PLAN_DETAILS[plan].priceLabel}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--muted-strong)]">{t('accountStatus')}</dt>
              <dd className="font-medium text-[var(--foreground)]">
                {subscriptionActive ? t('accountStatusActive') : t('accountStatusInactive')}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[var(--muted-strong)]">{t('creditsBalance')}</dt>
              <dd className="font-medium text-[var(--foreground)]">
                {coreTokens != null ? t('creditsCount', { count: formatCreditsDisplay(coreTokens) }) : '—'}
              </dd>
            </div>
          </dl>

          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
            {t('accountChoosePlan')}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PLANS.map((tier) => (
              <button
                key={tier}
                type="button"
                disabled={busy !== null || plan === tier}
                onClick={() => void handleSubscribe(tier)}
                className={`filter-pill px-4 py-2 ${plan === tier ? 'filter-pill-active' : ''}`}
              >
                {busy === `plan:${tier}`
                  ? t('accountProcessing')
                  : plan === tier
                    ? `${PLAN_DETAILS[tier].name} · ${t('accountCurrentPlan')}`
                    : t('accountSwitchToPlan', { plan: PLAN_DETAILS[tier].name })}
              </button>
            ))}
          </div>

          {subscriptionActive ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void handleCancel()}
              className="btn-ghost mt-4 text-xs"
            >
              {busy === 'cancel' ? t('accountProcessing') : t('accountCancelSubscription')}
            </button>
          ) : null}

          {canBuyCredits ? (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                {t('accountBuyCredits')}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">{t('accountBuyCreditsHint')}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {CREDIT_PACKS.map((pack) => (
                  <div
                    key={pack}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center"
                  >
                    <p className="text-2xl font-bold text-[var(--accent-credit)]">{pack}</p>
                    <p className="text-xs text-[var(--muted)]">{t('credits')}</p>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void handleBuyCredits(pack)}
                      className="btn-ghost mt-3 w-full text-xs"
                    >
                      {busy === `pack:${pack}` ? t('accountProcessing') : t('accountBuyPack', { count: pack })}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Section>

        <Section title={t('accountCreditHistory')}>
          {history.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t('accountCreditHistoryEmpty')}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {history.map((txn) => (
                <li key={txn.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-[var(--foreground)]">
                      {t(TXN_LABEL_KEYS[txn.type] as never)}
                    </p>
                    <p className="text-xs text-[var(--muted-strong)]">
                      {txn.description ?? ''} · {new Date(txn.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`font-semibold ${txn.amount >= 0 ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}
                  >
                    {txn.amount >= 0 ? '+' : ''}
                    {formatCreditsDisplay(txn.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t('accountChangePassword')}>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                {t('authCurrentPassword')}
              </span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[var(--muted-strong)]">
                {t('authNewPassword')}
              </span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <div className="flex items-center gap-3">
              <button type="submit" disabled={savingPw} className="btn-accent">
                {savingPw ? t('accountSaving') : t('accountUpdatePassword')}
              </button>
              {pwMsg ? <span className="text-sm text-[var(--muted)]">{pwMsg}</span> : null}
            </div>
          </form>
        </Section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => void handleLogout()} className="btn-ghost">
            {t('accountLogout')}
          </button>
        </div>

        <Section title={t('accountDangerZone')}>
          <p className="text-sm text-[var(--muted)]">{t('accountDeleteHint')}</p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void handleDelete()}
            className="btn-ghost mt-4 border border-[var(--danger,#f87171)] text-[var(--danger,#f87171)]"
          >
            {busy === 'delete' ? t('accountProcessing') : t('accountDeleteAccount')}
          </button>
        </Section>
      </div>
    </PageShell>
  )
}
