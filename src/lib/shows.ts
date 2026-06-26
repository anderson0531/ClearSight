import { CLEARSIGHT_HOSTS_STUDIO_URL } from '@/lib/brand-assets'
import { HOST_ANDERSON, HOST_SARAH, HOSTS_IMAGE, type HostProfile } from '@/lib/hosts'
import { HOST_ART, SHOW_COVER_ART, SHOW_INTRO_ART, SHOW_STUDIO_ART } from '@/lib/host-art'
import { SHOW_INTRO_AUDIO } from '@/lib/show-audio'
import {
  canonicalizeCategory,
  categoriesForType,
  typeForCategory,
  type Category,
  type ContentType,
} from '@/lib/taxonomy'

/**
 * A "show" is a per-category podcast brand with its own host(s), visual style,
 * and topic-optimized script structure. News keeps the canonical Anderson +
 * Chen pair; every other content lane gets a cast tuned for its subject. Host
 * count is flexible: a show is `solo` (one host) when a single expert/guide
 * serves the topic better, or `dialogue` (two hosts) when debate/banter adds
 * value. Host identities stay global; only the script wording and scene imagery
 * localize per request.
 */
export type ShowFormat = 'solo' | 'dialogue'

/** Generation pipeline profile for bespoke channel formats. */
export type ShowGenerationProfile = 'default' | 'sceneFlowLite'

export interface Show {
  /** Stable identifier persisted with each generation. */
  id: string
  /** Display name of the show. */
  name: string
  /** One-paragraph channel description shown on the channel page. */
  description: string
  /**
   * The channel's clear area of focus. Used by on-demand moderation to accept
   * broad topics that fit the theme and reject off-theme ones. Distinct from the
   * marketing `description`.
   */
  focus: string
  /**
   * Short, branded spoken welcome in the show's voice. Reused as the per-show
   * episode INTRO template and as the channel-page audio intro script.
   */
  introTagline: string
  contentType: ContentType
  /** Categories/topics this show covers. Empty = the default for its type. */
  categories: string[]
  /** One or two hosts. */
  hosts: HostProfile[]
  /** Derived from host count. */
  format: ShowFormat
  /** Editorial visual style applied to illustration + thumbnail prompts. */
  visualStyle: string
  /** Ordered, topic-optimized script beats that drive generation. */
  scriptStructure: string[]
  /**
   * Optional show-specific editorial philosophy + retention rules injected into
   * the script prompt. Lets a flagship channel (e.g. The ClearSight Brief) run a
   * bespoke high-retention format without changing other channels. When set and
   * `noVerdict` is true, the bookend SUMMARY is suppressed so the episode ends on
   * a forecast + question rather than a definitive conclusion.
   */
  scriptPhilosophy?: string
  /** When true, the episode avoids a definitive verdict/summary conclusion. */
  noVerdict?: boolean
  /** Scene + tone guidance passed to TTS director notes. */
  sceneDirectorNotes: string
  /** Shared studio frame shown for intro/outro and as a host fallback. */
  studioImage: string
  /** Host-populated intro image featured on the home-page show card. */
  introImage: string
  /** Fixed cover key-art used as the channel hero and channel cards. */
  coverImage: string
  /** Pre-generated, tap-to-play channel intro audio (undefined until generated). */
  introAudio?: string
  /** When set, selects a bespoke script/animatic pipeline (e.g. SceneFlow Lite). */
  generationProfile?: ShowGenerationProfile
}

// Placeholder studio + portrait artwork. New shows reuse the canonical studio
// image until `scripts/generate-host-art.mjs` produces bespoke art and these
// URLs are populated. Keeping a real URL here means playback never breaks.
const PLACEHOLDER_STUDIO = CLEARSIGHT_HOSTS_STUDIO_URL

function host(profile: Omit<HostProfile, 'shortName'> & { shortName?: string }): HostProfile {
  const speakingImages =
    profile.speakingImages.length > 0 ? profile.speakingImages : HOST_ART[profile.name] ?? []
  return { shortName: profile.name, ...profile, speakingImages }
}

// ---------------------------------------------------------------------------
// Education — "ClearSight Academy" (duo, Socratic teaching)
// ---------------------------------------------------------------------------
export const HOST_LENA = host({
  name: 'Dr. Lena Okafor',
  shortName: 'Dr. Okafor',
  role: 'Lead educator',
  voiceId: 'Kore',
  ttsStylePrompt:
    'Warm, lucid lead educator. Patient and encouraging, explaining clearly at an unhurried, conversational pace.',
  speakingRate: 1.0,
  bio: 'A gifted teacher who makes hard ideas feel obvious, building intuition from first principles.',
  persona:
    'Warm, lucid lead educator who teaches from first principles, defines jargon plainly, and builds intuition with vivid analogies.',
  aliases: ['lena', 'okafor'],
  speakingImages: [],
})

export const HOST_DIEGO = host({
  name: 'Diego Santos',
  role: 'Curious co-host',
  voiceId: 'Charon',
  ttsStylePrompt:
    'Curious, friendly co-host. Bright and engaged, voicing the smart learner’s questions at a natural pace.',
  speakingRate: 1.0,
  bio: 'The voice of the curious learner — asks the questions the audience is thinking.',
  persona:
    'Curious, quick co-host who voices the learner’s questions, surfaces common misconceptions, and checks understanding.',
  aliases: ['diego', 'santos'],
  speakingImages: [],
})

// ---------------------------------------------------------------------------
// Education — ClearSight Pattern Matrix (Amara + Malik, SceneFlow Lite)
// ---------------------------------------------------------------------------
export const HOST_AMARA = host({
  name: 'Amara Vance',
  shortName: 'Amara Vance',
  role: 'Pattern Navigator',
  voiceId: 'Gacrux',
  ttsStylePrompt:
    'African American woman in her early 30s. Warm, polished, and self-assured — sharp professional co-host with clear medium-register diction and crisp articulation. Confident and approachable, like a systems analyst who makes complex ideas feel human and inviting; inquisitive and articulate, never lecture-like or announcer-flat. Natural conversational pacing.',
  speakingRate: 1.0,
  bio: 'A sharp systems storyteller who tracks where numbers meet culture — from cryptography to market behavior to architectural acoustics.',
  persona:
    'Series Lead and Viewer\'s Proxy: approaches mathematics as a historical detective and systems analyst. Uncovers real-world paradoxes, history, and core mysteries. Uses sharp active verbs, modern design idioms, and direct conversational contractions. Take as many frames as the idea needs — clarity over brevity. Trigger lines like "Hold on, Malik, let\'s ground that — what does that boundary actually look like if we zoom in?"',
  aliases: ['amara', 'vance'],
  speakingImages: [],
})

export const HOST_MALIK = host({
  name: 'Malik Al-Jamil',
  shortName: 'Malik Al-Jamil',
  role: 'Structural Topologist',
  voiceId: 'Iapetus',
  ttsStylePrompt:
    'Middle Eastern American man in his late 30s. Calm, clear baritone with a light Levantine inflection — intelligible conversational American English. Composed and self-assured, like a spatial analyst who explains structure with gentle authority; measured pacing and precise diction, warm but never theatrical or announcer-flat. Keep accent subtle, never heavy or difficult to understand.',
  speakingRate: 0.95,
  bio: 'A spatial analyst who replaces abstract grids with tangible dimensional analogies — origami folds, crystal geometry, and soundwave physics.',
  persona:
    'Spatial Analyst and Technical Guide: deconstructs geometric proof and absolute scale. Detached from academic gatekeeping; views the world as unfolding origami. Uses precise physical vocabulary paired with spatial or mechanical comparisons. Take as many frames as the proof requires — clarity over brevity. Trigger lines like "Think of it not as a static value, Amara, but as a continuous folding operation..."',
  aliases: ['malik', 'jamil', 'al-jamil'],
  speakingImages: [],
})

// ---------------------------------------------------------------------------
// Job Market / Career — "The Pivot" (solo career strategist)
// ---------------------------------------------------------------------------
export const HOST_PRIYA = host({
  name: 'Priya Menon',
  role: 'Career strategist',
  voiceId: 'Vindemiatrix',
  ttsStylePrompt:
    'Pragmatic, motivating career strategist. Direct and grounded, delivering actionable guidance at a confident pace.',
  speakingRate: 1.0,
  bio: 'A pragmatic career strategist who turns labor-market shifts into concrete, doable next steps.',
  persona:
    'Pragmatic career strategist who translates labor-market shifts into direct, actionable guidance and concrete next steps.',
  aliases: ['priya', 'menon'],
  speakingImages: [],
})

// ---------------------------------------------------------------------------
// True Crime — "The Casefile" (duo, somber procedural)
// ---------------------------------------------------------------------------
export const HOST_VIVIAN = host({
  name: 'Vivian Cross',
  role: 'Investigative journalist',
  voiceId: 'Autonoe',
  ttsStylePrompt:
    'Measured investigative journalist. Somber, precise, and humane, narrating at a deliberate pace.',
  speakingRate: 0.98,
  bio: 'An investigative journalist who reconstructs cases meticulously and respects the people involved.',
  persona:
    'Measured investigative journalist who reconstructs the timeline meticulously, weighs evidence, and keeps a humane, somber tone.',
  aliases: ['vivian', 'cross'],
  speakingImages: [],
})

export const HOST_FRANK = host({
  name: 'Frank Calderon',
  role: 'Ex-detective analyst',
  voiceId: 'Iapetus',
  ttsStylePrompt:
    'Seasoned ex-detective analyst. Calm, gravelly authority, parsing evidence at a steady, deliberate pace.',
  speakingRate: 0.98,
  bio: 'A retired detective who reads evidence and procedure with hard-won instinct.',
  persona:
    'Seasoned ex-detective who analyzes evidence, procedure, and motive with hard-won instinct and restraint.',
  aliases: ['frank', 'calderon'],
  speakingImages: [],
})

