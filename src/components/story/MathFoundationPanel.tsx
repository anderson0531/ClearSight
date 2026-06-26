'use client'

import { useEffect, useRef } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { sanitizeMathFoundationLatex } from '@/lib/math-foundation-latex'
import type { MathFoundationNode } from '@/types/story'
import { useTranslations } from '@/i18n/I18nProvider'

interface MathFoundationPanelProps {
  node: MathFoundationNode
  visible?: boolean
}

export function MathFoundationPanel({ node, visible = true }: MathFoundationPanelProps) {
  const t = useTranslations()
  const formulaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!formulaRef.current || !node.latex) return
    const latex = sanitizeMathFoundationLatex(node.latex)
    try {
      katex.render(latex, formulaRef.current, {
        throwOnError: false,
        displayMode: true,
      })
    } catch {
      formulaRef.current.textContent = node.latex
    }
  }, [node.latex])

  if (!visible) return null

  return (
    <aside
      className="fade-in mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg shadow-black/20"
      aria-label={node.label}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
        {t('patternMatrixFoundationLabel')}
      </p>
      <h3 className="text-sm font-semibold text-[var(--foreground)]">{node.label}</h3>
      <div
        ref={formulaRef}
        className="mt-3 overflow-x-auto rounded-lg bg-black/25 px-3 py-4 text-center text-[var(--foreground)]"
      />
      {node.variables?.length ? (
        <dl className="mt-3 space-y-1.5 text-xs text-[var(--muted-strong)]">
          {node.variables.map((variable) => (
            <div key={variable.symbol} className="flex gap-2">
              <dt className="font-mono font-semibold text-[var(--foreground)]">{variable.symbol}</dt>
              <dd>{variable.description}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {node.computedExample ? (
        <p className="mt-3 text-xs leading-relaxed text-[var(--muted-strong)]">{node.computedExample}</p>
      ) : null}
    </aside>
  )
}
