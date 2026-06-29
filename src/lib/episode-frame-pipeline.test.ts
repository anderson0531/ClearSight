import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { finalizePatternMatrixEpisodeSegments } from '@/lib/pattern-matrix-episode-audio'
import { buildEpisodeOutroSegment } from '@/lib/generate-story'
import { showById } from '@/lib/shows'
import {
  buildEpisodeFramePlan,
  buildGroupImageCache,
  frameLineNeedsIllustration,
  isFrameSegmentComplete,
  type EpisodeFramePlanLine,
} from '@/lib/episode-frame-pipeline'
import type { CompiledBrief } from '@/lib/generate-story'
import type { AudioSegment } from '@/types/story'

function sampleBrief(): CompiledBrief {
  return {
    storyId: 'story-1',
    episodeScript: {
      directorNotes: 'Calm, precise delivery.',
      wordCount: 40,
      turns: [
        {
          speaker: 'Amara Vance',
          text: 'How can two parties agree on a secret key without transmitting it?',
          role: 'body',
          illustrate: true,
        },
        {
          speaker: 'Malik Okonkwo',
          text: 'They use modular arithmetic on a shared prime modulus.',
          role: 'body',
          illustrate: true,
        },
      ],
    },
    context: {
      markdownContent: '# Brief',
      taxonomyKey: 'k',
      topicKey: 't',
      compiledAt: new Date().toISOString(),
      podcastType: 'Education',
      podcastFormat: 'educational',
      showMeta: {
        showId: 'clearsight-math',
        showName: 'Pattern Matrix',
        showFormat: 'dialogue',
        hosts: [],
      },
      sources: [],
      reliabilityIndex: 8,
      thumbnailUrl: '/thumb.png',
      scriptRevised: false,
      resolvedInput: {
        userId: 'u1',
        generationId: 'g1',
        title: 'Secure Key Exchange',
        language: 'English',
        category: 'Science & Technology',
        contentType: 'Education',
        geoScope: 'Worldwide',
      },
      seedQuestions: [],
      visualSubjectBible: null,
    },
  }
}

describe('episode-frame-pipeline', () => {
  it('buildEpisodeFramePlan derives PM lines from dialogue-only script', () => {
    const plan = buildEpisodeFramePlan(sampleBrief())
    assert.ok(plan)
    assert.equal(plan!.lines.length, 2)
    assert.match(plan!.lines[0]!.imagePrompt ?? '', /Create an engaging and cinematic image that effectively illustrates/)
    assert.equal(plan!.lines[0]!.illustrationGroupId, 't0')
    assert.equal(plan!.lines[1]!.illustrationGroupId, 't1')
  })

  it('buildGroupImageCache maps illustration groups to blob URLs', () => {
    const segments: AudioSegment[] = [
      {
        url: 'https://audio/1.mp3',
        durationSeconds: 8,
        illustrationGroupId: 't0',
        imageUrl: 'https://blob/frame-0.png',
        role: 'body',
      },
      {
        url: 'https://audio/2.mp3',
        durationSeconds: 8,
        illustrationGroupId: 't0',
        imageUrl: 'https://blob/frame-0.png',
        role: 'body',
      },
    ]
    const cache = buildGroupImageCache(segments)
    assert.equal(cache.get('t0'), 'https://blob/frame-0.png')
  })

  it('isFrameSegmentComplete requires audio and illustration for body frames', () => {
    const line: EpisodeFramePlanLine = {
      speaker: 'Amara Vance',
      text: 'Secret key agreement without transmission.',
      role: 'body',
      imageUrl: null,
      imagePrompt:
        'Create an engaging and cinematic image that effectively illustrates Secret key agreement without transmission.',
      scene:
        'Create an engaging and cinematic image that effectively illustrates Secret key agreement without transmission.',
      frameKind: 'scene',
      musicMood: null,
      illustrationGroupId: 't0',
      titleSlide: false,
    }
    assert.equal(isFrameSegmentComplete(line, null), false)
    assert.equal(
      isFrameSegmentComplete(line, {
        url: 'https://audio/1.mp3',
        durationSeconds: 8,
        role: 'body',
      }),
      false
    )
    assert.equal(
      isFrameSegmentComplete(line, {
        url: 'https://audio/1.mp3',
        durationSeconds: 8,
        role: 'body',
        imageUrl: 'https://blob/frame.png',
      }),
      true
    )
  })

  it('frameLineNeedsIllustration skips host-framed lines', () => {
    const hostLine: EpisodeFramePlanLine = {
      speaker: 'Amara Vance',
      text: 'Welcome back.',
      role: 'body',
      imageUrl: null,
      imagePrompt: null,
      frameKind: 'host',
      musicMood: null,
      illustrationGroupId: null,
      titleSlide: false,
    }
    assert.equal(frameLineNeedsIllustration(hostLine), false)
  })

  it('finalize prepends PM opening and tags music on dialogue frames', () => {
    const show = showById('clearsight-math')
    assert.ok(show)

    const body: AudioSegment[] = [
      {
        url: 'https://audio/dialogue.mp3',
        durationSeconds: 12,
        text: 'Modular arithmetic on a prime modulus.',
        role: 'body',
        imageUrl: 'https://blob/frame.png',
      },
    ]

    const segments = finalizePatternMatrixEpisodeSegments(body)
    segments.push(buildEpisodeOutroSegment(show))

    assert.match(segments[0]!.videoUrl ?? '', /clearsight-math-opening-hosts/)
    assert.equal(segments[0]!.musicVolumeRatio, 1)
    assert.equal(segments[1]!.musicVolumeRatio, 0.2)
    assert.equal(segments[2]!.hostsVideoBookend, 'closing')
    assert.equal(segments[2]!.musicVolumeRatio, 1)
    assert.equal(segments[3]!.role, 'music')
  })
})
