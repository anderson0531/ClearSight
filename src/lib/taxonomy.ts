import { getLanguageEnglishNames, LOCALE_BY_ENGLISH_NAME } from '@/i18n/locales'

export const LANGUAGES = getLanguageEnglishNames() as readonly string[]
export const GEO_SCOPES = ['Worldwide', 'Region', 'Country', 'State/Province', 'Local'] as const

// All vocal languages Lyria 3 Pro officially supports (per Google Cloud docs).
export const LYRIA_VOCAL_LANGUAGES = [
  'English',
  'German',
  'Spanish',
  'French',
  'Hindi',
  'Japanese',
  'Korean',
  'Portuguese',
] as const
export type LyriaVocalLanguage = (typeof LYRIA_VOCAL_LANGUAGES)[number]

export interface MusicVocalLanguageOption {
  englishName: string
  nativeName: string
}

/**
 * All app locales as vocal-language options, split into Lyria's officially
 * supported set and an experimental tier (the rest). Experimental languages
 * rely on pre-written lyrics being passed to Lyria verbatim.
 */
export function getMusicVocalLanguageGroups(): {
  supported: MusicVocalLanguageOption[]
  experimental: MusicVocalLanguageOption[]
} {
  const official = new Set<string>(LYRIA_VOCAL_LANGUAGES)
  const toOpt = (englishName: string): MusicVocalLanguageOption => ({
    englishName,
    nativeName: LOCALE_BY_ENGLISH_NAME[englishName]?.nativeName ?? englishName,
  })
  return {
    supported: LYRIA_VOCAL_LANGUAGES.map(toOpt),
    experimental: LANGUAGES.filter((l) => !official.has(l)).map(toOpt),
  }
}

/** True when the given English language name is a selectable vocal language. */
export function isMusicVocalLanguage(englishName: string): boolean {
  return (LANGUAGES as readonly string[]).includes(englishName)
}

// Optional vocal voice type for on-demand full (vocal) music tracks. Lyria has
// no voice IDs, so this maps to a sung-vocal description injected into the prompt.
export const MUSIC_VOICE_TYPES = ['auto', 'female', 'male', 'duet', 'group'] as const
export type MusicVoiceType = (typeof MUSIC_VOICE_TYPES)[number]

// Vocal timbre / range profiles from the Lyria 3 prompting guide. Separate from
// voice type (gender/ensemble) — describes how the singer sounds.
export const MUSIC_VOICE_TONES = [
  'auto',
  'female_soprano',
  'female_alto',
  'male_tenor',
  'male_baritone',
  'raspy_rock',
  'breathy_soulful',
  'smooth_croon',
] as const
export type MusicVoiceTone = (typeof MUSIC_VOICE_TONES)[number]

// Top-level content Type. ClearSight is principally a News/Discussion network
// (like Spotify is music), with Education and Entertainment as sibling modes.
// The Type drives discovery filtering AND the generation pipeline (script
// framework + illustration style + default conversational format).
export const CONTENT_TYPES = ['News', 'Education', 'Entertainment', 'Books', 'Lifestyle', 'Music'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]
export const DEFAULT_CONTENT_TYPE: ContentType = 'News'

// News domains (the original ClearSight categories).
export const NEWS_CATEGORIES = [
  'Politics',
  'Business',
  'Finance & Macroeconomics',
  'Technology',
  'Science',
  'Health & Medicine',
  'Sports',
  'Crime',
] as const

// Knowledge & Career topics. Each topic carries its own analytical framework and
// illustration style. "Careers & Work" routes to the dedicated solo show
// ("The Pivot") rather than the Academy pair.
export const EDUCATION_CATEGORIES = [
  'Math & Patterns',
  'Science & Evidence',
  'Space & Cosmos',
  'History & Context',
  'Health & the Body',
  'Technology & Systems',
  'Markets & Money',
  'Careers & Work',
  'Arts & Culture',
  'Earth & Environment',
] as const

// Legacy Knowledge & Career sub-categories → current topics, so stories generated
// before taxonomy changes still resolve to a type, framework, and show.
export const LEGACY_EDUCATION_CATEGORY_MAP: Record<string, string> = {
  Mathematics: 'Math & Patterns',
  'Science & Discovery': 'Science & Evidence',
  'Space & Astronomy': 'Space & Cosmos',
  History: 'History & Context',
  'Medicine & Health': 'Health & the Body',
  'Technology & Coding': 'Technology & Systems',
  'Money & Economics': 'Markets & Money',
  'Career & Job Market': 'Careers & Work',
  'Nature & Environment': 'Earth & Environment',
  'Science & Nature': 'Science & Evidence',
  'Health & Wellbeing': 'Health & the Body',
}

