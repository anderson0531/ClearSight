/** IQ-style knowledge score: 100 = median (half correct), SD ≈ 15, clamped 55–160. */
export function computeQuizKnowledgeScore(score: number, total: number): number {
  if (total <= 0) return 100
  const mean = total / 2
  const sd = Math.sqrt(total) / 2
  if (sd === 0) return 100
  const z = (score - mean) / sd
  const knowledgeScore = Math.round(100 + 15 * z)
  return Math.min(160, Math.max(55, knowledgeScore))
}
