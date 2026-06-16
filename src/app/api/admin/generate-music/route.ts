import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { audioDurationSeconds, trimWavSeconds } from '@/lib/audio-duration'
import { vertexGenerateMusic } from '@/lib/vertex'

const MUSIC_SPECS = [
  {
    key: 'intro' as const,
    pathname: 'clearsight/music/theme-intro.wav',
    prompt:
      'Confident premium news network theme sting, 5 seconds, modern orchestral with subtle electronic pulse, indigo and slate tones, uplifting broadcast opener, instrumental only, no vocals',
    negativePrompt: 'vocals, lyrics, speech, dissonant, chaotic',
    seed: 42001,
    targetSeconds: 5,
    fallbackDuration: 5,
  },
  {
    key: 'sting' as const,
    pathname: 'clearsight/music/chapter-sting.wav',
    prompt:
      'Subtle electronic chapter transition sweep, 2 seconds, clean news podcast reset cue, minimal and professional, instrumental only',
    negativePrompt: 'vocals, lyrics, long, noisy, harsh',
    seed: 42002,
    targetSeconds: 2.5,
    fallbackDuration: 3,
  },
  {
    key: 'outro' as const,
    pathname: 'clearsight/music/theme-outro.wav',
    prompt:
      'ClearSight brand outro theme, 6 seconds, warm resolving orchestral news bed fading to silence, professional and authoritative, instrumental only',
    negativePrompt: 'vocals, lyrics, abrupt, dissonant',
    seed: 42003,
    targetSeconds: 6,
    fallbackDuration: 6,
  },
] as const

function isAuthorized(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization')
  if (header === `Bearer ${secret}`) return true
  return request.headers.get('x-admin-secret') === secret
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN not configured' }, { status: 503 })
  }

  const results = await Promise.all(
    MUSIC_SPECS.map(async (spec) => {
      const buffer = await vertexGenerateMusic(spec.prompt, {
        negativePrompt: spec.negativePrompt,
        seed: spec.seed,
      })

      if (!buffer) {
        return { key: spec.key, error: 'Lyria generation failed' }
      }

      const trimmed = trimWavSeconds(buffer, spec.targetSeconds)

      const blob = await put(spec.pathname, trimmed, {
        access: 'public',
        contentType: 'audio/wav',
        addRandomSuffix: false,
      })

      const durationSeconds =
        audioDurationSeconds(trimmed) ?? spec.fallbackDuration

      return {
        key: spec.key,
        url: blob.url,
        durationSeconds,
      }
    })
  )

  const failed = results.filter((item) => 'error' in item)
  if (failed.length > 0) {
    return NextResponse.json(
      {
        error: 'Some music assets failed to generate',
        results,
        manifestHint:
          'Paste successful entries into src/lib/music-assets.ts as MUSIC_ASSETS.intro/sting/outro',
      },
      { status: 502 }
    )
  }

  const intro = results.find((item) => item.key === 'intro')
  const sting = results.find((item) => item.key === 'sting')
  const outro = results.find((item) => item.key === 'outro')

  return NextResponse.json({
    message: 'Music assets uploaded. Paste into src/lib/music-assets.ts',
    MUSIC_ASSETS: {
      intro: intro && 'url' in intro ? { url: intro.url, durationSeconds: intro.durationSeconds } : null,
      sting: sting && 'url' in sting ? { url: sting.url, durationSeconds: sting.durationSeconds } : null,
      outro: outro && 'url' in outro ? { url: outro.url, durationSeconds: outro.durationSeconds } : null,
    },
    results,
  })
}

export async function GET() {
  return NextResponse.json({
    status: 'POST with Authorization: Bearer ADMIN_SECRET to generate reusable Lyria music assets',
  })
}
