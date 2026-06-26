/** Veo I2V clip length for Pattern Matrix intro dialog frames. */
export const PATTERN_MATRIX_INTRO_FRAME_VIDEO_DURATION_SECONDS = 8

/** Bump when blob MP4s are regenerated so the hero player bypasses CDN/browser cache. */
export const PATTERN_MATRIX_INTRO_FRAME_VIDEOS_REVISION = '20260625-pm-intro-v1'

export function patternMatrixIntroFrameVideoPlaybackUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  const separator = trimmed.includes('?') ? '&' : '?'
  return `${trimmed}${separator}v=${PATTERN_MATRIX_INTRO_FRAME_VIDEOS_REVISION}`
}

export interface PatternMatrixIntroFrameVideoClipSpec {
  videoPrompt: string
  dialogueExcerpt?: string
  videoUrl?: string
  /** Post-process effective duration (may exceed 8 when slowed). */
  durationSeconds?: number
}

export interface PatternMatrixIntroFrameVideoSpec {
  /** Scene mood / setting for all clips in this dialog frame. */
  scenePrompt: string
  animaticMovement?: string
  clips: PatternMatrixIntroFrameVideoClipSpec[]
}

/**
 * Per-dialog-line I2V specs for ClearSight Pattern Matrix intro (7 lines).
 * Index aligns with {@link PATTERN_MATRIX_INTRO_FRAME_IMAGES} in pattern-matrix-intro-images.ts.
 *
 * Overwritten by `npm run generate:pattern-matrix-intro-frame-videos`.
 */