// ---------------------------------------------------------------------------
// Unexplained & Mystery — "The Unexplained" (duo, believer vs skeptic)
// ---------------------------------------------------------------------------
export const HOST_IRIS = host({
  name: 'Iris Lang',
  role: 'Open-minded researcher',
  voiceId: 'Aoede',
  ttsStylePrompt:
    'Curious, open-minded researcher. Intrigued and atmospheric, drawing the listener in at an engaging pace.',
  speakingRate: 1.0,
  bio: 'A researcher fascinated by the unexplained who follows the strange wherever it leads.',
  persona:
    'Open-minded researcher who lays out the phenomenon and the most intriguing evidence with genuine wonder.',
  aliases: ['iris', 'lang'],
  speakingImages: [],
})

export const HOST_HUGO = host({
  name: 'Dr. Hugo Reyes',
  shortName: 'Dr. Reyes',
  role: 'Skeptic scientist',
  voiceId: 'Enceladus',
  ttsStylePrompt:
    'Rigorous skeptic scientist. Dry, precise, and good-humored, testing claims at a measured pace.',
  speakingRate: 1.0,
  bio: 'A scientist who applies Occam’s razor and demands evidence — without killing the wonder.',
  persona:
    'Rigorous skeptic scientist who pressure-tests every claim, offers prosaic explanations, and demands evidence.',
  aliases: ['hugo', 'reyes'],
  speakingImages: [],
})

// ---------------------------------------------------------------------------
// Pop Culture — "The Green Room" (duo, witty banter)
// ---------------------------------------------------------------------------
export const HOST_ZOE = host({
  name: 'Zoe Tan',
  role: 'Culture host',
  voiceId: 'Leda',
  ttsStylePrompt: 'Witty, fast culture host. Playful and quick, trading takes at a lively pace.',
  speakingRate: 1.05,
  bio: 'A culture obsessive with razor-sharp takes and impeccable timing.',
  persona: 'Witty, fast culture host with sharp hot takes, plugged into the discourse and quick to react.',
  aliases: ['zoe', 'tan'],
  speakingImages: [],
})

export const HOST_ANDRE = host({
  name: 'Andre Brooks',
  role: 'Culture co-host',
  voiceId: 'Puck',
  ttsStylePrompt: 'Charismatic culture co-host. Warm and funny, riffing at an energetic pace.',
  speakingRate: 1.05,
  bio: 'A charismatic co-host who grounds the hype with context and history.',
  persona: 'Charismatic culture co-host who adds context and history, grounding the hot takes with perspective.',
  aliases: ['andre', 'brooks'],
  speakingImages: [],
})

// ---------------------------------------------------------------------------
// Film & TV — "Frame by Frame" (duo, cinephile analysis)
// ---------------------------------------------------------------------------
export const HOST_NORA = host({
  name: 'Nora Adeyemi',
  role: 'Film critic',
  voiceId: 'Callirrhoe',
  ttsStylePrompt: 'Eloquent film critic. Thoughtful and evocative, analyzing craft at a considered pace.',
  speakingRate: 1.0,
  bio: 'A critic with a painter’s eye for craft, performance, and form.',
  persona: 'Eloquent film critic who analyzes craft, performance, and form with an evocative, considered eye.',
  aliases: ['nora', 'adeyemi'],
  speakingImages: [],
})

export const HOST_SAM = host({
  name: 'Sam Ortiz',
  role: 'Film co-host',
  voiceId: 'Fenrir',
  ttsStylePrompt: 'Sharp film co-host. Enthusiastic and incisive, debating at a brisk pace.',
  speakingRate: 1.0,
  bio: 'A co-host who connects films to genre, industry, and audience.',
  persona: 'Sharp film co-host who connects the work to genre, industry context, and audience, and pushes the debate.',
  aliases: ['sam', 'ortiz'],
  speakingImages: [],
})

// ---------------------------------------------------------------------------
// Music — "Liner Notes" (duo, passionate)
// ---------------------------------------------------------------------------
export const HOST_MIA = host({
  name: 'Mia Solis',
  role: 'Music host',
  voiceId: 'Despina',
  ttsStylePrompt: 'Passionate music host. Expressive and rhythmic, breaking down sound at a flowing pace.',
  speakingRate: 1.0,
  bio: 'A music writer who hears the craft in every arrangement.',
  persona: 'Passionate music host who breaks down sound, songwriting, and production with infectious enthusiasm.',
  aliases: ['mia', 'solis'],
  speakingImages: [],
})

export const HOST_THEO = host({
  name: 'Theo Nakamura',
  role: 'Music co-host',
  voiceId: 'Orus',
  ttsStylePrompt: 'Knowledgeable music co-host. Cool and articulate, placing the work in context at a steady pace.',
  speakingRate: 1.0,
  bio: 'A co-host steeped in music history and scene context.',
  persona: 'Knowledgeable music co-host who places releases in cultural and historical context.',
  aliases: ['theo', 'nakamura'],
  speakingImages: [],
})

// Music genre channels — shared solo mixer host (channel intro only; tracks are Lyria-generated).
export const HOST_MIXER = host({
  name: 'DJ Nova Reyes',
  role: 'Club DJ & genre curator',
  voiceId: 'Zephyr',
  ttsStylePrompt:
    'Confident club DJ and curator. Energetic, warm, and rhythm-aware with crisp broadcast delivery.',
  speakingRate: 1.05,
  bio: 'Veteran DJ and mixer who curates genre-specific sound — from boom bap to bossa, ambient to acid house.',
  persona:
    'Veteran DJ and genre curator who shapes mood, tempo, and instrumentation for each channel. Speaks like a mixer, not a news anchor — punchy, rhythmic, and scene-aware.',
  aliases: ['nova', 'reyes', 'dj', 'mixer', 'nova reyes'],
  speakingImages: [],
})

// ---------------------------------------------------------------------------
// Gaming — "Player Two" (duo, energetic insiders)
// ---------------------------------------------------------------------------
export const HOST_KAI = host({
  name: 'Kai Nguyen',
  role: 'Gaming host',
  voiceId: 'Zephyr',
  ttsStylePrompt: 'Energetic gaming host. Hyped and insightful, breaking down play at a fast pace.',
  speakingRate: 1.05,
  bio: 'A gaming host who lives in the meta and loves the craft of play.',
  persona: 'Energetic gaming host who breaks down mechanics, design, and the meta with insider enthusiasm.',
  aliases: ['kai', 'nguyen'],
  speakingImages: [],
})

export const HOST_BREE = host({
  name: 'Bree Sullivan',
  role: 'Gaming co-host',
  voiceId: 'Sulafat',
  ttsStylePrompt: 'Savvy gaming co-host. Warm and witty, weighing design and culture at a lively pace.',
  speakingRate: 1.05,
  bio: 'A co-host who tracks the industry, communities, and culture of games.',
  persona: 'Savvy gaming co-host who weighs design choices, community reaction, and who a game is really for.',
  aliases: ['bree', 'sullivan'],
  speakingImages: [],
})

// ---------------------------------------------------------------------------
// Home & Lifestyle — "The Good Life" (duo, warm practical service journalism)
// ---------------------------------------------------------------------------
export const HOST_MAYA = host({
  name: 'Maya Ellis',
  role: 'Lifestyle host',
  voiceId: 'Aoede',
  ttsStylePrompt:
    'Warm, encouraging lifestyle host. Friendly and reassuring, sharing practical guidance at an easy, conversational pace.',
  speakingRate: 1.0,
  bio: 'A warm lifestyle host who turns everyday goals into simple, doable steps.',
  persona:
    'Warm, encouraging lifestyle host who meets listeners where they are and breaks goals into approachable, practical steps.',
  aliases: ['maya', 'ellis'],
  speakingImages: [],
})

export const HOST_CALEB = host({
  name: 'Caleb Ward',
  role: 'Practical co-host',
  voiceId: 'Puck',
  ttsStylePrompt:
    'Down-to-earth practical co-host. Friendly and grounded, adding hands-on tips and realistic trade-offs at a natural pace.',
  speakingRate: 1.0,
  bio: 'A hands-on co-host who keeps advice realistic, affordable, and easy to start.',
  persona:
    'Down-to-earth co-host who pressure-tests advice for real budgets and schedules and surfaces the common pitfalls.',
  aliases: ['caleb', 'ward'],
  speakingImages: [],
})

// ---------------------------------------------------------------------------
// Show registry
// ---------------------------------------------------------------------------

function makeShow(
  show: Omit<Show, 'format' | 'introImage' | 'coverImage' | 'introAudio'> & { introImage?: string }
): Show {
  // Studio/host-fallback frame: prefer a bespoke studio render, then the
  // channel's own cover key-art (which depicts this channel's hosts), and only
  // then the passed-in placeholder. This keeps per-category channels that reuse
  // a house cast (e.g. Lifestyle's Maya + Caleb) from falling back to the
  // canonical News studio image when they have no bespoke studio/portraits yet.
  const studioImage = SHOW_STUDIO_ART[show.id] ?? SHOW_COVER_ART[show.id] ?? show.studioImage
  // Prefer generated intro art; fall back to an explicit intro (News uses the
  // existing Anderson + Chen image) and finally to the show's studio frame.
  const introImage = SHOW_INTRO_ART[show.id] ?? show.introImage ?? studioImage
  return {
    ...show,
    studioImage,
    introImage,
    // Fixed poster-style cover for the channel hero/cards; degrades to the intro
    // frame (and then studio) until the cover art is generated.
    coverImage: SHOW_COVER_ART[show.id] ?? introImage,
    // Pre-generated channel intro audio; undefined until the script runs.
    introAudio: SHOW_INTRO_AUDIO[show.id],
    format: show.hosts.length === 1 ? 'solo' : 'dialogue',
  }
}

