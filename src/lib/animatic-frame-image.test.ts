import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import type { ImagenGenerateResult } from '@/lib/vertex'
import { generateAnimaticFrameWithFallbacks } from '@/lib/animatic-frame-image'

const params = {
  leanPrompt: 'Photorealistic editorial photograph of a coach explaining strategy on a basketball court.',
  sceneCore: 'Coach explaining strategy on a basketball court with players listening attentively.',
  hadRefs: true,
  frameIndex: 0,
  title: 'Test frame title',
}

describe('renderAnimaticFrameImage fallback guard', () => {
  it('skips subject-ref and scene-core fallbacks on quota errors', async () => {
    const generateMock = mock.fn(async () => ({
      buffer: null,
      model: 'imagen-4.0-generate-001',
      usedSubjectRefs: true,
      httpStatus: 429,
      error: 'rate limited',
    } satisfies ImagenGenerateResult))

    await generateAnimaticFrameWithFallbacks(generateMock, params)

    assert.equal(generateMock.mock.callCount(), 1)
  })

  it('runs fallback chain for non-quota failures when refs were provided', async () => {
    const generateMock = mock.fn(async () => ({
      buffer: null,
      model: 'imagen-3.0-capability-001',
      usedSubjectRefs: true,
      error: 'empty_prediction',
    } satisfies ImagenGenerateResult))

    await generateAnimaticFrameWithFallbacks(generateMock, params)

    assert.equal(generateMock.mock.callCount(), 3)
  })
})
