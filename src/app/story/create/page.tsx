'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TruthLedger } from '@/components/truth/TruthLedger'
import { BriefingGenerationOverlay } from '@/components/story/BriefingGenerationOverlay'
import { StoryPageHeader } from '@/components/story/StoryPageHeader'
import { StageProgress } from '@/components/ui/StageProgress'
import { consumePendingGeneration, type PendingGeneration } from '@/lib/generation-session'
import { runBriefingGeneration, type GenStage } from '@/lib/run-generation'
import { removeUserTopicByTitle } from '@/lib/user-topics'
import { useTranslations } from '@/i18n/I18nProvider'
import type { AudioSegment } from '@/types/story'
import type { MessageKey } from '@/i18n/messages/en'

const GEN_STAGE_ANCHOR: Record<GenStage, number> = {
  analysis: 6,
  draft: 32,
  editorial: 38,
  podcast: 58,
  saving: 94,
  done: 100,
}

const GEN_STAGE_CAP: Record<GenStage, number> = {
  analysis: 30,
  draft: 35,
  editorial: 55,
  podcast: 90,
  saving: 98,
  done: 100,
}

const GEN_STAGE_LABELS: Record<string, MessageKey> = {
  analysis: 'progressAnalysis',
  draft: 'progressAnalysis',
  editorial: 'progressEditorial',
  podcast: 'progressPodcast',
  saving: 'progressSaving',
  done: 'progressSaving',
}

function countSources(markdown: string): number {
  const matches = markdown.match(/^-\s+/gm)
  return matches?.length ?? 0
}

function geoLabelFromParams(params: PendingGeneration): string {
  return (
    params.geoLocal ??
    params.geoState ??
    params.geoCountry ??
    params.geoRegion ??
    params.geoScope
  )
}

export default function BriefingCreatePage() {
  const router = useRouter()
  const t = useTranslations()
  const started = useRef(false)
  const consumed = useRef(false)

  const [params, setParams] = useState<PendingGeneration | null>(null)
  const [showOverlay, setShowOverlay] = useState(true)
  const [markdown, setMarkdown] = useState<string | null>(null)
  const [storyId, setStoryId] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioSegments, setAudioSegments] = useState<AudioSegment[] | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null)
  const [reliabilityIndex, setReliabilityIndex] = useState<number | null>(null)
  const [genStage, setGenStage] = useState<GenStage | null>('analysis')
  const [genPercent, setGenPercent] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [audioMissing, setAudioMissing] = useState(false)
  const [backgroundWork, setBackgroundWork] = useState(false)

  useEffect(() => {
    // Consume exactly once. consumePendingGeneration() clears sessionStorage, so
    // a second effect run (e.g. React StrictMode in dev) would otherwise find
    // nothing and bounce the user back to the home screen mid-generation.
    if (consumed.current) return
    consumed.current = true

    const pending = consumePendingGeneration()
    if (!pending) {
      router.replace('/')
      return
    }
    setParams(pending)
  }, [router])

  useEffect(() => {
    if (!genStage || genStage === 'done' || !backgroundWork) return
    const cap = GEN_STAGE_CAP[genStage]
    const id = setInterval(() => {
      setGenPercent((prev) =>
        prev >= cap ? prev : Math.min(cap, prev + Math.max(0.4, (cap - prev) * 0.06))
      )
    }, 450)
    return () => clearInterval(id)
  }, [genStage, backgroundWork])

  const startGeneration = useCallback(async (pending: PendingGeneration) => {
    setErrorMessage(null)
    setGenStage('analysis')
    setGenPercent(0)
    setShowOverlay(true)
    setBackgroundWork(false)

    const generated = await runBriefingGeneration(pending, {
      onProgress: (stage, percent) => {
        setGenStage(stage)
        setGenPercent((prev) => Math.max(prev, GEN_STAGE_ANCHOR[stage] ?? prev, percent))
        if (stage !== 'analysis' && stage !== 'draft') {
          setBackgroundWork(true)
        }
      },
      onDraft: (story) => {
        setStoryId(story.id)
        setMarkdown(story.markdownContent)
        setThumbnailUrl(story.thumbnailUrl)
        setShowOverlay(false)
        setBackgroundWork(true)
      },
      onDone: (story) => {
        setStoryId(story.id)
        if (story.markdownContent) setMarkdown(story.markdownContent)
        setAudioUrl(story.audioUrl)
        setAudioSegments((story.audioSegments as AudioSegment[] | null) ?? null)
        setThumbnailUrl(story.thumbnailUrl)
        setDurationSeconds(story.durationSeconds)
        setReliabilityIndex(story.reliabilityIndex)
        setGenStage('done')
        setGenPercent(100)
        setBackgroundWork(false)
        removeUserTopicByTitle(pending.title)
        // Audio is best-effort: only treat this as a clean success (and hand off
        // to the permanent briefing page) when audio actually rendered. When it
        // didn't, stay here and surface it instead of silently redirecting.
        if (story.audioUrl) {
          router.replace(`/story/${story.id}`)
        } else {
          setAudioMissing(true)
        }
      },
      onError: (message) => {
        setErrorMessage(message)
        setShowOverlay(false)
        setBackgroundWork(false)
      },
    })

    if (!generated) {
      setShowOverlay(false)
    }
  }, [router])

  useEffect(() => {
    if (!params || started.current) return
    started.current = true
    void startGeneration(params)
  }, [params, startGeneration])

  if (!params) {
    return null
  }

  const sourcesCount = markdown ? countSources(markdown) : 0

  return (
    <div className="min-h-screen bg-[var(--background)] pb-28">
      {showOverlay ? (
        <BriefingGenerationOverlay stage={genStage} percent={genPercent} title={params.title} />
      ) : null}

      <StoryPageHeader
        id={storyId ?? 'creating'}
        title={params.title}
        category={params.category}
        geoLabel={geoLabelFromParams(params)}
        reliabilityIndex={reliabilityIndex}
        durationSeconds={durationSeconds}
        sourcesCount={sourcesCount}
        audioUrl={audioUrl}
        audioSegments={audioSegments}
        thumbnailUrl={thumbnailUrl}
      />

      <main className="fade-in mx-auto max-w-3xl px-4 py-8">
        {errorMessage ? (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <p>{errorMessage}</p>
            <Link href="/" className="mt-2 inline-block text-[var(--accent)] hover:underline">
              ← {t('backToDiscover')}
            </Link>
          </div>
        ) : null}

        {audioMissing && !errorMessage ? (
          <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            <p className="font-semibold">{t('audioFailedTitle')}</p>
            <p className="mt-1 text-amber-200/90">{t('audioFailedBody')}</p>
            {storyId ? (
              <Link
                href={`/story/${storyId}`}
                className="mt-2 inline-block text-[var(--accent)] hover:underline"
              >
                {t('viewBriefing')} →
              </Link>
            ) : null}
          </div>
        ) : null}

        {backgroundWork ? (
          <StageProgress
            t={t}
            stage={genStage}
            percent={genPercent}
            stageLabels={GEN_STAGE_LABELS}
            fallbackLabel="creatingBriefing"
            className="mb-6"
          />
        ) : null}

        {markdown ? (
          <TruthLedger markdown={markdown} />
        ) : !errorMessage ? (
          <div className="glass-panel rounded-xl p-8 text-center text-sm text-[var(--muted-strong)]">
            {t('creatingBriefing')}
          </div>
        ) : null}
      </main>
    </div>
  )
}