export const SHOW_NEWS = makeShow({
  id: 'clearsight-brief',
  name: 'The ClearSight Brief',
  description:
    'The flagship ClearSight news desk. Dr. Anderson and Sarah Chen cut through the noise with dense, even-handed analysis of the day’s most consequential stories — steel-manning every side and forecasting what comes next, across politics, business, finance, technology, science, health, sports, crime, and world affairs.',
  focus:
    'Current events and consequential news across politics, business, finance, economics, technology, science, health, sports, crime, world affairs, and society — analyzed with even-handed, evidence-based depth.',
  introTagline:
    'Welcome to The ClearSight Brief, your unbiased deep-dive into the stories that matter — where we steel-man every side and forecast what comes next.',
  contentType: 'News',
  categories: [],
  hosts: [HOST_SARAH, HOST_ANDERSON],
  visualStyle:
    'Style: clean, symbolic, professional news-magazine editorial illustration. Muted slate and indigo palette.',
  scriptStructure: [
    'Cold open: skip the preamble — Sarah hits the listener with the single highest-stakes data point or event; Benjamin frames the core tension in one move',
    'Dialectical deep dive, Phase 1 (Side A): Sarah makes the strongest case for one side using hard metrics; Benjamin supplies the analytical context for why it holds weight',
    'Dialectical deep dive, Phase 2 (Side B): Sarah pivots sharply to steel-man the opposing side, surfacing anomalies and counter-arguments; Benjamin breaks down the structural incentives driving it',
    'Close: Dr. Benjamin Anderson delivers a definitive summary separating verified briefing facts from prevalent online myths; Sarah\'s CTA (after the body) transitions into Ask the Host — no verdict, no conclusion label',
  ],
  scriptPhilosophy:
    'SHOW PHILOSOPHY — "The ClearSight Brief": Cut through the noise with dense, even-handed analysis of one consequential story. Map the evidence transparently and steel-man EVERY perspective at its maximum intellectual strength. Do NOT take a side, do NOT patronize with summaries, and do NOT deliver a definitive final verdict or a section labeled "Conclusion" — present the balanced evidence as a conversational "table of evidence" and let the listener decide.\n' +
    'STRUCTURE THE DEBATE AS A DIALECTIC: Phase 1 builds Side A on hard metrics with Benjamin\'s context; Phase 2 sharply steel-mans Side B with the structural incentives behind it. Both sides must be presented at full strength.\n' +
    'RETENTION & AUDIO RULES: Write for the EAR, not the eye — short, varied sentence lengths, natural contractions (it\'s, they\'re, what\'s), and conversational transitions. Open on the highest-stakes point, not a greeting. Hosts must talk WITH each other in rapid hand-offs with frequent micro-agreement and pushback ("Let\'s push back on that…", "But the counter-metric here is…") — never long uninterrupted essays. Sarah is the sharp, fast, probing driver; Benjamin is the calm, authoritative anchor who supplies structural and historical context. CLOSING: Benjamin owns the epistemic close (verified facts vs. online myths); Sarah owns the interactive handoff into Ask the Host after the body. Target roughly 700-750 spoken words.',
  noVerdict: true,
  sceneDirectorNotes:
    'Scene: modern intelligence newsroom. Tone: analytical, dense, energetic — no fluff. Pace: natural with thoughtful pauses.',
  studioImage: HOSTS_IMAGE,
  introImage:
    'https://xxavfkdhdebrqida.public.blob.vercel-storage.com/Gemini_Generated_Image_wdqh2gwdqh2gwdqh.png',
})

export const SHOW_ACADEMY = makeShow({
  id: 'clearsight-academy',
  name: 'ClearSight Academy',
  description:
    'Your guided tour through big ideas. Dr. Lena Okafor and Diego Santos build understanding from first principles — defining the jargon, working through vivid examples, and busting the common misconceptions across science, math, history, technology, and beyond.',
  focus:
    'Educational explainers that teach concepts from first principles across science, mathematics, history, technology, health, economics, and the broader world of ideas.',
  introTagline:
    'Welcome to ClearSight Academy, where we build big ideas from the ground up — defining the jargon and making the complex click.',
  contentType: 'Education',
  categories: [],
  hosts: [HOST_LENA, HOST_DIEGO],
  visualStyle:
    'Style: clear, instructional editorial illustration — diagrammatic, labeled-feeling, explanatory.',
  scriptStructure: [
    'Hook: a question or surprising fact that makes the topic matter',
    'Why it matters: stakes and relevance',
    'Core concept: explained from first principles, defining each term',
    'Worked example / analogy: make it concrete and picturable',
    'Common misconception: surface and correct it',
    'Recap: the key takeaways to remember',
  ],
  sceneDirectorNotes:
    'Scene: bright teaching studio. Tone: warm, lucid, Socratic. Pace: unhurried and clear.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_PIVOT = makeShow({
  id: 'the-pivot',
  name: 'The Pivot',
  description:
    'Career strategy for a fast-changing world. Priya Menon turns labor-market shifts into concrete, doable next steps — what’s changing, who it affects, the skills that matter now, and exactly how to start building them today.',
  focus:
    'Careers, work, and the labor market — industry shifts, in-demand skills, job-search strategy, and practical professional growth.',
  introTagline:
    'Welcome to The Pivot, where we turn a fast-changing job market into your next concrete move.',
  contentType: 'Education',
  categories: ['Career & Job Market'],
  hosts: [HOST_PRIYA],
  visualStyle:
    'Style: modern, practical workplace editorial illustration — clean infographic feel, professional palette.',
  scriptStructure: [
    'Trend snapshot: the shift happening in the job market',
    'What’s driving it: the forces behind the change',
    'Who’s affected: roles, industries, and regions',
    'Skills that matter now: what to build',
    'Concrete next steps: an actionable plan the listener can start today',
  ],
  sceneDirectorNotes:
    'Scene: solo career strategist in a clean modern studio. Tone: pragmatic, direct, motivating. Pace: confident.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_CASEFILE = makeShow({
  id: 'the-casefile',
  name: 'The Casefile',
  description:
    'Meticulous true-crime storytelling with a conscience. Investigative journalist Vivian Cross and ex-detective Frank Calderon reconstruct each case from the evidence up — weighing competing theories, respecting the people involved, and naming what’s still unresolved.',
  focus:
    'Real, documented true-crime cases and investigations — timelines, evidence, and competing theories told meticulously and respectfully. Not fictional crime or gratuitous gore.',
  introTagline:
    'Welcome to The Casefile, where we reconstruct each case from the evidence up — meticulously, and with respect for everyone involved.',
  contentType: 'Entertainment',
  categories: ['True Crime'],
  hosts: [HOST_VIVIAN, HOST_FRANK],
  visualStyle:
    'Style: cinematic, somber, procedural editorial illustration — moody noir atmosphere, restrained and respectful.',
  scriptStructure: [
    'Cold open: the moment that grabs you',
    'Background: who and where',
    'Timeline: how events unfolded',
    'Evidence: what the reporting establishes',
    'Theories: competing explanations weighed against the evidence',
    'What’s unresolved: the open questions',
  ],
  sceneDirectorNotes:
    'Scene: dim case-review studio. Tone: somber, procedural, humane. Pace: deliberate.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_UNEXPLAINED = makeShow({
  id: 'the-unexplained',
  name: 'The Unexplained',
  description:
    'Where wonder meets rigor. Open-minded researcher Iris Lang lays out the strangest claims and the most intriguing evidence, while skeptic scientist Dr. Hugo Reyes pressure-tests every one — a genuine believer-vs-skeptic clash over the mysteries that won’t go away.',
  focus:
    'Unexplained phenomena and enduring mysteries — strange claims, anomalies, and the unsolved — explored through a genuine believer-versus-skeptic lens.',
  introTagline:
    'Welcome to The Unexplained, where wonder meets rigor and every mystery gets the believer-versus-skeptic treatment.',
  contentType: 'Entertainment',
  categories: ['Unexplained & Mystery'],
  hosts: [HOST_IRIS, HOST_HUGO],
  visualStyle:
    'Style: atmospheric, enigmatic editorial illustration — dramatic light, a sense of the uncanny.',
  scriptStructure: [
    'Hook: the strange claim or event',
    'The phenomenon: what is reported to happen',
    'The evidence: what we actually have',
    'Competing explanations: natural vs extraordinary',
    'Skeptic vs believer: the genuine clash of interpretations',
    'Open question: what would settle it',
  ],
  sceneDirectorNotes:
    'Scene: atmospheric studio. Tone: intrigued researcher vs rigorous skeptic. Pace: engaging, building tension.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_GREENROOM = makeShow({
  id: 'the-green-room',
  name: 'The Green Room',
  description:
    'The pop-culture conversation, unfiltered. Zoe Tan brings the sharp hot takes and Andre Brooks grounds them in context and history — fast, funny, plugged-in breakdowns of what the culture is actually talking about and why it matters.',
  focus:
    'Pop culture and the entertainment conversation — celebrities, trends, internet moments, and the discourse, with sharp takes grounded in context.',
  introTagline:
    'Welcome to The Green Room, where we serve the hottest takes in pop culture — and then back them up.',
  contentType: 'Entertainment',
  categories: ['Pop Culture'],
  hosts: [HOST_ZOE, HOST_ANDRE],
  visualStyle:
    'Style: vibrant, glossy pop-culture editorial illustration — bold color, energetic and contemporary.',
  scriptStructure: [
    'Hot-take open: the take that starts the argument',
    'The story: what actually happened',
    'Reactions & context: how the culture responded',
    'Why it matters: the bigger cultural shift',
    'Predictions: where this goes next',
  ],
  sceneDirectorNotes:
    'Scene: lively green room. Tone: witty, fast, playful banter. Pace: quick.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_FRAMEBYFRAME = makeShow({
  id: 'frame-by-frame',
  name: 'Frame by Frame',
  description:
    'Cinema and television, taken seriously and joyfully. Critic Nora Adeyemi reads craft, performance, and form with a painter’s eye, while Sam Ortiz connects every work to its genre, industry, and audience — spoiler-aware verdicts on what’s worth your time.',
  focus:
    'Film and television — reviews, craft analysis, performances, genres, and the industry, delivered with spoiler-aware verdicts.',
  introTagline:
    'Welcome to Frame by Frame, where we take film and TV seriously — and joyfully — one frame at a time.',
  contentType: 'Entertainment',
  categories: ['Film & TV'],
  hosts: [HOST_NORA, HOST_SAM],
  visualStyle:
    'Style: cinematic, painterly editorial illustration — dramatic composition and lighting, film-still feel.',
  scriptStructure: [
    'Hook: why this film/show is worth your time',
    'Premise: the setup, spoiler-free',
    'Craft & standouts: direction, performance, writing, design',
    'Comparisons: how it sits against its genre and peers',
    'Verdict: who should watch and why',
  ],
  sceneDirectorNotes:
    'Scene: cinephile studio. Tone: analytical, evocative, spoiler-aware. Pace: considered.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_LINERNOTES = makeShow({
  id: 'liner-notes',
  name: 'Liner Notes',
  description:
    'A love letter to the craft of music. Mia Solis breaks down songwriting, production, and arrangement with infectious enthusiasm, and Theo Nakamura places every release in its cultural and historical context — plus the tracks you shouldn’t miss.',
  focus:
    'Music — artists, releases, songwriting, production, and the culture and history around the sound, with listening recommendations.',
  introTagline:
    'Welcome to Liner Notes, a love letter to the craft of music — where we break down the sound and the story behind it.',
  contentType: 'Entertainment',
  categories: ['Music'],
  hosts: [HOST_MIA, HOST_THEO],
  visualStyle:
    'Style: expressive, rhythmic editorial illustration — musical motifs, rich texture and color.',
  scriptStructure: [
    'Hook: the moment that makes this release matter',
    'The release / artist: who and what',
    'Sound breakdown: songwriting, production, arrangement',
    'Cultural context: where it fits and what it borrows',
    'Recommendation: the tracks and why',
  ],
  sceneDirectorNotes:
    'Scene: warm listening studio. Tone: passionate, knowledgeable. Pace: flowing.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_PLAYERTWO = makeShow({
  id: 'player-two',
  name: 'Player Two',
  description:
    'Games, from the inside out. Kai Nguyen breaks down mechanics, design, and the meta with insider energy, while Bree Sullivan weighs community reaction and who a game is really for — the headlines players are actually talking about.',
  focus:
    'Video games and gaming culture — releases, mechanics, design, the meta, industry news, and community reaction.',
  introTagline:
    'Welcome to Player Two, where we break down games from the inside out — mechanics, meta, and all.',
  contentType: 'Entertainment',
  categories: ['Gaming'],
  hosts: [HOST_KAI, HOST_BREE],
  visualStyle:
    'Style: dynamic, vivid gaming editorial illustration — energetic, stylized, modern.',
  scriptStructure: [
    'Hook: the headline players are talking about',
    'What it is: the game and its promise',
    'Mechanics: how it actually plays',
    'Standouts & flaws: what shines and what drags',
    'Who it’s for: the verdict',
  ],
  sceneDirectorNotes:
    'Scene: high-energy gaming studio. Tone: energetic, insider, witty. Pace: fast.',
  studioImage: PLACEHOLDER_STUDIO,
})