export const PATTERN_MATRIX_INTRO_FRAME_VIDEOS: PatternMatrixIntroFrameVideoSpec[] = [
  {
    scenePrompt: `Abstract digital cityscape morphing into shimmering waveform mesh — glowing grid nexus expanding outward to reveal an interconnected minimalist landscape. Slow outward pull. No readable maps or labels.`,
    clips: [
    {
      videoPrompt: `Abstract digital cityscape morphing into shimmering waveform mesh — glowing grid nexus expanding outward to reveal an interconnected minimalist landscape. Slow outward pull. No readable maps or labels. Continuous subtle motion within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "Look around you. The layout of your city, the rhythm of your favorite song—it all follows a hidden architecture. Welcome to ClearSight Pattern Matrix.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-math-intro-frame-01-0.mp4",
      durationSeconds: 13.08,
    }
    ],
  },
  {
    scenePrompt: `High-contrast geometric origami sculpture folding from architectural blueprint paper — clean lines on dark charcoal with studio lighting. Smooth slow zoom toward central folding vectors.`,
    animaticMovement: "kenburns-zoom-in",
    clips: [
    {
      videoPrompt: `High-contrast geometric origami sculpture folding from architectural blueprint paper — clean lines on dark charcoal with studio lighting. Smooth slow zoom toward central folding vectors. Beat 1 of 2 — opening motion; scene establishes with gentle energy. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "I'm Malik Al-Jamil. Here, we don't memorize sterile formulas.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-math-intro-frame-02-0.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `High-contrast geometric origami sculpture folding from architectural blueprint paper — clean lines on dark charcoal with studio lighting. Smooth slow zoom toward central folding vectors. Beat 2 of 2 — closing motion; focus settles smoothly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "We treat mathematics like structural origami, folding raw numbers into tangible, physical dimensions you can actually see.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-math-intro-frame-02-1.mp4",
      durationSeconds: 11.79,
    }
    ],
  },
  {
    scenePrompt: `Precision lens close-up on abstract mathematical matrix — glowing white vector arrays over deep navy matte background. Lateral horizontal pan tracking luminous vector lines.`,
    animaticMovement: "kenburns-horizontal",
    clips: [
    {
      videoPrompt: `Precision lens close-up on abstract mathematical matrix — glowing white vector arrays over deep navy matte background. Lateral horizontal pan tracking luminous vector lines. Beat 1 of 2 — opening motion; scene establishes with gentle energy. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "I'm Amara Vance. We deliver on-demand, hyper-customized deep dives",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-math-intro-frame-03-0.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `Precision lens close-up on abstract mathematical matrix — glowing white vector arrays over deep navy matte background. Lateral horizontal pan tracking luminous vector lines. Beat 2 of 2 — closing motion; focus settles smoothly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "Together, we deliver on-demand, hyper-customized deep dives designed to map the universe's secret blueprints.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-math-intro-frame-03-1.mp4",
      durationSeconds: 8.25,
    }
    ],
  },
  {
    scenePrompt: `Translucent geometric layers stacking upward — each plane revealing finer abstract mathematical detail with soft directional light on dark slate. Slow centered zoom on evolving forms.`,
    animaticMovement: "kenburns-zoom-in",
    clips: [
    {
      videoPrompt: `Translucent geometric layers stacking upward — each plane revealing finer abstract mathematical detail with soft directional light on dark slate. Slow centered zoom on evolving forms. Beat 1 of 2 — opening motion; scene establishes with gentle energy. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "We don't rush the math for a stopwatch. Each episode runs as long as the idea needs — no fluff, no sanitized academic lectures.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-math-intro-frame-04-0.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `Translucent geometric layers stacking upward — each plane revealing finer abstract mathematical detail with soft directional light on dark slate. Slow centered zoom on evolving forms. Beat 2 of 2 — closing motion; focus settles smoothly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "Just pure, unfiltered logic, explained until it actually clicks.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-math-intro-frame-04-1.mp4",
      durationSeconds: 10.33,
    }
    ],
  },
  {
    scenePrompt: `Split abstract composition — polished luminous sphere on the left, escalating chain of linked geometric crystal modules on the right. Smooth horizontal pan from sphere to crystal array.`,
    animaticMovement: "kenburns-horizontal",
    clips: [
    {
      videoPrompt: `Split abstract composition — polished luminous sphere on the left, escalating chain of linked geometric crystal modules on the right. Smooth horizontal pan from sphere to crystal array. Continuous subtle motion within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "Need a quick, atomic breakthrough? Request a standalone deep dive. Facing a complex subject? The system maps it as a modular, progressive multi-episode series.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-math-intro-frame-05-0.mp4",
      durationSeconds: 14.38,
    }
    ],
  },
  {
    scenePrompt: `Layered abstract depth composition suggesting classroom connectivity — floating globe motif pulsing gently at the upper edge without readable interface elements. Continuous diagonal climb ascending through layers.`,
    animaticMovement: "kenburns-diagonal-down",
    clips: [
    {
      videoPrompt: `Layered abstract depth composition suggesting classroom connectivity — floating globe motif pulsing gently at the upper edge without readable interface elements. Continuous diagonal climb ascending through layers. Beat 1 of 2 — opening motion; scene establishes with gentle energy. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "Embed these custom animatics directly onto classroom pages, while students toggle",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-math-intro-frame-06-0.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `Layered abstract depth composition suggesting classroom connectivity — floating globe motif pulsing gently at the upper edge without readable interface elements. Continuous diagonal climb ascending through layers. Beat 2 of 2 — closing motion; focus settles smoothly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "flawlessly between over forty languages, testing their retention with built-in checkpoint quizzes.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-math-intro-frame-06-1.mp4",
      durationSeconds: 8.79,
    }
    ],
  },
  {
    scenePrompt: `Central luminous geometric emblem over rich multi-dimensional backdrop of interlocking fractal rings — abstract symbol only, no readable text. Slow central zoom locking focus into the heart of the emblem.`,
    animaticMovement: "kenburns-zoom-in",
    clips: [
    {
      videoPrompt: `Central luminous geometric emblem over rich multi-dimensional backdrop of interlocking fractal rings — abstract symbol only, no readable text. Slow central zoom locking focus into the heart of the emblem. Continuous subtle motion within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "Ready to decode your world? Tap the interface, drop your topic, trigger the 'Ask the Host' tool, and let's map the matrix together.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-math-intro-frame-07-0.mp4",
      durationSeconds: 10.25,
    }
    ],
  },
]

/** Lookup video spec by dialog line index (0–6). */
export function patternMatrixIntroFrameVideoSpecAt(
  lineIndex: number
): PatternMatrixIntroFrameVideoSpec | undefined {
  return PATTERN_MATRIX_INTRO_FRAME_VIDEOS[lineIndex]
}
