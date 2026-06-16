'use client'

import { PageShell } from '@/components/layout/PageShell'
import { useTranslations } from '@/i18n/I18nProvider'

export default function HowItWorksPage() {
  const t = useTranslations()

  const steps = [
    { title: t('howStep1Title'), body: t('howStep1Body') },
    { title: t('howStep2Title'), body: t('howStep2Body') },
    { title: t('howStep3Title'), body: t('howStep3Body') },
  ]

  return (
    <PageShell title={t('howTitle')}>
      <ol className="space-y-6">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="flex gap-4 rounded-xl border border-[var(--border)] bg-white/[0.03] p-5 sm:p-6"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-muted)] text-sm font-bold text-[#c7cff0]">
              {index + 1}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </PageShell>
  )
}