// Entertainment formats (creator-style channels: True Crime, the "Why Files?"
// unexplained/mystery lane, etc.).
export const ENTERTAINMENT_CATEGORIES = [
  'True Crime',
  'Unexplained & Mystery',
  'Pop Culture',
  'Film & TV',
  'Music',
  'Gaming',
] as const

// Book clubs and literary discussion lanes — fiction, nonfiction, and genre deep dives.
export const BOOKS_CATEGORIES = [
  'Fiction & Literature',
  'Mystery & Thriller',
  'Sci-Fi & Fantasy',
  'Nonfiction',
  'Biography & Memoir',
  'History & Society',
  'Self-Help & Growth',
  'Business & Leadership',
] as const

// Music genres — each maps to a dedicated Lyria-powered genre channel.
export const MUSIC_CATEGORIES = [
  'Hip-Hop',
  'Electronic',
  'Jazz',
  'Rock',
  'Classical',
  'Ambient',
  'R&B',
  'Latin',
] as const

// Home & Lifestyle topics: practical, evergreen, service-journalism subjects.
export const LIFESTYLE_CATEGORIES = [
  'Food & Cooking',
  'Travel',
  'Home & Garden',
  'Health & Fitness',
  'Relationships',
  'Personal Finance',
  'Parenting & Family',
  'Style & Fashion',
  'Mindfulness & Wellness',
  'Pets',
] as const

export const CONTENT_CATEGORIES = [
  ...NEWS_CATEGORIES,
  ...EDUCATION_CATEGORIES,
  ...ENTERTAINMENT_CATEGORIES,
  ...BOOKS_CATEGORIES,
  ...LIFESTYLE_CATEGORIES,
  ...MUSIC_CATEGORIES,
] as const

export const CATEGORIES = ['Top', ...CONTENT_CATEGORIES] as const

export type Language = (typeof LANGUAGES)[number]
export type GeoScope = (typeof GEO_SCOPES)[number]
export type ContentCategory = (typeof CONTENT_CATEGORIES)[number]
export type Category = (typeof CATEGORIES)[number]

const CATEGORIES_BY_TYPE: Record<ContentType, readonly string[]> = {
  News: NEWS_CATEGORIES,
  Education: EDUCATION_CATEGORIES,
  Entertainment: ENTERTAINMENT_CATEGORIES,
  Books: BOOKS_CATEGORIES,
  Lifestyle: LIFESTYLE_CATEGORIES,
  Music: MUSIC_CATEGORIES,
}

/** Categories available for a given Type, with 'Top' first as the "all" option. */
export function categoriesForType(type: ContentType): Category[] {
  return ['Top', ...CATEGORIES_BY_TYPE[type]] as Category[]
}

/** Normalize a (possibly legacy) category string to its current canonical name. */
export function canonicalizeCategory(category: string): string {
  return LEGACY_EDUCATION_CATEGORY_MAP[category] ?? category
}

/** Reverse lookup: which Type owns a category. Defaults to News. */
export function typeForCategory(category: string): ContentType {
  const canonical = canonicalizeCategory(category)
  if ((EDUCATION_CATEGORIES as readonly string[]).includes(canonical)) return 'Education'
  if ((ENTERTAINMENT_CATEGORIES as readonly string[]).includes(canonical)) return 'Entertainment'
  if ((BOOKS_CATEGORIES as readonly string[]).includes(canonical)) return 'Books'
  if ((LIFESTYLE_CATEGORIES as readonly string[]).includes(canonical)) return 'Lifestyle'
  if ((MUSIC_CATEGORIES as readonly string[]).includes(canonical)) return 'Music'
  return 'News'
}

export function isContentType(value: unknown): value is ContentType {
  return typeof value === 'string' && (CONTENT_TYPES as readonly string[]).includes(value)
}

