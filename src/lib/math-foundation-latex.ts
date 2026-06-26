/**
 * KaTeX treats `&` as an column separator even inside `\text{...}` in aligned blocks.
 * Escape bare ampersands in `\text{}` so LLM-generated step labels render correctly.
 */
export function sanitizeMathFoundationLatex(latex: string): string {
  return latex.replace(/\\text\{([^}]*)\}/g, (_match, inner: string) => {
    const escaped = inner.replace(/(?<!\\)&/g, '\\&')
    return `\\text{${escaped}}`
  })
}
