/**
 * Dual-host channel manifesto intro for ClearSight Pattern Matrix.
 * Orientation Module — Episode 0 (Standalone channel trailer).
 */

import type { GeminiDialogueSpec } from '@/lib/gemini-tts-dialogue'
import { PATTERN_MATRIX_INTRO_ROCK_BED } from '@/lib/music-assets'
import { HOST_AMARA, HOST_MALIK } from '@/lib/shows'

export const PATTERN_MATRIX_SHOW_ID = 'clearsight-math' as const

export type PatternMatrixSpeaker = 'amara' | 'malik'

export interface PatternMatrixIntroFrame {
  frame_id: number
  speaker: PatternMatrixSpeaker
  dialogue: string
  visual_prompt: string
  camera_rendering: {
    engine: string
    movement_vector: string
  }
  audio_mixing: {
    lyria_theme_cue?: string
    lyria_dynamics?: string
    veo_lite_sfx?: string
  }
}

export const PATTERN_MATRIX_SERIES_IDENTITY = {
  series_title: 'Orientation Module',
  series_id: 'pm_orientation',
  total_episodes_in_series: 1,
  current_episode_number: 0,
  episode_title: 'Channel Manifesto',
  format_type: 'Standalone' as const,
  target_run_time_seconds: 90,
}

/** Voice configs derived from HOST_AMARA / HOST_MALIK in shows.ts. */
export const PATTERN_MATRIX_HOST_VOICES = {
  amara: {
    voiceId: HOST_AMARA.voiceId,
    speakingRate: HOST_AMARA.speakingRate,
    characterNotes: HOST_AMARA.ttsStylePrompt,
  },
  malik: {
    voiceId: HOST_MALIK.voiceId,
    speakingRate: HOST_MALIK.speakingRate,
    characterNotes: HOST_MALIK.ttsStylePrompt,
  },
} as const

/** Gemini multiSpeakerMarkup aliases (alphanumeric, no spaces). */
export const PATTERN_MATRIX_SPEAKER_ALIASES: Record<PatternMatrixSpeaker, string> = {
  amara: 'Amara',
  malik: 'Malik',
}

/** Global scene direction for multi-speaker TTS — not spoken as dialogue. */
export const PATTERN_MATRIX_DIALOGUE_SCENE_PROMPT =
  'Podcast channel intro between two co-hosts. Speak each turn verbatim as written; do not add or omit words.'

export function buildPatternMatrixDialogueSpec(
  lines: PatternMatrixManifestoLine[],
  languageCode: string
): GeminiDialogueSpec {
  return {
    dialogueId: 'pattern-matrix-manifesto',
    scenePrompt: PATTERN_MATRIX_DIALOGUE_SCENE_PROMPT,
    turns: lines.map((line) => ({
      speaker: PATTERN_MATRIX_SPEAKER_ALIASES[line.speaker],
      text: line.text,
    })),
    speakerVoices: {
      [PATTERN_MATRIX_SPEAKER_ALIASES.amara]: PATTERN_MATRIX_HOST_VOICES.amara.voiceId,
      [PATTERN_MATRIX_SPEAKER_ALIASES.malik]: PATTERN_MATRIX_HOST_VOICES.malik.voiceId,
    },
    languageCode,
    speakingRate: 1.0,
  }
}

export const PATTERN_MATRIX_SPEAKER_NAMES: Record<PatternMatrixSpeaker, string> = {
  amara: 'Amara Vance',
  malik: 'Malik Al-Jamil',
}

export interface PatternMatrixManifestoLine {
  speaker: PatternMatrixSpeaker
  text: string
  frame: PatternMatrixIntroFrame
}

export interface PatternMatrixManifestoAct {
  id: string
  music: {
    bedUrl: string
    bedVolume: number
  }
  lines: PatternMatrixManifestoLine[]
}

