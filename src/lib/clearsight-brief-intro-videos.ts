/** Veo I2V clip length for Brief intro dialog frames. */
export const CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEO_DURATION_SECONDS = 8

/** Bump when blob MP4s are regenerated so the hero player bypasses CDN/browser cache. */
export const CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS_REVISION = '20260625-f09-single'

export function briefIntroFrameVideoPlaybackUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  const separator = trimmed.includes('?') ? '&' : '?'
  return `${trimmed}${separator}v=${CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS_REVISION}`
}

export interface BriefIntroFrameVideoClipSpec {
  videoPrompt: string
  dialogueExcerpt?: string
  videoUrl?: string
  /** Post-trim effective duration (≤ 8). */
  durationSeconds?: number
}

export interface BriefIntroFrameVideoSpec {
  /** Scene mood / setting for all clips in this dialog frame. */
  scenePrompt: string
  animaticMovement?: string
  clips: BriefIntroFrameVideoClipSpec[]
}

/**
 * Per-dialog-line I2V specs for The ClearSight Brief intro (10 lines).
 * Index aligns with {@link CLEARSIGHT_BRIEF_INTRO_FRAME_IMAGES} in clearsight-brief-intro-images.ts.
 *
 * Overwritten by `npm run generate:clearsight-brief-intro-frame-videos`.
 */