// ---------------------------------------------------------------------------
// Music genre channels (Lyria 3 Pro — HD music-only, no podcast pipeline)
// ---------------------------------------------------------------------------

const MUSIC_LYRIA_BASE =
  'Target 90–120 seconds at 44.1 kHz stereo. High-fidelity, professionally mixed, no speech or podcast narration.'

export const SHOW_HIPHOP = makeShow({
  id: 'clearsight-hip-hop',
  name: 'ClearSight Hip-Hop',
  description:
    'Boom bap, hard-hitting beats, and lo-fi curated by DJ Nova Reyes. On-demand HD tracks built for study, cyphers, and late-night sessions.',
  focus:
    'Hip-hop instrumentals and full tracks — beats, boom bap, lo-fi hip-hop, and sample-driven production.',
  introTagline:
    'Welcome to ClearSight Hip-Hop — where DJ Nova Reyes drops the beats that hit.',
  contentType: 'Music',
  categories: ['Hip-Hop'],
  hosts: [HOST_MIXER],
  visualStyle: 'Style: urban, rhythmic editorial illustration — vinyl, city nightscapes, bold typography-free motifs.',
  scriptStructure: [
    `${MUSIC_LYRIA_BASE} Genre: hip-hop. Emphasize punchy drums, bass, and sample texture.`,
  ],
  sceneDirectorNotes: 'Mood: confident, head-nodding. BPM: 80–95 for boom bap, 130–150 for hard-hitting hip-hop beats.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_ELECTRONIC = makeShow({
  id: 'clearsight-electronic',
  name: 'ClearSight Electronic',
  description:
    'House, techno, and synthwave from the mixer booth. High-definition electronic tracks generated on demand.',
  focus:
    'Electronic music — house, techno, synthwave, ambient electronic, and drum & bass.',
  introTagline:
    'Welcome to ClearSight Electronic — synthesized sound, curated by DJ Nova Reyes.',
  contentType: 'Music',
  categories: ['Electronic'],
  hosts: [HOST_MIXER],
  visualStyle: 'Style: neon, futuristic editorial illustration — waveforms, club lights, schematic motifs.',
  scriptStructure: [
    `${MUSIC_LYRIA_BASE} Genre: electronic dance. Emphasize synth layers, four-on-the-floor or breakbeats.`,
  ],
  sceneDirectorNotes: 'Mood: driving, hypnotic, luminous. BPM: 120–128 house, 130+ techno.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_JAZZ = makeShow({
  id: 'clearsight-jazz',
  name: 'ClearSight Jazz',
  description:
    'Smooth jazz, bebop, and fusion — improvised warmth generated as HD audio on demand.',
  focus: 'Jazz — smooth jazz, bebop, fusion, cool jazz, and swing.',
  introTagline: 'Welcome to ClearSight Jazz — improvisation and groove with DJ Nova Reyes.',
  contentType: 'Music',
  categories: ['Jazz'],
  hosts: [HOST_MIXER],
  visualStyle: 'Style: smoky, sophisticated editorial illustration — brass, piano, club stage.',
  scriptStructure: [
    `${MUSIC_LYRIA_BASE} Genre: jazz. Emphasize live instrumentation, walking bass, brushed drums.`,
  ],
  sceneDirectorNotes: 'Mood: warm, sophisticated, swinging. BPM: 90–140 depending on sub-style.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_ROCK = makeShow({
  id: 'clearsight-rock',
  name: 'ClearSight Rock',
  description:
    'Classic rock, indie, and alternative — guitar-driven HD tracks from the ClearSight mixer.',
  focus: 'Rock — classic rock, indie rock, alternative, hard rock, and post-rock.',
  introTagline: 'Welcome to ClearSight Rock — turn it up with DJ Nova Reyes.',
  contentType: 'Music',
  categories: ['Rock'],
  hosts: [HOST_MIXER],
  visualStyle: 'Style: gritty, energetic editorial illustration — guitars, amps, stadium energy.',
  scriptStructure: [
    `${MUSIC_LYRIA_BASE} Genre: rock. Emphasize electric guitar, drums, and dynamic arrangement.`,
  ],
  sceneDirectorNotes: 'Mood: anthemic, raw, or introspective. BPM: 100–140.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_CLASSICAL = makeShow({
  id: 'clearsight-classical',
  name: 'ClearSight Classical',
  description:
    'Orchestral, piano, and chamber works — refined HD compositions generated on demand.',
  focus: 'Classical music — orchestral, piano, chamber, opera, and minimalist works.',
  introTagline:
    'Welcome to ClearSight Classical — timeless composition, mixed by DJ Nova Reyes.',
  contentType: 'Music',
  categories: ['Classical'],
  hosts: [HOST_MIXER],
  visualStyle: 'Style: elegant, refined editorial illustration — concert hall, strings, gold tones.',
  scriptStructure: [
    `${MUSIC_LYRIA_BASE} Genre: classical. Emphasize orchestral or solo piano with clear dynamics.`,
  ],
  sceneDirectorNotes: 'Mood: majestic, intimate, or contemplative. Tempo varies by form.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_AMBIENT = makeShow({
  id: 'clearsight-ambient',
  name: 'ClearSight Ambient',
  description:
    'Soundscapes, meditation beds, and cinematic drones — immersive HD ambient on demand.',
  focus: 'Ambient music — soundscapes, meditation, drone, cinematic, and nature-inspired beds.',
  introTagline:
    'Welcome to ClearSight Ambient — breathe deep with DJ Nova Reyes.',
  contentType: 'Music',
  categories: ['Ambient'],
  hosts: [HOST_MIXER],
  visualStyle: 'Style: ethereal, atmospheric editorial illustration — mist, horizons, soft gradients.',
  scriptStructure: [
    `${MUSIC_LYRIA_BASE} Genre: ambient. Emphasize pads, slow evolution, spacious reverb.`,
  ],
  sceneDirectorNotes: 'Mood: calm, expansive, meditative. BPM: 60–80 or free time.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_RNB = makeShow({
  id: 'clearsight-rnb',
  name: 'ClearSight R&B',
  description:
    'Neo-soul, contemporary R&B, and slow jams — silky HD tracks curated on demand.',
  focus: 'R&B and soul — neo-soul, contemporary R&B, funk, slow jams, and gospel-inflected grooves.',
  introTagline: 'Welcome to ClearSight R&B — smooth grooves with DJ Nova Reyes.',
  contentType: 'Music',
  categories: ['R&B'],
  hosts: [HOST_MIXER],
  visualStyle: 'Style: warm, soulful editorial illustration — vinyl warmth, city lights, velvet tones.',
  scriptStructure: [
    `${MUSIC_LYRIA_BASE} Genre: R&B/soul. Emphasize groove, keys, and warm bass.`,
  ],
  sceneDirectorNotes: 'Mood: smooth, intimate, groovy. BPM: 70–100.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_LATIN = makeShow({
  id: 'clearsight-latin',
  name: 'ClearSight Latin',
  description:
    'Reggaeton, salsa, bossa nova, and Latin pop — rhythmic HD tracks from the mixer.',
  focus: 'Latin music — reggaeton, salsa, bossa nova, cumbia, and Latin pop.',
  introTagline:
    'Welcome to ClearSight Latin — ritmo y sabor with DJ Nova Reyes.',
  contentType: 'Music',
  categories: ['Latin'],
  hosts: [HOST_MIXER],
  visualStyle: 'Style: vibrant, tropical editorial illustration — percussion, dance, warm palette.',
  scriptStructure: [
    `${MUSIC_LYRIA_BASE} Genre: Latin. Emphasize percussion, clave or dembow patterns, warm brass or nylon guitar.`,
  ],
  sceneDirectorNotes: 'Mood: festive, romantic, or driving. BPM: 90–110 salsa, 90 reggaeton dembow.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_GOODLIFE = makeShow({
  id: 'the-good-life',
  name: 'The Good Life',
  description:
    'Practical inspiration for everyday living. Maya Ellis and Caleb Ward turn the goals behind a better daily life — cooking, travel, home, health, money, relationships, and more — into simple, doable steps, with the reasoning and trade-offs spelled out so you can actually start today.',
  focus:
    'Home and lifestyle how-to and inspiration across food, travel, home & garden, health & fitness, relationships, personal finance, parenting, style, wellness, and pets — practical, evergreen, and actionable.',
  introTagline:
    'Welcome to The Good Life, where we turn everyday goals into simple, doable steps you can start today.',
  contentType: 'Lifestyle',
  categories: [],
  hosts: [HOST_MAYA, HOST_CALEB],
  visualStyle:
    'Style: warm, inviting lifestyle editorial illustration — bright, friendly, aspirational, with natural light and a clean modern palette.',
  scriptStructure: [
    'Hook: the everyday goal or problem this solves',
    'What to know first: the key context or principle',
    'Step by step: the concrete approach and options',
    'Pitfalls & trade-offs: common mistakes and how to weigh choices',
    'Action plan: the simple first steps to take today',
  ],
  sceneDirectorNotes:
    'Scene: bright, homey lifestyle studio. Tone: warm, encouraging, practical. Pace: relaxed and conversational.',
  studioImage: PLACEHOLDER_STUDIO,
})