const FRAMES: PatternMatrixIntroFrame[] = [
  {
    frame_id: 1,
    speaker: 'amara',
    dialogue:
      'Look around you. The layout of your city, the rhythm of your favorite song—it all follows a hidden architecture. Welcome to ClearSight Pattern Matrix.',
    visual_prompt:
      'A macro shot of a glowing digital map of a global metropolis, transitioning smoothly into a clean, shimmering musical waveform mesh, minimalist tech aesthetic, 8k resolution.',
    camera_rendering: {
      engine: 'Ken Burns',
      movement_vector:
        'Slow outward pull from a central grid nexus to reveal a vast, interconnected digital landscape.',
    },
    audio_mixing: {
      lyria_theme_cue: 'Mathematical Ambient Pulse',
      lyria_dynamics:
        'Low, hypnotic rhythmic synth base with a steady clockwork click, ducked to -14dB under the vocal track.',
      veo_lite_sfx: 'A clean, stereo digital data-sweep sound effect mirroring the map transition.',
    },
  },
  {
    frame_id: 2,
    speaker: 'malik',
    dialogue:
      "I'm Malik Al-Jamil. Here, we don't memorize sterile formulas. We treat mathematics like structural origami, folding raw numbers into tangible, physical dimensions you can actually see.",
    visual_prompt:
      'A high-contrast, minimalist illustration of an intricate geometric origami sculpture folding elegantly out of architectural blueprint paper, clean lines on dark charcoal, studio lighting.',
    camera_rendering: {
      engine: 'Ken Burns',
      movement_vector:
        'Smooth, slow zoom directed at the central folding vectors of the geometric origami sculpture.',
    },
    audio_mixing: {
      lyria_theme_cue: 'Mathematical Ambient Pulse',
      lyria_dynamics:
        'Music introduces a warm, bright acoustic texture layer, compressed steadily at -14dB.',
      veo_lite_sfx:
        'A crisp, satisfying textured paper-crinkling sound effect synchronized perfectly with the unfolding lines.',
    },
  },
  {
    frame_id: 3,
    speaker: 'amara',
    dialogue:
      "I'm Amara Vance. We deliver on-demand, hyper-customized deep dives designed to map the universe's secret blueprints.",
    visual_prompt:
      'A close-up of a precision lens focusing on a complex mathematical matrix, glowing white vector tracking arrays over a deep navy matte background.',
    camera_rendering: {
      engine: 'Ken Burns',
      movement_vector:
        'Lateral horizontal pan tracking the line of the vector arrays across the screen frame.',
    },
    audio_mixing: {
      lyria_theme_cue: 'Mathematical Ambient Pulse',
      lyria_dynamics:
        'Tempo drops slightly to shift focus to an intriguing, inquisitive tone under the dialogue layer.',
      veo_lite_sfx:
        'A subtle, high-fidelity mechanical lens focus click sound effect to underscore the visual sharpening.',
    },
  },
  {
    frame_id: 4,
    speaker: 'malik',
    dialogue:
      "We don't rush the math for a stopwatch. Each episode runs as long as the idea needs — no fluff, no sanitized academic lectures. Just pure, unfiltered logic, explained until it actually clicks.",
    visual_prompt:
      'Photorealistic cross-section of translucent geometric layers stacking upward, each plane revealing finer mathematical detail, soft directional light on dark slate.',
    camera_rendering: {
      engine: 'Ken Burns',
      movement_vector: 'Slow, centered zoom focusing directly on the changing graphic metrics.',
    },
    audio_mixing: {
      lyria_theme_cue: 'Mathematical Ambient Pulse',
      lyria_dynamics:
        'Rhythmic elements tighten, maintaining a steady, driven pace beneath the vocals.',
      veo_lite_sfx: 'A single, resonant glass chime marking the format transition state.',
    },
  },
  {
    frame_id: 5,
    speaker: 'amara',
    dialogue:
      'Need a quick, atomic breakthrough? Request a standalone deep dive. Facing a complex subject? The system maps it as a modular, progressive multi-episode series.',
    visual_prompt:
      'A split conceptual infographic layout: on the left, a single polished data sphere; on the right, an escalating chain of linked geometric crystal modules.',
    camera_rendering: {
      engine: 'Ken Burns',
      movement_vector:
        'Smooth horizontal pan sliding from the standalone atomic sphere over to the multi-part series array.',
    },
    audio_mixing: {
      lyria_theme_cue: 'Mathematical Ambient Pulse',
      lyria_dynamics:
        'Synth chords broaden to emphasize user flexibility and platform choice metrics.',
      veo_lite_sfx: 'Two low-frequency interface pulses corresponding to the twin options visible on screen.',
    },
  },
  {
    frame_id: 6,
    speaker: 'malik',
    dialogue:
      'Embed these custom animatics directly onto classroom pages, while students toggle flawlessly between over forty languages, testing their retention with built-in checkpoint quizzes.',
    visual_prompt:
      'An elegant conceptual illustration showing a stylized web portal layout, with a clean floating globe interface icon pulsing gently at the upper border.',
    camera_rendering: {
      engine: 'Ken Burns',
      movement_vector:
        'Continuous diagonal climb ascending along the web layer design to reinforce classroom utility.',
    },
    audio_mixing: {
      lyria_theme_cue: 'Mathematical Ambient Pulse',
      lyria_dynamics:
        'The instrumentation shifts into an optimistic, analytical rhythm bed, moving forward at -14dB.',
      veo_lite_sfx:
        'Light, ultra-clean digital interface chimes tracking along the virtual language selector.',
    },
  },
  {
    frame_id: 7,
    speaker: 'amara',
    dialogue:
      "Ready to decode your world? Tap the interface, drop your topic, trigger the 'Ask the Host' tool, and let's map the matrix together.",
    visual_prompt:
      'The central ClearSight Pattern Matrix logo illuminating cleanly over a rich, multi-dimensional geometric backdrop of interlocking fractal rings.',
    camera_rendering: {
      engine: 'Ken Burns',
      movement_vector:
        'Slow, central zoom-in, locking focus squarely into the heart of the channel emblem.',
    },
    audio_mixing: {
      lyria_theme_cue: 'Mathematical Ambient Pulse',
      lyria_dynamics:
        'Rhythmic layers swell upward as the vocals conclude, transitioning into a clean, resolving ambient chord.',
      veo_lite_sfx:
        'A final, crisp high-fidelity UI confirmation chime as all background sound tracks fade out smoothly.',
    },
  },
]

export const PATTERN_MATRIX_MANIFESTO_FRAMES = FRAMES

export const PATTERN_MATRIX_MANIFESTO: {
  title: string
  series: typeof PATTERN_MATRIX_SERIES_IDENTITY
  act: PatternMatrixManifestoAct
} = {
  title: 'Orientation Module — Channel Manifesto',
  series: PATTERN_MATRIX_SERIES_IDENTITY,
  act: {
    id: 'manifesto',
    music: {
      bedUrl: PATTERN_MATRIX_INTRO_ROCK_BED,
      bedVolume: 0.2,
    },
    lines: FRAMES.map((frame) => ({
      speaker: frame.speaker,
      text: frame.dialogue,
      frame,
    })),
  },
}