// Curated sub-topics per category. Selecting a chip narrows browse/search to
// that angle and pre-seeds on-demand generation; it is plain text, so it needs
// no schema or model changes. Brand/topic names stay untranslated.
export const CATEGORY_SUBTOPICS: Record<string, string[]> = {
  // News
  Politics: ['Elections', 'Congress', 'Foreign Policy', 'Supreme Court', 'Campaigns'],
  Business: ['Earnings', 'Startups', 'Markets', 'Mergers & Acquisitions', 'Big Tech'],
  'Finance & Macroeconomics': ['Inflation', 'Interest Rates', 'Jobs Report', 'Crypto', 'Housing'],
  Technology: ['AI', 'Cybersecurity', 'Gadgets', 'Space', 'Social Media'],
  Science: ['Climate', 'Physics', 'Biology', 'Research', 'Environment'],
  'Health & Medicine': ['Public Health', 'Mental Health', 'Nutrition', 'Drug Approvals', 'Pandemics'],
  Sports: ['Football', 'Basketball', 'Soccer', 'Transfers', 'Playoffs'],
  Crime: ['Investigations', 'Courts', 'Cybercrime', 'Policy', 'Cold Cases'],
  // Knowledge & Career
  'Math & Patterns': ['Algebra', 'Geometry', 'Calculus', 'Statistics', 'Number Theory'],
  'Science & Evidence': ['Physics', 'Chemistry', 'Biology', 'Earth Science', 'Genetics'],
  'Space & Cosmos': ['Black Holes', 'Exoplanets', 'The Solar System', 'Cosmology', 'Space Missions'],
  'History & Context': ['Ancient World', 'Medieval', 'Modern Era', 'World Wars', 'Revolutions'],
  'Health & the Body': ['Anatomy', 'Immunology', 'Nutrition', 'Mental Health', 'Genetics'],
  'Technology & Systems': ['Programming', 'AI & ML', 'Web Development', 'Databases', 'Cybersecurity'],
  'Markets & Money': ['Investing', 'Microeconomics', 'Macroeconomics', 'Personal Finance', 'Markets'],
  'Careers & Work': ['Resume & Interview', 'Remote Work', 'Salary Negotiation', 'Reskilling', 'Job Search'],
  'Arts & Culture': ['Painting', 'Literature', 'Architecture', 'Photography', 'Design'],
  'Earth & Environment': ['Ecosystems', 'Wildlife', 'Conservation', 'Oceans', 'Climate'],
  // Entertainment
  'True Crime': ['Cold Cases', 'Serial Cases', 'Heists', 'Forensics', 'Wrongful Convictions'],
  'Unexplained & Mystery': ['UFOs', 'Cryptids', 'Hauntings', 'Ancient Mysteries', 'Conspiracies'],
  'Pop Culture': ['Celebrity', 'Music Scene', 'TV Buzz', 'Internet Trends', 'Awards'],
  'Film & TV': ['New Releases', 'Classics', 'Streaming', 'Directors', 'Genre Deep Dives'],
  Music: ['New Albums', 'Artist Profiles', 'Genres', 'Production', 'Music History'],
  Gaming: ['New Releases', 'Indie Games', 'Esports', 'Game Design', 'Retro'],
  // Books
  'Fiction & Literature': ['Literary Fiction', 'Contemporary', 'Classics', 'Book Club Picks', 'Debut Novels'],
  'Mystery & Thriller': ['Detective', 'Suspense', 'Cozy Mystery', 'Psychological Thriller', 'True-Crime Adjacent'],
  'Sci-Fi & Fantasy': ['Space Opera', 'Hard Sci-Fi', 'Epic Fantasy', 'Urban Fantasy', 'Worldbuilding'],
  Nonfiction: ['Essays', 'Investigative', 'Science Writing', 'Current Affairs', 'Memoir-Adjacent'],
  'Biography & Memoir': ['Political Figures', 'Artists', 'Athletes', 'Founders', 'Ordinary Lives'],
  'History & Society': ['Ancient World', 'Wars & Revolutions', 'Social Movements', 'Biographies of Eras', 'Political History'],
  'Self-Help & Growth': ['Habits', 'Mindset', 'Productivity', 'Relationships', 'Spirituality'],
  'Business & Leadership': ['Startups', 'Management', 'Investing', 'Strategy', 'Work Culture'],
  // Home & Lifestyle
  'Food & Cooking': ['Recipes', 'Baking', 'Meal Prep', 'World Cuisine', 'Kitchen Tips'],
  Travel: ['Destinations', 'Budget Travel', 'Road Trips', 'Travel Tips', 'Adventure'],
  'Home & Garden': ['Interior Design', 'DIY Projects', 'Gardening', 'Organization', 'Decor'],
  'Health & Fitness': ['Workouts', 'Nutrition', 'Running', 'Strength Training', 'Yoga'],
  Relationships: ['Dating', 'Marriage', 'Friendship', 'Communication', 'Family Ties'],
  'Personal Finance': ['Budgeting', 'Saving', 'Investing', 'Debt Payoff', 'Retirement'],
  'Parenting & Family': ['Newborns', 'Toddlers', 'Teens', 'Family Activities', 'Work-Life Balance'],
  'Style & Fashion': ['Trends', 'Wardrobe Basics', 'Sustainable Fashion', 'Grooming', 'Accessories'],
  'Mindfulness & Wellness': ['Meditation', 'Sleep', 'Stress Relief', 'Journaling', 'Self-Care'],
  Pets: ['Dogs', 'Cats', 'Pet Health', 'Training', 'Adoption'],
  // Music genres
  'Hip-Hop': ['Beats', 'Boom Bap', 'Trap', 'Lo-Fi Hip-Hop', 'West Coast'],
  Electronic: ['House', 'Techno', 'Synthwave', 'Ambient Electronic', 'Drum & Bass'],
  Jazz: ['Smooth Jazz', 'Bebop', 'Fusion', 'Cool Jazz', 'Swing'],
  Rock: ['Classic Rock', 'Indie Rock', 'Alternative', 'Hard Rock', 'Post-Rock'],
  Classical: ['Orchestral', 'Piano', 'Chamber', 'Opera', 'Minimalist'],
  Ambient: ['Soundscape', 'Meditation', 'Drone', 'Cinematic', 'Nature'],
  'R&B': ['Neo-Soul', 'Contemporary R&B', 'Funk', 'Slow Jam', 'Gospel'],
  Latin: ['Reggaeton', 'Salsa', 'Bossa Nova', 'Cumbia', 'Latin Pop'],
}