// ---------------------------------------------------------------------------
// Per-category Lifestyle channels (reuse The Good Life's house cast). Each owns
// a single category so on-demand episodes are tagged with that exact category.
// ---------------------------------------------------------------------------
export const SHOW_KITCHEN = makeShow({
  id: 'clearsight-kitchen',
  name: 'ClearSight Kitchen',
  description:
    'Cook with confidence. Maya Ellis and Caleb Ward turn recipes, techniques, and meal planning into simple, repeatable steps — what to buy, how to make it, and the little tricks that make it work every time.',
  focus:
    'Food and cooking — recipes, techniques, baking, meal prep, ingredients, world cuisine, and kitchen know-how, made practical and doable.',
  introTagline:
    'Welcome to ClearSight Kitchen, where we turn great food into simple steps you can actually make tonight.',
  contentType: 'Lifestyle',
  categories: ['Food & Cooking'],
  hosts: [HOST_MAYA, HOST_CALEB],
  visualStyle:
    'Style: warm, appetizing food editorial illustration — fresh ingredients and inviting kitchen scenes, natural light, clean modern palette.',
  scriptStructure: [
    'Hook: the dish or skill and why it is worth making',
    'What to know first: key ingredients, tools, or technique',
    'Step by step: the method, in clear order',
    'Pitfalls & trade-offs: common mistakes and easy fixes',
    'Action plan: how to start and make it your own',
  ],
  sceneDirectorNotes:
    'Scene: bright, homey kitchen studio. Tone: warm, encouraging, practical. Pace: relaxed and conversational.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_TRAVEL = makeShow({
  id: 'clearsight-travel',
  name: 'ClearSight Travel',
  description:
    'Travel smarter and farther. Maya Ellis and Caleb Ward break down destinations, planning, and on-the-road know-how into practical itineraries and tips — so you spend less, see more, and stress less.',
  focus:
    'Travel — destinations, trip planning, budget travel, road trips, packing, and practical travel tips for every kind of traveler.',
  introTagline:
    'Welcome to ClearSight Travel, where we turn wanderlust into a plan you can actually book.',
  contentType: 'Lifestyle',
  categories: ['Travel'],
  hosts: [HOST_MAYA, HOST_CALEB],
  visualStyle:
    'Style: vivid, inviting travel editorial illustration — scenic destinations and journey motifs, bright natural light, aspirational and clean.',
  scriptStructure: [
    'Hook: the destination or travel goal and why now',
    'What to know first: timing, budget, and logistics',
    'Step by step: how to plan and what to prioritize',
    'Pitfalls & trade-offs: common mistakes and how to avoid them',
    'Action plan: the first steps to start booking',
  ],
  sceneDirectorNotes:
    'Scene: bright travel-desk studio. Tone: warm, adventurous, practical. Pace: relaxed and conversational.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_HOMEGARDEN = makeShow({
  id: 'clearsight-home-garden',
  name: 'ClearSight Home & Garden',
  description:
    'Make your space work for you. Maya Ellis and Caleb Ward tackle interior design, DIY projects, gardening, and organization with realistic, budget-aware steps — the why behind each choice and how to actually get it done.',
  focus:
    'Home and garden — interior design, DIY projects, gardening, organization, and decor, with practical, budget-aware guidance.',
  introTagline:
    'Welcome to ClearSight Home & Garden, where we turn a better space into a weekend you can plan.',
  contentType: 'Lifestyle',
  categories: ['Home & Garden'],
  hosts: [HOST_MAYA, HOST_CALEB],
  visualStyle:
    'Style: warm, inviting home-and-garden editorial illustration — tidy interiors and lush greenery, natural light, clean modern palette.',
  scriptStructure: [
    'Hook: the space or project and the goal',
    'What to know first: materials, budget, and constraints',
    'Step by step: the approach and the options',
    'Pitfalls & trade-offs: common mistakes and how to weigh choices',
    'Action plan: the first steps to take this week',
  ],
  sceneDirectorNotes:
    'Scene: bright, homey design studio. Tone: warm, encouraging, practical. Pace: relaxed and conversational.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_FITNESS = makeShow({
  id: 'clearsight-fitness',
  name: 'ClearSight Fitness',
  description:
    'Get healthier without the hype. Maya Ellis and Caleb Ward translate workouts, nutrition, and recovery into sustainable routines — what the evidence supports, how to start, and how to keep going.',
  focus:
    'Health and fitness — workouts, nutrition, running, strength training, yoga, and recovery, grounded in practical, sustainable habits.',
  introTagline:
    'Welcome to ClearSight Fitness, where we turn healthy goals into a routine you can keep.',
  contentType: 'Lifestyle',
  categories: ['Health & Fitness'],
  hosts: [HOST_MAYA, HOST_CALEB],
  visualStyle:
    'Style: energetic, clean fitness editorial illustration — movement and wellbeing motifs, bright natural light, modern palette.',
  scriptStructure: [
    'Hook: the fitness goal and why it matters',
    'What to know first: the principle or evidence behind it',
    'Step by step: the routine or approach to follow',
    'Pitfalls & trade-offs: common mistakes and how to stay safe',
    'Action plan: the simple first steps to start today',
  ],
  sceneDirectorNotes:
    'Scene: bright, active wellness studio. Tone: warm, motivating, practical. Pace: relaxed and encouraging.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_RELATIONSHIPS = makeShow({
  id: 'clearsight-relationships',
  name: 'ClearSight Relationships',
  description:
    'Build better connections. Maya Ellis and Caleb Ward explore dating, marriage, friendship, and communication with warmth and realism — concrete tools and conversations that actually help.',
  focus:
    'Relationships — dating, marriage, friendship, communication, and family ties, explored with warm, practical, non-judgmental guidance.',
  introTagline:
    'Welcome to ClearSight Relationships, where we turn connection into conversations you can actually have.',
  contentType: 'Lifestyle',
  categories: ['Relationships'],
  hosts: [HOST_MAYA, HOST_CALEB],
  visualStyle:
    'Style: warm, human relationships editorial illustration — connection and conversation motifs, soft natural light, clean modern palette.',
  scriptStructure: [
    'Hook: the relationship situation or goal',
    'What to know first: the underlying dynamic',
    'Step by step: the approach and the conversation',
    'Pitfalls & trade-offs: common mistakes and how to avoid them',
    'Action plan: the first steps to try this week',
  ],
  sceneDirectorNotes:
    'Scene: warm, intimate conversation studio. Tone: warm, empathetic, practical. Pace: relaxed and thoughtful.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_MONEY = makeShow({
  id: 'clearsight-personal-finance',
  name: 'ClearSight Money',
  description:
    'Take charge of your money. Maya Ellis and Caleb Ward make budgeting, saving, investing, and debt payoff approachable — clear steps and the reasoning behind them, for real budgets and real life.',
  focus:
    'Personal finance — budgeting, saving, investing, debt payoff, and retirement planning, explained in plain, actionable terms.',
  introTagline:
    'Welcome to ClearSight Money, where we turn financial goals into steps you can start with what you have.',
  contentType: 'Lifestyle',
  categories: ['Personal Finance'],
  hosts: [HOST_MAYA, HOST_CALEB],
  visualStyle:
    'Style: clean, reassuring personal-finance editorial illustration — everyday money and planning motifs, bright modern palette.',
  scriptStructure: [
    'Hook: the money goal or problem this solves',
    'What to know first: the key principle behind it',
    'Step by step: the concrete plan and options',
    'Pitfalls & trade-offs: common mistakes and how to weigh choices',
    'Action plan: the first steps to take today',
  ],
  sceneDirectorNotes:
    'Scene: clean, modern money-talk studio. Tone: warm, reassuring, practical. Pace: relaxed and clear.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_FAMILY = makeShow({
  id: 'clearsight-family',
  name: 'ClearSight Family',
  description:
    'Parenting, made a little easier. Maya Ellis and Caleb Ward cover newborns through teens, family routines, and work-life balance with practical, judgment-free guidance you can actually use.',
  focus:
    'Parenting and family — newborns, toddlers, teens, family activities, and work-life balance, with practical, judgment-free guidance.',
  introTagline:
    'Welcome to ClearSight Family, where we turn the hard parts of parenting into steps you can take today.',
  contentType: 'Lifestyle',
  categories: ['Parenting & Family'],
  hosts: [HOST_MAYA, HOST_CALEB],
  visualStyle:
    'Style: warm, wholesome family editorial illustration — home and togetherness motifs, soft natural light, clean modern palette.',
  scriptStructure: [
    'Hook: the parenting situation or goal',
    'What to know first: the developmental or practical context',
    'Step by step: the approach to try',
    'Pitfalls & trade-offs: common mistakes and how to avoid them',
    'Action plan: the first steps to start this week',
  ],
  sceneDirectorNotes:
    'Scene: warm, homey family studio. Tone: warm, supportive, practical. Pace: relaxed and reassuring.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_STYLE = makeShow({
  id: 'clearsight-style',
  name: 'ClearSight Style',
  description:
    'Look and feel your best. Maya Ellis and Caleb Ward decode trends, wardrobe basics, and grooming into a personal style that fits your life and budget — what to keep, what to skip, and why.',
  focus:
    'Style and fashion — trends, wardrobe basics, sustainable fashion, grooming, and accessories, with practical, budget-aware guidance.',
  introTagline:
    'Welcome to ClearSight Style, where we turn fashion into a wardrobe that actually works for you.',
  contentType: 'Lifestyle',
  categories: ['Style & Fashion'],
  hosts: [HOST_MAYA, HOST_CALEB],
  visualStyle:
    'Style: chic, polished fashion editorial illustration — wardrobe and style motifs, clean lines, bright modern palette.',
  scriptStructure: [
    'Hook: the style goal or question',
    'What to know first: the principle or context behind it',
    'Step by step: how to build or choose it',
    'Pitfalls & trade-offs: common mistakes and how to weigh choices',
    'Action plan: the first steps to refresh your look',
  ],
  sceneDirectorNotes:
    'Scene: bright, stylish wardrobe studio. Tone: warm, confident, practical. Pace: relaxed and upbeat.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_WELLNESS = makeShow({
  id: 'clearsight-wellness',
  name: 'ClearSight Wellness',
  description:
    'Calmer days, clearer mind. Maya Ellis and Caleb Ward explore meditation, sleep, stress relief, and self-care with grounded, evidence-aware practices you can fit into a busy life.',
  focus:
    'Mindfulness and wellness — meditation, sleep, stress relief, journaling, and self-care, grounded in practical, evidence-aware habits.',
  introTagline:
    'Welcome to ClearSight Wellness, where we turn calm into small habits you can actually keep.',
  contentType: 'Lifestyle',
  categories: ['Mindfulness & Wellness'],
  hosts: [HOST_MAYA, HOST_CALEB],
  visualStyle:
    'Style: serene, calming wellness editorial illustration — mindfulness and rest motifs, soft natural light, soothing palette.',
  scriptStructure: [
    'Hook: the wellbeing goal and why it matters',
    'What to know first: the principle or evidence behind it',
    'Step by step: the practice to try',
    'Pitfalls & trade-offs: common mistakes and how to stay consistent',
    'Action plan: the simple first steps to start today',
  ],
  sceneDirectorNotes:
    'Scene: calm, softly lit wellness studio. Tone: warm, soothing, practical. Pace: unhurried and gentle.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_PETS = makeShow({
  id: 'clearsight-pets',
  name: 'ClearSight Pets',
  description:
    'Happier, healthier pets. Maya Ellis and Caleb Ward cover dogs, cats, pet health, and training with practical, vet-aware advice — what to do, what to watch for, and how to start.',
  focus:
    'Pets — dogs, cats, pet health, training, and adoption, with practical, vet-aware guidance for everyday pet owners.',
  introTagline:
    'Welcome to ClearSight Pets, where we turn pet care into simple steps for a happier companion.',
  contentType: 'Lifestyle',
  categories: ['Pets'],
  hosts: [HOST_MAYA, HOST_CALEB],
  visualStyle:
    'Style: warm, friendly pets editorial illustration — companion-animal motifs, soft natural light, clean modern palette.',
  scriptStructure: [
    'Hook: the pet goal or problem this solves',
    'What to know first: the behavior or health context',
    'Step by step: the approach to follow',
    'Pitfalls & trade-offs: common mistakes and when to see a vet',
    'Action plan: the first steps to take this week',
  ],
  sceneDirectorNotes:
    'Scene: warm, friendly pet-care studio. Tone: warm, caring, practical. Pace: relaxed and upbeat.',
  studioImage: PLACEHOLDER_STUDIO,
})

