import { CLEARSIGHT_HOSTS_STUDIO_URL } from '@/lib/brand-assets'
import { HOST_ANDERSON, HOST_SARAH, HOSTS_IMAGE, type HostProfile } from '@/lib/hosts'
import { HOST_ART, SHOW_COVER_ART, SHOW_INTRO_ART, SHOW_STUDIO_ART } from '@/lib/host-art'
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

export interface Show {
  /** Stable identifier persisted with each generation. */
  id: string
  /** Display name of the show. */
  name: string
  /** One-paragraph channel description shown on the channel page. */
  description: string
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
  /** Scene + tone guidance passed to TTS director notes. */
  sceneDirectorNotes: string
  /** Shared studio frame shown for intro/outro and as a host fallback. */
  studioImage: string
  /** Host-populated intro image featured on the home-page show card. */
  introImage: string
  /** Fixed cover key-art used as the channel hero and channel cards. */
  coverImage: string
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
// Show registry
// ---------------------------------------------------------------------------

function makeShow(
  show: Omit<Show, 'format' | 'introImage' | 'coverImage'> & { introImage?: string }
): Show {
  const studioImage = SHOW_STUDIO_ART[show.id] ?? show.studioImage
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
    format: show.hosts.length === 1 ? 'solo' : 'dialogue',
  }
}

export const SHOW_NEWS = makeShow({
  id: 'clearsight-brief',
  name: 'The ClearSight Brief',
  description:
    'The flagship ClearSight news desk. Dr. Anderson and Sarah Chen cut through the noise with dense, even-handed analysis of the day’s most consequential stories — steel-manning every side and forecasting what comes next, across politics, business, technology, science, and more.',
  contentType: 'News',
  categories: [],
  hosts: [HOST_SARAH, HOST_ANDERSON],
  visualStyle:
    'Style: clean, symbolic, professional news-magazine editorial illustration. Muted slate and indigo palette.',
  scriptStructure: [
    'Hook: the single most consequential development',
    'Context: how we got here',
    'Key developments: what just changed',
    'Analysis: causal factors and opposing perspectives (steel-man both sides)',
    'Forecast: realistic scenarios and what to watch',
    'Takeaway: the key analytical conclusion',
  ],
  sceneDirectorNotes:
    'Scene: modern intelligence newsroom. Tone: analytical, dense, energetic — no fluff. Pace: natural with thoughtful pauses.',
  studioImage: HOSTS_IMAGE,
  introImage: HOSTS_IMAGE,
})

export const SHOW_ACADEMY = makeShow({
  id: 'clearsight-academy',
  name: 'ClearSight Academy',
  description:
    'Your guided tour through big ideas. Dr. Lena Okafor and Diego Santos build understanding from first principles — defining the jargon, working through vivid examples, and busting the common misconceptions across science, math, history, technology, and beyond.',
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
}

export interface ResolveShowInput {
  contentType?: ContentType
  category?: string
}

/**
 * Resolves the show for a generation. Keys first on the explicit category/topic
 * (e.g. "Career & Job Market" → The Pivot), then on the content type's default
 * show, and finally on News.
 */
export function resolveShow(input: ResolveShowInput): Show {
  const byCategory = input.category ? SHOW_BY_CATEGORY[input.category.toLowerCase()] : undefined
  if (byCategory) return byCategory

  const type = input.contentType ?? (input.category ? typeForCategory(input.category) : 'News')
  return DEFAULT_SHOW_BY_TYPE[type] ?? SHOW_NEWS
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

/** The show a given host belongs to (first match). */
export function showForSpeaker(speaker?: string | null): Show | undefined {
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
export function studioImageForSpeaker(speaker?: string | null): string {
  return showForSpeaker(speaker)?.studioImage ?? HOSTS_IMAGE
}

// Per-Education-topic visual overlays, layered on top of a show's base
// visualStyle so illustrations match the subject (the Academy show covers many
// topics, each with its own look).
const EDUCATION_TOPIC_VISUAL_STYLES: Record<string, string> = {
  Mathematics: 'Lean diagrammatic: geometry, graphs, and equations as clean visual motifs.',
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
