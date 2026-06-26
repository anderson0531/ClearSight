import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import katex from 'katex'
import { sanitizeMathFoundationLatex } from '@/lib/math-foundation-latex'

const DIFFIE_HELLMAN = String.raw`\begin{aligned} \text{Public parameters:} & \quad p, g \\ \text{Alice's private:} & \quad a \\ \text{Bob's private:} & \quad b \\ \text{Alice computes & sends:} & \quad A = g^a \pmod{p} \\ \text{Bob computes & sends:} & \quad B = g^b \pmod{p} \\ \text{Alice computes secret:} & \quad S_A = B^a \pmod{p} \\ \text{Bob computes secret:} & \quad S_B = A^b \pmod{p} \\ \text{Shared Secret:} & \quad S = g^{ab} \pmod{p} \end{aligned}`

describe('sanitizeMathFoundationLatex', () => {
  it('escapes ampersands inside \\text{} for aligned environments', () => {
    const sanitized = sanitizeMathFoundationLatex(DIFFIE_HELLMAN)
    assert.match(sanitized, /\\text\{Alice computes \\& sends:\}/)
    assert.doesNotThrow(() => {
      katex.renderToString(sanitized, { displayMode: true, throwOnError: true })
    })
  })

  it('leaves ampersands outside \\text{} as column separators', () => {
    const latex = String.raw`\begin{aligned} x & = 1 \\ y & = 2 \end{aligned}`
    assert.equal(sanitizeMathFoundationLatex(latex), latex)
  })
})