// ---------------------------------------------------------------------------
// Per-category Education channels (reuse ClearSight Academy's house cast). Each
// owns a single category so on-demand episodes are tagged with that category.
// ---------------------------------------------------------------------------
export const SHOW_MATH = makeShow({
  id: 'clearsight-math',
  name: 'ClearSight Pattern Matrix',
  description:
    'The hidden blueprint of our universe, decoded on demand. Amara Vance and Malik Al-Jamil treat mathematics as a global storytelling framework — from code-breaking cryptography to chaotic structural systems — in multi-episode series built for screen-off, visual-first learning.',
  focus:
    'Mathematics as visual architecture — series-driven education from foundational scaffolding through advanced spatial dimensions; cryptography, fractals, topology, and applied systems thinking.',
  introTagline:
    'Welcome to ClearSight Pattern Matrix — where the hidden blueprint of our universe unfolds one pattern at a time.',
  contentType: 'Education',
  categories: ['Mathematics'],
  hosts: [HOST_AMARA, HOST_MALIK],
  generationProfile: 'sceneFlowLite',
  visualStyle:
    'Motifs: high-contrast photorealistic stills optimized for Ken Burns motion — diagrammatic precision, deep blues and slate greys with luminous accent geometry, macro photography of fractals, blueprints, and spatial topology.',
  scriptStructure: [
    'Practical applications: open by naming real-world uses — where this math shows up in engineering, nature, finance, cryptography, or daily life',
    'Accessible explanation: Amara and Malik build intuition with vivid analogies, history, and step-by-step scaffolding for non-experts',
    'Mathematical principles: Malik develops the formal logic, definitions, and reasoning; signal the dashboard math panel via math_foundation_node when a proof belongs on screen',
    'Summary: recap the core pattern, key formula or insight, and what to remember',
    'CTA Q&A: invite the listener to Ask the Host on this episode page for clarifications, worked examples, or how the math applies to their question',
  ],
  scriptPhilosophy:
    'SHOW PHILOSOPHY — "ClearSight Pattern Matrix" (SceneFlow Lite): Mathematics is the ultimate global storytelling framework. Each episode is one installment in a multi-episode series with explicit series_metadata. Visuals are ALWAYS high-fidelity static illustrations for automated Ken Burns camera scripts — never continuous video.\n' +
    'DEPTH OVER DURATION: There is NO fixed time limit — use as many timeline_frames as needed to explain the topic clearly and completely. Never truncate a proof or skip a foundational step to save time.\n' +
    'HOST INTERACTION: Amara surfaces applications, paradox, and accessible intuition; Malik develops formal principles and spatial logic. Alternate hand-offs — one teachable idea per frame.\n' +
    'AUDIO: Default underscore cue "Mathematical Ambient Pulse" — low metronomic texture ducked for vocal clarity.\n' +
    'MATH FOUNDATION: When Malik presents a formal calculation or proof, put the exact LaTeX in math_foundation_node (not in spoken dialogue).\n' +
    'EPISODE ARC: (1) practical applications → (2) accessible explanation → (3) mathematical principles → (4) summary in body frames → (5) Q&A CTA in episode bookends (not in timeline_frames body).',
  sceneDirectorNotes:
    'Scene: cool-toned geometric motifs in photorealistic stills. Tone: Amara curious and concrete; Malik steady and precise. Pace: unhurried — teach until the listener understands, not until a clock runs out.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_SCIENCE = makeShow({
  id: 'clearsight-science',
  name: 'ClearSight Science',
  description:
    'How the world really works. Dr. Lena Okafor and Diego Santos unpack discoveries and everyday science from first principles — defining the jargon, working through examples, and correcting the myths.',
  focus:
    'Science and discovery — biology, chemistry, physics, and breakthroughs, explained from first principles for the curious non-expert.',
  introTagline:
    'Welcome to ClearSight Science, where we unpack how the world works, one clear idea at a time.',
  contentType: 'Education',
  categories: ['Science & Discovery'],
  hosts: [HOST_LENA, HOST_DIEGO],
  visualStyle:
    'Style: clear, instructional editorial illustration — scientific and experimental motifs, explanatory and vivid.',
  scriptStructure: [
    'Hook: a question or surprising fact that makes the topic matter',
    'Why it matters: stakes and relevance',
    'Core concept: explained from first principles, defining each term',
    'Worked example / analogy: make it concrete and picturable',
    'Common misconception: surface and correct it',
    'Recap: the key takeaways to remember',
  ],
  sceneDirectorNotes:
    'Scene: bright teaching studio. Tone: warm, lucid, Socratic. Pace: unhurried and clear.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_COSMOS = makeShow({
  id: 'clearsight-cosmos',
  name: 'ClearSight Cosmos',
  description:
    'A guided tour of the universe. Dr. Lena Okafor and Diego Santos explore space, astronomy, and cosmology from first principles — making the vast and abstract concrete and picturable.',
  focus:
    'Space and astronomy — planets, stars, cosmology, and space exploration, explained from first principles with vivid analogies.',
  introTagline:
    'Welcome to ClearSight Cosmos, where we make the universe feel a little closer and a lot clearer.',
  contentType: 'Education',
  categories: ['Space & Astronomy'],
  hosts: [HOST_LENA, HOST_DIEGO],
  visualStyle:
    'Style: awe-inspiring, instructional editorial illustration — cosmic and celestial motifs, deep space palette, explanatory.',
  scriptStructure: [
    'Hook: a question or surprising fact that makes the topic matter',
    'Why it matters: stakes and relevance',
    'Core concept: explained from first principles, defining each term',
    'Worked example / analogy: make it concrete and picturable',
    'Common misconception: surface and correct it',
    'Recap: the key takeaways to remember',
  ],
  sceneDirectorNotes:
    'Scene: bright teaching studio. Tone: warm, lucid, Socratic. Pace: unhurried and clear.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_HISTORY = makeShow({
  id: 'clearsight-history',
  name: 'ClearSight History',
  description:
    'The past, made vivid and clear. Dr. Lena Okafor and Diego Santos trace events, people, and turning points from first principles — the context, the causes, and the myths worth correcting.',
  focus:
    'History — civilizations, events, figures, and turning points, explained with context, causation, and myth-busting clarity.',
  introTagline:
    'Welcome to ClearSight History, where we turn the past into a story you can actually follow.',
  contentType: 'Education',
  categories: ['History'],
  hosts: [HOST_LENA, HOST_DIEGO],
  visualStyle:
    'Style: rich, instructional editorial illustration — historical and archival motifs, warm palette, explanatory.',
  scriptStructure: [
    'Hook: a question or surprising fact that makes the topic matter',
    'Why it matters: stakes and relevance',
    'Core concept: explained from first principles, defining each term',
    'Worked example / analogy: make it concrete and picturable',
    'Common misconception: surface and correct it',
    'Recap: the key takeaways to remember',
  ],
  sceneDirectorNotes:
    'Scene: bright teaching studio. Tone: warm, lucid, Socratic. Pace: unhurried and clear.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_MEDICINE = makeShow({
  id: 'clearsight-medicine',
  name: 'ClearSight Medicine',
  description:
    'Understand your health. Dr. Lena Okafor and Diego Santos explain medicine and the human body from first principles — defining the terms, working through examples, and correcting the common myths.',
  focus:
    'Medicine and health — the human body, conditions, treatments, and medical science, explained clearly for the curious non-expert.',
  introTagline:
    'Welcome to ClearSight Medicine, where we make how the body and medicine work clear and approachable.',
  contentType: 'Education',
  categories: ['Medicine & Health'],
  hosts: [HOST_LENA, HOST_DIEGO],
  visualStyle:
    'Style: clean, instructional editorial illustration — anatomical and medical motifs, calm palette, explanatory.',
  scriptStructure: [
    'Hook: a question or surprising fact that makes the topic matter',
    'Why it matters: stakes and relevance',
    'Core concept: explained from first principles, defining each term',
    'Worked example / analogy: make it concrete and picturable',
    'Common misconception: surface and correct it',
    'Recap: the key takeaways to remember',
  ],
  sceneDirectorNotes:
    'Scene: bright teaching studio. Tone: warm, lucid, Socratic. Pace: unhurried and clear.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_TECH = makeShow({
  id: 'clearsight-tech-coding',
  name: 'ClearSight Tech',
  description:
    'How technology actually works. Dr. Lena Okafor and Diego Santos explain computing, coding, and the tech shaping our lives from first principles — defining the jargon and making the abstract concrete.',
  focus:
    'Technology and coding — computing, software, the internet, AI, and programming concepts, explained clearly from first principles.',
  introTagline:
    'Welcome to ClearSight Tech, where we make how technology works clear, one concept at a time.',
  contentType: 'Education',
  categories: ['Technology & Coding'],
  hosts: [HOST_LENA, HOST_DIEGO],
  visualStyle:
    'Style: clean, instructional editorial illustration — computing and circuitry motifs, modern palette, explanatory.',
  scriptStructure: [
    'Hook: a question or surprising fact that makes the topic matter',
    'Why it matters: stakes and relevance',
    'Core concept: explained from first principles, defining each term',
    'Worked example / analogy: make it concrete and picturable',
    'Common misconception: surface and correct it',
    'Recap: the key takeaways to remember',
  ],
  sceneDirectorNotes:
    'Scene: bright teaching studio. Tone: warm, lucid, Socratic. Pace: unhurried and clear.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_ECONOMICS = makeShow({
  id: 'clearsight-economics',
  name: 'ClearSight Economics',
  description:
    'Make sense of money and markets. Dr. Lena Okafor and Diego Santos explain economics from first principles — defining the terms, working through examples, and clearing up the common confusions.',
  focus:
    'Money and economics — markets, trade, policy, and economic ideas, explained from first principles for the curious non-expert.',
  introTagline:
    'Welcome to ClearSight Economics, where we turn money and markets into ideas you can actually follow.',
  contentType: 'Education',
  categories: ['Money & Economics'],
  hosts: [HOST_LENA, HOST_DIEGO],
  visualStyle:
    'Style: clean, instructional editorial illustration — economic and market motifs, modern palette, explanatory.',
  scriptStructure: [
    'Hook: a question or surprising fact that makes the topic matter',
    'Why it matters: stakes and relevance',
    'Core concept: explained from first principles, defining each term',
    'Worked example / analogy: make it concrete and picturable',
    'Common misconception: surface and correct it',
    'Recap: the key takeaways to remember',
  ],
  sceneDirectorNotes:
    'Scene: bright teaching studio. Tone: warm, lucid, Socratic. Pace: unhurried and clear.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_ARTS = makeShow({
  id: 'clearsight-arts',
  name: 'ClearSight Arts',
  description:
    'The story behind the art. Dr. Lena Okafor and Diego Santos explore art, literature, music, and culture from first principles — the context, the craft, and the ideas that make it matter.',
  focus:
    'Arts and culture — visual art, literature, music, film, and cultural movements, explained with context and accessible insight.',
  introTagline:
    'Welcome to ClearSight Arts, where we open up the ideas and craft behind the art we love.',
  contentType: 'Education',
  categories: ['Arts & Culture'],
  hosts: [HOST_LENA, HOST_DIEGO],
  visualStyle:
    'Style: rich, instructional editorial illustration — artistic and cultural motifs, expressive palette, explanatory.',
  scriptStructure: [
    'Hook: a question or surprising fact that makes the topic matter',
    'Why it matters: stakes and relevance',
    'Core concept: explained from first principles, defining each term',
    'Worked example / analogy: make it concrete and picturable',
    'Common misconception: surface and correct it',
    'Recap: the key takeaways to remember',
  ],
  sceneDirectorNotes:
    'Scene: bright teaching studio. Tone: warm, lucid, Socratic. Pace: unhurried and clear.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOW_NATURE = makeShow({
  id: 'clearsight-nature',
  name: 'ClearSight Nature',
  description:
    'The natural world, up close. Dr. Lena Okafor and Diego Santos explore ecosystems, wildlife, and the environment from first principles — how it works, why it matters, and the myths worth correcting.',
  focus:
    'Nature and environment — ecosystems, wildlife, climate, and conservation, explained from first principles for the curious non-expert.',
  introTagline:
    'Welcome to ClearSight Nature, where we make the natural world clearer and closer.',
  contentType: 'Education',
  categories: ['Nature & Environment'],
  hosts: [HOST_LENA, HOST_DIEGO],
  visualStyle:
    'Style: lush, instructional editorial illustration — natural-world and ecosystem motifs, organic palette, explanatory.',
  scriptStructure: [
    'Hook: a question or surprising fact that makes the topic matter',
    'Why it matters: stakes and relevance',
    'Core concept: explained from first principles, defining each term',
    'Worked example / analogy: make it concrete and picturable',
    'Common misconception: surface and correct it',
    'Recap: the key takeaways to remember',
  ],
  sceneDirectorNotes:
    'Scene: bright teaching studio. Tone: warm, lucid, Socratic. Pace: unhurried and clear.',
  studioImage: PLACEHOLDER_STUDIO,
})

