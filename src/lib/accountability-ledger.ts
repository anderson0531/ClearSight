import { prisma } from './db'
import { vertexGenerateGrounded } from './vertex'
import type { PodcastClaim } from './generate-story'

export interface BrierEvaluationResult {
  /** The intuitive 0-100 score based on Brier Score. 100 means perfect prediction. */
  accuracyScore: number
  /** Context to inject into the new episode's intro explaining the variance (if any). */
  correctionContext: string | null
}

export async function evaluatePreviousClaims(
  originalStoryId: string,
  newGroundTruthMarkdown: string
): Promise<BrierEvaluationResult | null> {
  const originalStory = await prisma.story.findUnique({
    where: { id: originalStoryId },
    select: { sourcesVerified: true },
  })

  if (!originalStory || !originalStory.sourcesVerified) {
    return null
  }

  const sources = originalStory.sourcesVerified as any
  const claims = sources.claims as PodcastClaim[] | undefined

  if (!claims || !Array.isArray(claims) || claims.length === 0) {
    return null
  }

  // Evaluate claims against new ground truth
  const evaluationsPrompt = `We have new reporting on a topic, and need to evaluate previously made forecasts.
New Ground Truth Reporting:
${newGroundTruthMarkdown.slice(0, 4000)}

Please evaluate each of the following past claims based on the NEW reporting above.
For each claim, determine if the new reporting confirms the event occurred (1), did not occur (0), or if it is still unknown/ambiguous based solely on the text (0.5).

Claims to evaluate:
${claims
  .map(
    (c, i) =>
      `[${i}] Claim ID: ${c.claim_id}\nAssertion: ${c.assertion}\nAssigned Probability: ${c.assigned_probability}`
  )
  .join('\n\n')}

Output a JSON array of objects, one for each claim, containing:
- "claim_id": The exact claim_id.
- "outcome": The numeric outcome (1, 0, or 0.5).
- "reasoning": A brief 1-sentence explanation of why, referencing the new text.

Output ONLY the JSON array.
`

  const evalRaw = await vertexGenerateGrounded(evaluationsPrompt, {
    temperature: 0.1, // Keep it factual
    maxOutputTokens: 2048,
    useSearchGrounding: false,
  })

  if (!evalRaw.text) {
    return null
  }

  // Parse evaluations
  let parsedEvals: Array<{ claim_id: string; outcome: number; reasoning: string }> = []
  try {
    const text = evalRaw.text.replace(/```json/gi, '').replace(/```/g, '')
    const start = text.indexOf('[')
    if (start !== -1) {
      const whole = text.slice(start)
      parsedEvals = JSON.parse(whole)
    }
  } catch (err) {
    console.error('[accountability-ledger] Failed to parse claims evaluations:', err)
    return null
  }

  if (!Array.isArray(parsedEvals) || parsedEvals.length === 0) {
    return null
  }

  // Calculate Brier Score
  let sumSquaredError = 0
  let validEvaluations = 0
  const evaluationContexts: string[] = []

  for (const claim of claims) {
    const ev = parsedEvals.find((e) => e.claim_id === claim.claim_id)
    if (ev && typeof ev.outcome === 'number') {
      const f = claim.assigned_probability
      const o = ev.outcome
      sumSquaredError += Math.pow(f - o, 2)
      validEvaluations++
      evaluationContexts.push(`- Claim: "${claim.assertion}"\n  Prior Confidence: ${Math.round(f * 100)}%\n  Outcome: ${o === 1 ? 'Occurred' : o === 0 ? 'Did not occur' : 'Ambiguous'}\n  Reasoning: ${ev.reasoning}`)
    }
  }

  if (validEvaluations === 0) {
    return null
  }

  const brierScore = sumSquaredError / validEvaluations

  // Brier score ranges from 0 (perfect) to 1 (perfectly wrong). 
  // Let's map it to an intuitive 0-100% "Accuracy Score"
  // BS = 0 => 100%
  // BS = 1 => 0%
  const accuracyScore = Math.max(0, Math.min(100, Math.round((1 - brierScore) * 100)))

  // Generate correction context if there's significant variance (BS > 0.05 or something, meaning not perfect)
  let correctionContext: string | null = null
  if (brierScore > 0.05) {
    const contextPrompt = `Based on the variance between our past forecasts and the new reality, please write a brief (1-2 sentence) explanation of what shifted. 
This will be used to guide the podcast hosts in acknowledging the change.

Evaluations:
${evaluationContexts.join('\n\n')}

Accuracy Score Shift: We are adjusting our overall confidence matrix down to a ${accuracyScore}% state.
Provide a concise narrative "correction context" string. Only output the text.`

    const contextRaw = await vertexGenerateGrounded(contextPrompt, {
      temperature: 0.4,
      maxOutputTokens: 1024,
      useSearchGrounding: false,
    })
    
    correctionContext = contextRaw.text?.trim() ?? null
  } else {
      correctionContext = "Our previous confidence tracking matrix successfully predicted the current state. The underlying dynamics held steady."
  }

  return {
    accuracyScore,
    correctionContext,
  }
}