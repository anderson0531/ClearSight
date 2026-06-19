'use client'

import { useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from '@/i18n/I18nProvider'
import { splitBriefingMarkdown } from '@/lib/briefing-sections'

interface TruthLedgerProps {
  markdown: string
}

const markdownComponents = {
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="mb-4 mt-8 border-b border-[var(--border)] pb-2 text-xl font-bold uppercase tracking-wide text-[var(--foreground)]">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="mb-3 mt-6 text-sm font-bold uppercase tracking-widest text-[var(--accent)]">
      {children}
    </h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">{children}</ul>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-[var(--foreground)]">{children}</strong>
  ),
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#c7cff0] underline decoration-[var(--accent)]/40 underline-offset-2 hover:text-[var(--foreground)]"
    >
      {children}
    </a>
  ),
}

function MarkdownBody({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  )
}

function CollapsibleBriefingSection({
  title,
  body,
  defaultOpen = false,
}: {
  title: string
  body: string
  defaultOpen?: boolean
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="briefing-collapsible-section">
      <div className="briefing-section-header">
        <h3 className="mb-0 mt-6 text-sm font-bold uppercase tracking-widest text-[var(--accent)]">
          {title}
        </h3>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="briefing-section-toggle"
          aria-expanded={open}
        >
          {open ? (
            <>
              {t('briefingHideSection', { section: title })}
              <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              {t('briefingShowSection', { section: title })}
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
      {open && body ? <MarkdownBody content={body} /> : null}
    </section>
  )
}

export function TruthLedger({ markdown }: TruthLedgerProps) {
  const { preamble, sections } = splitBriefingMarkdown(markdown)

  if (sections.length === 0) {
    return (
      <article className="prose prose-invert max-w-none">
        <MarkdownBody content={markdown} />
      </article>
    )
  }

  return (
    <article className="prose prose-invert max-w-none">
      {preamble ? <MarkdownBody content={preamble} /> : null}
      {sections.map((section, index) => (
        <CollapsibleBriefingSection
          key={`${section.title}-${index}`}
          title={section.title}
          body={section.body}
        />
      ))}
    </article>
  )
}

export const TRUTH_LEDGER_TEMPLATE = `## [ SYSTEMIC TOPIC TITLE ]

**The Objective Brief:** Clear, fact-dense narrative overview fully stripped of emotional adjectives and partisan buzzwords.

### THE TRUTH LEDGER

**Sources Verified:**
- Raw tracking manifest or institutional ledger reference
- Legal transcript or physical infrastructure asset record

**Reliability Index:** 8.5

### ANALYTICAL INSIGHT

Highly clinical deductive breakdown mapping long-term **Impact**, logistical **Forecast**, and structural **Systemic Implications** of the story.
`
