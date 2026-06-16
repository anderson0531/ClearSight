import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  reviewBriefing,
  reviewPodcastScript,
  type PodcastScriptDraft,
} from '@/lib/editorial-review'
import type { GroundedSource } from '@/lib/vertex'
import { HOST_ANDERSON, HOST_SARAH } from '@/lib/hosts'

const sourceSchema = z.object({
  title: z.string(),
  uri: z.string(),
  domain: z.string(),
})

const briefingSchema = z.object({
  type: z.literal('briefing'),
  title: z.string().min(3).max(200),
  language: z.string().min(1),
  category: z.string().min(1),
  geoScope: z.string().min(1),
  markdown: z.string().min(20),
  sources: z.array(sourceSchema).default([]),
  reliabilityIndex: z.number().min(1).max(10).default(5),
})

const podcastTurnSchema = z.object({
  speaker: z.string().min(1),
  text: z.string().min(1),
})

const podcastSchema = z.object({
  type: z.literal('podcast'),
  title: z.string().min(3).max(200),
  language: z.string().min(1),
  category: z.string().optional(),
  markdown: z.string().min(20),
  script: z.object({
    directorNotes: z.string().min(1),
    turns: z.array(podcastTurnSchema).min(4),
    wordCount: z.number().optional(),
  }),
  hostA: z.string().optional(),
  hostB: z.string().optional(),
})

const reviewSchema = z.discriminatedUnion('type', [briefingSchema, podcastSchema])

const HOST_A = HOST_SARAH.name
const HOST_B = HOST_ANDERSON.name
const HOST_A_ALIASES = HOST_SARAH.aliases
const HOST_B_ALIASES = HOST_ANDERSON.aliases

function parsePodcastScript(raw: string): PodcastScriptDraft | null {
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  let directorNotes =
    'Scene: modern news studio podcast. Tone: engaging, authoritative, conversational deep-dive. Pace: natural with thoughtful pauses.'

  const directorIdx = lines.findIndex((l) => l.toUpperCase().startsWith('DIRECTOR_NOTES:'))
  if (directorIdx >= 0) {
    directorNotes = lines[directorIdx].replace(/^DIRECTOR_NOTES:\s*/i, '').trim()
    lines.splice(directorIdx, 1)
  }

  const turns: PodcastScriptDraft['turns'] = []
  const speakerPattern = /^([^:]{1,48}):\s*(.+)$/

  for (const line of lines) {
    const match = line.match(speakerPattern)
    if (!match) continue
    const label = match[1].toLowerCase()
    let speaker: string | null = null
    if (HOST_A_ALIASES.some((alias) => label.includes(alias))) speaker = HOST_A
    else if (HOST_B_ALIASES.some((alias) => label.includes(alias))) speaker = HOST_B
    if (!speaker) continue
    turns.push({ speaker, text: match[2].trim() })
  }

  if (turns.length < 4) return null

  return {
    directorNotes: directorNotes.slice(0, 380),
    turns,
    wordCount: turns.reduce((sum, turn) => sum + turn.text.split(/\s+/).length, 0),
  }
}

function trimScriptToLimits(script: PodcastScriptDraft): PodcastScriptDraft {
  let { directorNotes, turns } = script
  const maxPromptBytes = 4000
  const maxMarkupBytes = 4000
  const maxCombined = 8000

  const byteLength = (value: string) => Buffer.byteLength(value, 'utf8')
  directorNotes = directorNotes.slice(0, maxPromptBytes)

  while (turns.length > 4) {
    const markupJson = JSON.stringify({ turns })
    if (
      byteLength(markupJson) <= maxMarkupBytes &&
      byteLength(directorNotes) + byteLength(markupJson) <= maxCombined
    ) {
      break
    }
    turns = turns.slice(0, -1)
  }

  const wordCount = turns.reduce((sum, turn) => sum + turn.text.split(/\s+/).length, 0)
  return { directorNotes, turns, wordCount }
}

export async function POST(request: Request) {
  try {
    const body = reviewSchema.parse(await request.json())

    if (body.type === 'briefing') {
      const result = await reviewBriefing({
        title: body.title,
        language: body.language,
        category: body.category,
        geoScope: body.geoScope,
        markdown: body.markdown,
        sources: body.sources as GroundedSource[],
        reliabilityIndex: body.reliabilityIndex,
      })

      return NextResponse.json({
        success: true,
        type: 'briefing',
        revised: result.revised,
        markdown: result.markdown,
        sources: result.sources,
        reliabilityIndex: result.reliabilityIndex,
      })
    }

    const script: PodcastScriptDraft = {
      directorNotes: body.script.directorNotes,
      turns: body.script.turns,
      wordCount:
        body.script.wordCount ??
        body.script.turns.reduce((sum, turn) => sum + turn.text.split(/\s+/).length, 0),
    }

    const result = await reviewPodcastScript(
      {
        title: body.title,
        language: body.language,
        category: body.category,
        markdown: body.markdown,
        script,
        hostA: body.hostA,
        hostB: body.hostB,
      },
      parsePodcastScript,
      trimScriptToLimits
    )

    return NextResponse.json({
      success: true,
      type: 'podcast',
      revised: result.revised,
      script: result.script,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request', details: err.flatten() }, { status: 400 })
    }
    console.error('[editorial]', err)
    return NextResponse.json({ error: 'Editorial review failed' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Editorial review endpoint ready.',
    usage: 'POST with type "briefing" or "podcast" and the draft content to review.',
  })
}