export const SHOWS: Show[] = [
  SHOW_NEWS,
  SHOW_ACADEMY,
  SHOW_PIVOT,
  SHOW_CASEFILE,
  SHOW_UNEXPLAINED,
  SHOW_GREENROOM,
  SHOW_FRAMEBYFRAME,
  SHOW_LINERNOTES,
  SHOW_PLAYERTWO,
  SHOW_HIPHOP,
  SHOW_ELECTRONIC,
  SHOW_JAZZ,
  SHOW_ROCK,
  SHOW_CLASSICAL,
  SHOW_AMBIENT,
  SHOW_RNB,
  SHOW_LATIN,
  SHOW_GOODLIFE,
  SHOW_KITCHEN,
  SHOW_TRAVEL,
  SHOW_HOMEGARDEN,
  SHOW_FITNESS,
  SHOW_RELATIONSHIPS,
  SHOW_MONEY,
  SHOW_FAMILY,
  SHOW_STYLE,
  SHOW_WELLNESS,
  SHOW_PETS,
  SHOW_MATH,
  SHOW_SCIENCE,
  SHOW_COSMOS,
  SHOW_HISTORY,
  SHOW_MEDICINE,
  SHOW_TECH,
  SHOW_ECONOMICS,
  SHOW_ARTS,
  SHOW_NATURE,
]

