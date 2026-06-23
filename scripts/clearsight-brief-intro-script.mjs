/**
 * Dual-host intro trailer script for The ClearSight Brief channel page.
 * Consumed by scripts/generate-clearsight-brief-intro.mjs.
 */

/** Voice configs mirrored from src/lib/hosts.ts (Sarah Chen + Dr. Benjamin Anderson). */
export const HOST_VOICES = {
  sarah: {
    voiceId: 'Laomedeia',
    speakingRate: 1.0,
    style:
      'Bright, relatable, sharp, inquisitive investigative broadcast voice. Energetic modern pacing with intentional punctuation — em-dashes, ellipses, and short question fragments — to create human-like pauses and curiosity inflections. Never read bracket tags aloud.',
  },
  benjamin: {
    voiceId: 'Algenib',
    speakingRate: 1.0,
    style:
      'Engaged conversational analyst — confident, forward-moving, clear inflection; still objective and never condescending. Deliver complex data through vivid analogies with natural broadcast rhythm. Never read bracket tags aloud.',
  },
}

/** Brand music URLs mirrored from src/lib/music-assets.ts */
export const INTRO_MUSIC = {
  themeIntro: {
    url: 'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/music/theme-intro.wav',
    durationSeconds: 5,
  },
  sting: {
    url: 'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/music/chapter-sting.wav',
    durationSeconds: 3,
  },
  themeOutro: {
    url: 'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/music/theme-outro.wav',
    durationSeconds: 6,
  },
  bedIntro: 'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/music/bed-intro.wav',
  bedContent: 'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/music/bed-content.wav',
  bedOutro: 'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/clearsight/music/bed-outro.wav',
}

export const CLEARSIGHT_BRIEF_INTRO = {
  title: 'Intro Trailer: Your Podcast, On-Demand',
  acts: [
    {
      id: 'act1',
      music: {
        prependTheme: 'themeIntro',
        bed: 'bedIntro',
        bedVolume: 0.18,
      },
      lines: [
        {
          speaker: 'sarah',
          text: "Ever find yourself staring at a wild viral headline, a complex local issue, or a piece of breaking news, wondering: What is the actual truth here? Welcome to The ClearSight Brief. I'm Sarah Chen. I'm here to ask the sharp questions, cut through the social media friction, and make sure we get real answers without getting lost in the noise.",
        },
        {
          speaker: 'benjamin',
          text: "And I'm Dr. Benjamin Anderson. My role is to anchor our discussions in objective, data-driven reality. Every conclusion we reach is built strictly on verified facts and foundational evidence—no bias, no academic jargon, just the clear picture.",
        },
      ],
    },
    {
      id: 'act2',
      music: {
        prependTheme: 'sting',
        bed: 'bedContent',
        bedVolume: 0.15,
      },
      lines: [
        {
          speaker: 'sarah',
          text: "But here is the twist: this isn't just our podcast. It's yours. The ClearSight Brief is an entirely on-demand, hyper-customized experience. You tell us exactly what topic you want investigated, and what language you want to hear it in—and we support over 40 languages globally.",
        },
        {
          speaker: 'benjamin',
          text: 'Once you submit your topic, our system processes the data instantly. In less than five minutes, you receive a highly detailed, deep-dive audio and animatic video podcast episode tailored specifically to your request. Think of it like a precision-guided deep dive, compressing hours of research into a single, comprehensive brief.',
        },
        {
          speaker: 'sarah',
          text: 'Wait, break that down for us simpler, Benjamin. If a user asks for a breakdown of a localized economic trend in Kyoto, or a tech rumor in Spanish, they get a full video episode in five minutes?',
        },
        {
          speaker: 'benjamin',
          text: 'Precisely, Sarah. It functions like a localized data lens. The system synthesizes the core evidence layout, translates it flawlessly, and generates the episode. Furthermore, it does not end there. Every episode we generate is tagged by category and geographic location, feeding into a global discovery network.',
        },
        {
          speaker: 'sarah',
          text: 'So I could literally open the app and see exactly what episodes are trending in my own hometown, or pull up the top 20 hottest topics for any category and geolocation worldwide?',
        },
        {
          speaker: 'benjamin',
          text: 'Exactly. It brings macro-level data down to a micro-local perspective.',
        },
      ],
    },
    {
      id: 'act3',
      music: {
        bed: 'bedOutro',
        bedVolume: 0.12,
        appendTheme: 'themeOutro',
      },
      lines: [
        {
          speaker: 'benjamin',
          text: 'Ultimately, our goal is to separate verified facts from online myths, giving you a crystal-clear understanding of the world around you, wherever you are.',
        },
        {
          speaker: 'sarah',
          text: "And the conversation keeps going. Once your custom episode drops, you can jump right into a Q&A session with us to ask follow-up questions and steer the conversation further. Ready to create your first brief? Trigger the Ask the Host tool right now in your interface, drop your topic, and let's find the truth together.",
        },
      ],
    },
  ],
}
