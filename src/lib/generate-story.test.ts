import assert from 'node:assert/strict'
import test from 'node:test'
import { buildEpisodePreparedLines } from '@/lib/generate-story'
import { MUSIC_ASSETS } from '@/lib/music-assets'
import { PATTERN_MATRIX_SHOW_ID } from '@/lib/scene-flow-lite'
import type { Show } from '@/lib/shows'

const mockShow = {
  id: PATTERN_MATRIX_SHOW_ID,
  generationProfile: 'sceneFlowLite',
  contentType: 'Education',
  studioImage: '/hosts/studio.png',
  hosts: [
    { name: 'Amara Vance', voiceId: 'amara', aliases: ['amara'], role: 'host', persona: '', bio: '', ttsStylePrompt: '', speakingRate: 1 },
    { name: 'Malik Al-Jamil', voiceId: 'malik', aliases: ['malik'], role: 'host', persona: '', bio: '', ttsStylePrompt: '', speakingRate: 1 },
  ],
} as unknown as Show

test('buildEpisodePreparedLines routes music-only turns to role music without TTS text', () => {
  const lines = buildEpisodePreparedLines(
    {
      directorNotes: '',
      wordCount: 10,
      turns: [
        {
          speaker: 'Amara Vance',
          text: '',
          segmentKind: 'music',
          role: 'music',
          musicCue: 'chapter-sting',
          musicDurationSeconds: 3,
        },
        {
          speaker: 'Amara Vance',
          text: '[curious] What if two strangers could agree on a secret color?',
          segmentKind: 'dialogue',
          role: 'body',
          scene: 'Two researchers at a chalkboard covered in color swatches.',
          sceneId: 'lab-bench',
        },
      ],
    },
    {
      title: 'Diffie-Hellman',
      language: 'English',
      category: 'Science',
      contentType: 'Education',
      geoScope: 'Worldwide',
    },
    mockShow
  )

  assert.equal(lines.length, 2)
  assert.equal(lines[0]?.role, 'music')
  assert.equal(lines[0]?.text, '')
  assert.equal(lines[0]?.musicBedUrl, MUSIC_ASSETS.sting?.url)
  assert.equal(lines[1]?.role, 'body')
  assert.equal(lines[1]?.illustrationGroupId, 'scene:lab-bench')
})