/** Look up a show by its stable id. */
export function getShowById(id: string): Show | undefined {
  return SHOWS.find((show) => show.id === id)
}

/**
 * Curated "top" channels featured on the home page (one representative per lane
 * plus the most popular Entertainment shows). No popularity metric exists yet,
 * so this is an editorial list.
 */
export const FEATURED_SHOW_IDS = [
  'clearsight-brief',
  'clearsight-academy',
  'the-casefile',
  'the-unexplained',
  'the-green-room',
] as const

/** The featured (top) channels for the home page, in curated order. */
export function featuredShows(): Show[] {
  return FEATURED_SHOW_IDS.map((id) => getShowById(id)).filter((s): s is Show => Boolean(s))
}

/** Popular channels for the home Featured row (cross-type editorial picks). */
export function popularShows(): Show[] {
  return featuredShows()
}

/** Top three channel picks per content type for home section thumbnails. */
export const TOP_SHOW_IDS_BY_TYPE = {
  Education: ['clearsight-academy', 'clearsight-science', 'clearsight-history'],
  Entertainment: ['the-casefile', 'the-unexplained', 'the-green-room'],
  Lifestyle: ['the-good-life', 'clearsight-kitchen', 'clearsight-travel'],
  Music: ['clearsight-hip-hop', 'clearsight-electronic', 'clearsight-jazz'],
} as const satisfies Record<'Education' | 'Entertainment' | 'Lifestyle' | 'Music', readonly string[]>

export function topShowsForType(
  contentType: 'Education' | 'Entertainment' | 'Lifestyle' | 'Music'
): Show[] {
  return TOP_SHOW_IDS_BY_TYPE[contentType]
    .map((id) => getShowById(id))
    .filter((s): s is Show => Boolean(s))
}

export const NEWS_SHOW_ID = 'clearsight-brief' as const

export function newsShow(): Show {
  return getShowById(NEWS_SHOW_ID) ?? SHOW_NEWS
}

/**
 * The categories a channel covers. A show with explicit `categories` owns just
 * those; a show with an empty list (e.g. The ClearSight Brief, ClearSight
 * Academy) is the default for its content type and covers all of that type's
 * browsable categories.
 */
export function categoriesForShow(show: Show): Category[] {
  if (show.categories.length > 0) return show.categories as Category[]
  return categoriesForType(show.contentType).filter((c) => c !== 'Top')
}

/**
 * The channels surfaced for a topic browse. With no concrete category (Top or
 * absent) we list every channel of that type; with a specific category we
 * resolve the single owning channel (deduped).
 */
export function channelsForFilter(contentType: ContentType, category?: string): Show[] {
  const concrete = category && category !== 'Top' ? category : undefined
  if (!concrete) {
    return SHOWS.filter((show) => show.contentType === contentType)
  }
  const owner = resolveShow({ contentType, category: concrete })
  return [owner]
}

/** All hosts across every show, de-duplicated by name. */
export const ALL_HOSTS: HostProfile[] = (() => {
  const seen = new Set<string>()
  const list: HostProfile[] = []
  for (const show of SHOWS) {
    for (const h of show.hosts) {
      if (seen.has(h.name)) continue
      seen.add(h.name)
      list.push(h)
    }
  }
  return list
})()

/** Map a category/topic to its show; falls back to the type default, then News. */
const SHOW_BY_CATEGORY: Record<string, Show> = (() => {
  const map: Record<string, Show> = {}
  for (const show of SHOWS) {
    for (const category of show.categories) {
      map[category.toLowerCase()] = show
    }
  }
  return map
})()

const DEFAULT_SHOW_BY_TYPE: Record<ContentType, Show> = {
  News: SHOW_NEWS,
  Education: SHOW_ACADEMY,
  Entertainment: SHOW_CASEFILE,
  Lifestyle: SHOW_GOODLIFE,
  Music: SHOW_HIPHOP,
}

export interface ResolveShowInput {
  contentType?: ContentType
  category?: string
}

/**
 * Resolves the show for a generation. News always uses the single news desk
 * channel; category is for discovery only. Other types map category → dedicated
 * show when the category belongs to the same content type.
 */
export function resolveShow(input: ResolveShowInput): Show {
  const type = input.contentType ?? (input.category ? typeForCategory(input.category) : 'News')

  if (type === 'News') return SHOW_NEWS

  const byCategory = input.category ? SHOW_BY_CATEGORY[input.category.toLowerCase()] : undefined
  if (byCategory && byCategory.contentType === type) return byCategory

  return DEFAULT_SHOW_BY_TYPE[type] ?? SHOW_NEWS
}

/** Look up a show by its stored id (e.g. from `sourcesVerified.showId`). */
export function showById(id?: string | null): Show | undefined {
  if (!id) return undefined
  return SHOWS.find((show) => show.id === id)
}

/** Find the host whose name/alias matches a script speaker label. */
export function hostBySpeaker(speaker?: string | null): HostProfile | undefined {
  if (!speaker) return undefined
  const lower = speaker.toLowerCase()
  return (
    ALL_HOSTS.find((h) => lower === h.name.toLowerCase()) ??
    ALL_HOSTS.find((h) => h.aliases.some((alias) => lower.includes(alias)))
  )
}

/**
 * The show a given host belongs to. When `showId` is provided it wins — shared
 * casts (e.g. Lena + Diego span 11 shows) otherwise resolve to the first
 * registered show, which is rarely the episode's actual channel.
 */
export function showForSpeaker(speaker?: string | null, showId?: string | null): Show | undefined {
  const byId = showById(showId)
  if (byId) return byId
  const profile = hostBySpeaker(speaker)
  if (!profile) return undefined
  return SHOWS.find((show) => show.hosts.some((h) => h.name === profile.name))
}

/**
 * Resolves the default "speaking" portraits for a script speaker label, matched
 * across all shows. Returns an empty array when the speaker is unknown.
 */
export function speakingImagesForSpeaker(speaker?: string | null): string[] {
  return hostBySpeaker(speaker)?.speakingImages ?? []
}

/** Studio fallback image for a speaker's show (used when no portrait exists). */
export function studioImageForSpeaker(speaker?: string | null, showId?: string | null): string {
  return showForSpeaker(speaker, showId)?.studioImage ?? HOSTS_IMAGE
}

// Per-Education-topic visual overlays, layered on top of a show's base
// visualStyle so illustrations match the subject (the Academy show covers many
// topics, each with its own look).
const EDUCATION_TOPIC_VISUAL_STYLES: Record<string, string> = {
  Mathematics:
    'Pattern Matrix motifs: cryptography grids, fractal coastlines, Koch snowflakes, magnifying-scale loops, glowing blueprint diagrams, spatial topology folds.',
  'Science & Discovery': 'Lean toward lab apparatus and labeled diagrams.',
  'Space & Astronomy': 'Lean toward photoreal cosmic imagery — planets, telescopes, deep space.',
  History: 'Period- and place-accurate imagery, localized to the setting.',
  'Medicine & Health': 'Clinical clarity — anatomy and clinical settings, careful and non-graphic.',
  'Technology & Coding': 'Modern and schematic — interfaces, circuits, and code motifs.',
  'Money & Economics': 'Data/infographic feel — charts, currency, and market motifs.',
  'Career & Job Market': 'Practical workplace imagery — offices, tools of the trade, career paths.',
  'Arts & Culture': 'Expressive imagery true to the culture depicted.',
  'Nature & Environment': 'Natural-world imagery — ecosystems, landscapes, and wildlife.',
}

/** Optional topic-specific visual overlay appended to a show's base style. */
export function categoryVisualStyle(category?: string): string {
  if (!category) return ''
  return EDUCATION_TOPIC_VISUAL_STYLES[canonicalizeCategory(category)] ?? ''
}