/** Curated sub-topic chips for a category (empty when none are defined). */
export function subtopicsForCategory(category?: string): string[] {
  if (!category) return []
  return CATEGORY_SUBTOPICS[canonicalizeCategory(category)] ?? []
}

export interface TaxonomyFilter {
  contentType: ContentType
  languages: Language[]
  geoScope: GeoScope
  geoRegion?: string
  geoCountry?: string
  geoState?: string
  geoLocal?: string
  categories: Category[]
  query?: string
}

export interface GeoContext {
  country?: string
  city?: string
  region?: string
}

export function isTopCategory(category: Category): boolean {
  return category === 'Top'
}

/** Content categories valid for a given type (excludes Top). */
export function categoriesForContentType(type: ContentType): readonly string[] {
  return CATEGORIES_BY_TYPE[type]
}

export interface GeoTags {
  geoScope: GeoScope
  geoRegion?: string
  geoCountry?: string
  geoState?: string
  geoLocal?: string
}

/** Trim geo fields and enforce scope hierarchy consistency. */
export function normalizeGeoTags(tags: GeoTags): GeoTags {
  const trim = (value?: string) => value?.trim() || undefined
  let geoScope = tags.geoScope
  const geoLocal = trim(tags.geoLocal)
  const geoState = trim(tags.geoState)
  const geoCountry = trim(tags.geoCountry)
  const geoRegion = trim(tags.geoRegion)

  if (!GEO_SCOPES.includes(geoScope)) geoScope = 'Worldwide'

  if (geoLocal) geoScope = 'Local'
  else if (geoState && geoScope !== 'Local') geoScope = 'State/Province'
  else if (geoCountry && geoScope !== 'Local' && geoScope !== 'State/Province') geoScope = 'Country'
  else if (geoRegion && geoScope === 'Worldwide') geoScope = 'Region'

  return { geoScope, geoRegion, geoCountry, geoState, geoLocal }
}

export function buildTaxonomyKey(filter: Pick<TaxonomyFilter, 'languages' | 'categories' | 'geoScope'> & {
  geoRegion?: string
  geoCountry?: string
  geoState?: string
  geoLocal?: string
  language: string
  category: string
}): string {
  return [
    filter.language,
    filter.category,
    filter.geoScope,
    filter.geoRegion ?? '',
    filter.geoCountry ?? '',
    filter.geoState ?? '',
    filter.geoLocal ?? '',
  ].join('|')
}

export const DEFAULT_TAXONOMY: TaxonomyFilter = {
  contentType: 'News',
  languages: ['English'],
  geoScope: 'Worldwide',
  categories: ['Top'],
}

/** Geo fields extracted from a taxonomy filter. */
export type TaxonomyGeoFields = Pick<
  TaxonomyFilter,
  'geoScope' | 'geoRegion' | 'geoCountry' | 'geoState' | 'geoLocal'
>

export function pickGeoFields(filter: TaxonomyGeoFields): TaxonomyGeoFields {
  return {
    geoScope: filter.geoScope,
    geoRegion: filter.geoRegion,
    geoCountry: filter.geoCountry,
    geoState: filter.geoState,
    geoLocal: filter.geoLocal,
  }
}

/** Strip geo criteria — used for non-News discovery lanes (language-only). */
export function withoutGeoFilter<T extends TaxonomyFilter>(filter: T): T {
  return {
    ...filter,
    geoScope: 'Worldwide',
    geoRegion: undefined,
    geoCountry: undefined,
    geoState: undefined,
    geoLocal: undefined,
  }
}

/** News uses language + geo; other types use language only. */
export function effectiveDiscoveryFilter(filter: TaxonomyFilter): TaxonomyFilter {
  return filter.contentType === 'News' ? filter : withoutGeoFilter(filter)
}
