'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface TruthLedgerProps {
  markdown: string
}

export function TruthLedger({ markdown }: TruthLedgerProps) {
  return (
    <article className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="mb-4 mt-8 border-b border-[var(--border)] pb-2 text-xl font-bold uppercase tracking-wide text-[var(--foreground)]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-3 mt-6 text-sm font-bold uppercase tracking-widest text-[var(--accent)]">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-4 text-sm leading-relaxed text-[var(--muted)]">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">{children}</ul>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-[var(--foreground)]">{children}</strong>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#c7cff0] underline decoration-[var(--accent)]/40 underline-offset-2 hover:text-[var(--foreground)]"
            >
              {children}
            </a>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
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