export const CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS: BriefIntroFrameVideoSpec[] = [
  {
    scenePrompt: `Investigative newsroom atmosphere — ambient monitor glow and soft depth-of-field bokeh, curiosity and scrutiny without readable screens or copy. Gentle camera drift.`,
    animaticMovement: "kenburns-zoom-in",
    clips: [
    {
      videoPrompt: `Investigative newsroom atmosphere — ambient monitor glow and soft depth-of-field bokeh, curiosity and scrutiny without readable screens or copy. Gentle camera drift. Beat 1 of 4 — opening motion; scene establishes with gentle energy. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "Ever find yourself staring at a wild viral headline, a complex local issue, or a piece of breaking news, wondering: What is the actual truth here?",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-01-0.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `Investigative newsroom atmosphere — ambient monitor glow and soft depth-of-field bokeh, curiosity and scrutiny without readable screens or copy. Gentle camera drift. Beat 2 of 4 — mid-scene motion; energy builds subtly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "Welcome to The ClearSight Brief.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-01-1.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `Investigative newsroom atmosphere — ambient monitor glow and soft depth-of-field bokeh, curiosity and scrutiny without readable screens or copy. Gentle camera drift. Beat 3 of 4 — mid-scene motion; energy builds subtly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "I'm Sarah Chen.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-01-2.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `Investigative newsroom atmosphere — ambient monitor glow and soft depth-of-field bokeh, curiosity and scrutiny without readable screens or copy. Gentle camera drift. Beat 4 of 4 — closing motion; focus settles smoothly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "I'm here to ask the sharp questions, cut through the social media friction, and make sure we get real answers without getting lost in the noise.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-01-3.mp4",
      durationSeconds: 3.38,
    }
    ],
  },
  {
    scenePrompt: `Calm analyst workspace — abstract geometric data glows pulse softly while light shifts across the scene, conveying clarity and objectivity without charts or labels. Slow centered drift.`,
    animaticMovement: "kenburns-diagonal-down",
    clips: [
    {
      videoPrompt: `Calm analyst workspace — abstract geometric data glows pulse softly while light shifts across the scene, conveying clarity and objectivity without charts or labels. Slow centered drift. Beat 1 of 3 — opening motion; scene establishes with gentle energy. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "And I'm Dr. Benjamin Anderson.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-02-0.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `Calm analyst workspace — abstract geometric data glows pulse softly while light shifts across the scene, conveying clarity and objectivity without charts or labels. Slow centered drift. Beat 2 of 3 — mid-scene motion; energy builds subtly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "My role is to anchor our discussions in objective, data-driven reality. Every conclusion we reach is built strictly on verified facts and foundational evidence—no bias, no academic jargon, just the clear picture.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-02-1.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `Calm analyst workspace — abstract geometric data glows pulse softly while light shifts across the scene, conveying clarity and objectivity without charts or labels. Slow centered drift. Beat 3 of 3 — closing motion; focus settles smoothly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "My role is to anchor our discussions in objective, data-driven reality. Every conclusion we reach is built strictly on verified facts and foundational evidence—no bias, no academic jargon, just the clear picture.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-02-2.mp4",
      durationSeconds: 3.71,
    }
    ],
  },
  {
    scenePrompt: `Personalized broadcast control room — soft panel light sweeps across abstract UI silhouettes, global and intimate without cards, selectors, or readable copy. Horizontal slide across panels.`,
    animaticMovement: "kenburns-horizontal",
    clips: [
    {
      videoPrompt: `Personalized broadcast control room — soft panel light sweeps across abstract UI silhouettes, global and intimate without cards, selectors, or readable copy. Horizontal slide across panels. Beat 1 of 3 — opening motion; scene establishes with gentle energy. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "But here is the twist: this isn't just our podcast. It's yours.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-03-0.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `Personalized broadcast control room — soft panel light sweeps across abstract UI silhouettes, global and intimate without cards, selectors, or readable copy. Horizontal slide across panels. Beat 2 of 3 — mid-scene motion; energy builds subtly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "The ClearSight Brief is an entirely on-demand, hyper-customized experience. You tell us exactly what topic you want investigated, and what language you want to hear it in—and we support over 40 languages globally.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-03-1.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `Personalized broadcast control room — soft panel light sweeps across abstract UI silhouettes, global and intimate without cards, selectors, or readable copy. Horizontal slide across panels. Beat 3 of 3 — closing motion; focus settles smoothly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "The ClearSight Brief is an entirely on-demand, hyper-customized experience. You tell us exactly what topic you want investigated, and what language you want to hear it in—and we support over 40 languages globally.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-03-2.mp4",
      durationSeconds: 6.38,
    }
    ],
  },
  {
    scenePrompt: `Data processing visualization — flowing light streams and soft progress glow compress complexity into clarity without timeline bars, metrics, or numbers. Slow zoom toward the focal glow.`,
    animaticMovement: "kenburns-zoom-in",
    clips: [
    {
      videoPrompt: `Data processing visualization — flowing light streams and soft progress glow compress complexity into clarity without timeline bars, metrics, or numbers. Slow zoom toward the focal glow. Beat 1 of 4 — opening motion; scene establishes with gentle energy. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "Once you submit your topic, our system processes the data instantly. In less",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-04-0.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `Data processing visualization — flowing light streams and soft progress glow compress complexity into clarity without timeline bars, metrics, or numbers. Slow zoom toward the focal glow. Beat 2 of 4 — mid-scene motion; energy builds subtly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "than five minutes, you receive a highly detailed, deep-dive audio and animatic video",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-04-1.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `Data processing visualization — flowing light streams and soft progress glow compress complexity into clarity without timeline bars, metrics, or numbers. Slow zoom toward the focal glow. Beat 3 of 4 — mid-scene motion; energy builds subtly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "podcast episode tailored specifically to your request. Think of it like a precision-guided",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-04-2.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `Data processing visualization — flowing light streams and soft progress glow compress complexity into clarity without timeline bars, metrics, or numbers. Slow zoom toward the focal glow. Beat 4 of 4 — closing motion; focus settles smoothly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "deep dive, compressing hours of research into a single, comprehensive brief.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-04-3.mp4",
      durationSeconds: 1.21,
    }
    ],
  },
  {
    scenePrompt: `Localized world atmosphere — abstract map parallax and color regions shift subtly between global and local views without city names, pins, or labels. Diagonal drift across the map.`,
    animaticMovement: "kenburns-diagonal-down",
    clips: [
    {
      videoPrompt: `Localized world atmosphere — abstract map parallax and color regions shift subtly between global and local views without city names, pins, or labels. Diagonal drift across the map. Beat 1 of 2 — opening motion; scene establishes with gentle energy. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "Wait, break that down for us simpler, Benjamin.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-05-0.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `Localized world atmosphere — abstract map parallax and color regions shift subtly between global and local views without city names, pins, or labels. Diagonal drift across the map. Beat 2 of 2 — closing motion; focus settles smoothly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "If a user asks for a breakdown of a localized economic trend in Kyoto, or a tech rumor in Spanish, they get a full video episode in five minutes?",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-05-1.mp4",
      durationSeconds: 7.54,
    }
    ],
  },
  {
    scenePrompt: `Discovery network visualization — pulsing nodes and connecting lines animate softly without category tags, labels, or readable symbols. Gentle horizontal pan.`,
    animaticMovement: "kenburns-horizontal",
    clips: [
    {
      videoPrompt: `Discovery network visualization — pulsing nodes and connecting lines animate softly without category tags, labels, or readable symbols. Gentle horizontal pan. Beat 1 of 3 — opening motion; scene establishes with gentle energy. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "Precisely, Sarah. It functions like a localized data lens.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-06-0.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `Discovery network visualization — pulsing nodes and connecting lines animate softly without category tags, labels, or readable symbols. Gentle horizontal pan. Beat 2 of 3 — mid-scene motion; energy builds subtly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "The system synthesizes the core evidence layout, translates it flawlessly, and generates the episode. Furthermore, it does not end there.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-06-1.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `Discovery network visualization — pulsing nodes and connecting lines animate softly without category tags, labels, or readable symbols. Gentle horizontal pan. Beat 3 of 3 — closing motion; focus settles smoothly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "Every episode we generate is tagged by category and geographic location, feeding into a global discovery network.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-06-2.mp4",
      durationSeconds: 7.21,
    }
    ],
  },
  {
    scenePrompt: `Hometown trending atmosphere — heat-color fields and soft location glow animate gently, macro trends narrowing to a local view without rankings or numbers. Slow zoom into the map center.`,
    animaticMovement: "kenburns-zoom-in",
    clips: [
    {
      videoPrompt: `Hometown trending atmosphere — heat-color fields and soft location glow animate gently, macro trends narrowing to a local view without rankings or numbers. Slow zoom into the map center. Beat 1 of 2 — opening motion; scene establishes with gentle energy. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "So I could literally open the app and see exactly what episodes are trending in my",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-07-0.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `Hometown trending atmosphere — heat-color fields and soft location glow animate gently, macro trends narrowing to a local view without rankings or numbers. Slow zoom into the map center. Beat 2 of 2 — closing motion; focus settles smoothly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "own hometown, or pull up the top 20 hottest topics for any category and geolocation worldwide?",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-07-1.mp4",
      durationSeconds: 6.71,
    }
    ],
  },
  {
    scenePrompt: `Geographic discovery atmosphere — concentric rings and abstract filter shapes shift subtly, connecting worldwide scope to a local lens without labels or readable UI. Diagonal drift.`,
    animaticMovement: "kenburns-diagonal-down",
    clips: [
    {
      videoPrompt: `Geographic discovery atmosphere — concentric rings and abstract filter shapes shift subtly, connecting worldwide scope to a local lens without labels or readable UI. Diagonal drift. Continuous subtle motion within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "Exactly. It brings macro-level data down to a micro-local perspective.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-08-0.mp4",
      durationSeconds: 6.21,
    }
    ],
  },
  {
    scenePrompt: `ClearSight Brief studio — Dr. Benjamin Anderson beside Sarah Chen, matching the reference hosts exactly. Abstract verified checkmark icons gently replace faded rumor glyphs on a sleek evidence wall without citation cards, dashboard copy, or readable panels. No extra people, no surreal objects. Slow centered zoom on the evidence panel only.`,
    animaticMovement: "kenburns-zoom-in",
    clips: [
    {
      videoPrompt: `ClearSight Brief studio — Dr. Benjamin Anderson beside Sarah Chen, matching the reference hosts exactly. Abstract verified checkmark icons gently replace faded rumor glyphs on a sleek evidence wall without citation cards, dashboard copy, or readable panels. No extra people, no surreal objects. Slow centered zoom on the evidence panel only. Continuous subtle motion within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "Ultimately, our goal is to separate verified facts from online myths, giving you a crystal-clear understanding of the world around you, wherever you are.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-09-0.mp4",
      durationSeconds: 11.71,
    }
    ],
  },
  {
    scenePrompt: `Call-to-action atmosphere — inviting interface glow and confident energy ripple across abstract panels without buttons, input fields, tool names, or readable copy. Gentle horizontal slide.`,
    animaticMovement: "kenburns-horizontal",
    clips: [
    {
      videoPrompt: `Call-to-action atmosphere — inviting interface glow and confident energy ripple across abstract panels without buttons, input fields, tool names, or readable copy. Gentle horizontal slide. Beat 1 of 3 — opening motion; scene establishes with gentle energy. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "And the conversation keeps going. Once your custom episode drops, you can jump right into a Q&A session with us to ask follow-up questions and steer the conversation further.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-10-0.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `Call-to-action atmosphere — inviting interface glow and confident energy ripple across abstract panels without buttons, input fields, tool names, or readable copy. Gentle horizontal slide. Beat 2 of 3 — mid-scene motion; energy builds subtly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "Ready to create your first brief? Trigger the Ask the Host tool right now in your interface, drop your topic, and let's find the truth together.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-10-1.mp4",
      durationSeconds: 8,
    },
    {
      videoPrompt: `Call-to-action atmosphere — inviting interface glow and confident energy ripple across abstract panels without buttons, input fields, tool names, or readable copy. Gentle horizontal slide. Beat 3 of 3 — closing motion; focus settles smoothly within the same setting. Absolutely no visible text, captions, subtitles, typography, labels, logos, watermarks, numbers, or readable symbols anywhere in frame. Use abstract shapes, color, light, and motion only. Subtle cinematic motion only. No speaking, no lip sync, no dialogue. Silent video.`,
      dialogueExcerpt: "Ready to create your first brief? Trigger the Ask the Host tool right now in your interface, drop your topic, and let's find the truth together.",
      videoUrl: "https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/shows/clearsight-brief-intro-frame-10-2.mp4",
      durationSeconds: 5.79,
    }
    ],
  },
]

/** Lookup video spec by dialog line index (0–9). */
export function briefIntroFrameVideoSpecAt(lineIndex: number): BriefIntroFrameVideoSpec | undefined {
  return CLEARSIGHT_BRIEF_INTRO_FRAME_VIDEOS[lineIndex]
}
