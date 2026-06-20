import { getLanguageEnglishNames } from '@/i18n/locales'

export const LANGUAGES = getLanguageEnglishNames() as readonly string[]
export const GEO_SCOPES = ['Worldwide', 'Region', 'Country', 'State/Province', 'Local'] as const

// Languages Lyria 3 Pro reliably sings vocals in. Used to scope the on-demand
// music language selector so full (vocal) tracks stay intelligible.
export const LYRIA_VOCAL_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Hindi',
  'Japanese',
  'Korean',
] as const
export type LyriaVocalLanguage = (typeof LYRIA_VOCAL_LANGUAGES)[number]

// Optional vocal voice type for on-demand full (vocal) music tracks. Lyria has
// no voice IDs, so this maps to a sung-vocal description injected into the prompt.
export const MUSIC_VOICE_TYPES = ['auto', 'female', 'male', 'duet', 'group'] as const
export type MusicVoiceType = (typeof MUSIC_VOICE_TYPES)[number]

// Top-level content Type. ClearSight is principally a News/Discussion network
// (like Spotify is music), with Education and Entertainment as sibling modes.
// The Type drives discovery filtering AND the generation pipeline (script
// framework + illustration style + default conversational format).
export const CONTENT_TYPES = ['News', 'Education', 'Entertainment', 'Lifestyle', 'Music'] as const
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

// Education topics. Each topic carries its own analytical framework and
// illustration style. "Career & Job Market" routes to the dedicated solo show
// ("The Pivot") rather than the Academy pair.
export const EDUCATION_CATEGORIES = [
  'Mathematics',
  'Science & Discovery',
  'Space & Astronomy',
  'History',
  'Medicine & Health',
  'Technology & Coding',
  'Money & Economics',
  'Career & Job Market',
  'Arts & Culture',
  'Nature & Environment',
] as const

// Legacy Education sub-categories → new topics, so stories generated before the
// taxonomy change still resolve to a type, framework, and show.
export const LEGACY_EDUCATION_CATEGORY_MAP: Record<string, string> = {
  'Science & Nature': 'Science & Discovery',
  'Health & Wellbeing': 'Medicine & Health',
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
  // Education
  Mathematics: ['Algebra', 'Geometry', 'Calculus', 'Statistics', 'Number Theory'],
  'Science & Discovery': ['Physics', 'Chemistry', 'Biology', 'Earth Science', 'Genetics'],
  'Space & Astronomy': ['Black Holes', 'Exoplanets', 'The Solar System', 'Cosmology', 'Space Missions'],
  History: ['Ancient World', 'Medieval', 'Modern Era', 'World Wars', 'Revolutions'],
  'Medicine & Health': ['Anatomy', 'Immunology', 'Nutrition', 'Mental Health', 'Genetics'],
  'Technology & Coding': ['Programming', 'AI & ML', 'Web Development', 'Databases', 'Cybersecurity'],
  'Money & Economics': ['Investing', 'Microeconomics', 'Macroeconomics', 'Personal Finance', 'Markets'],
  'Career & Job Market': ['Resume & Interview', 'Remote Work', 'Salary Negotiation', 'Reskilling', 'Job Search'],
  'Arts & Culture': ['Painting', 'Literature', 'Architecture', 'Photography', 'Design'],
  'Nature & Environment': ['Ecosystems', 'Wildlife', 'Conservation', 'Oceans', 'Climate'],
  // Entertainment
  'True Crime': ['Cold Cases', 'Serial Cases', 'Heists', 'Forensics', 'Wrongful Convictions'],
  'Unexplained & Mystery': ['UFOs', 'Cryptids', 'Hauntings', 'Ancient Mysteries', 'Conspiracies'],
  'Pop Culture': ['Celebrity', 'Music Scene', 'TV Buzz', 'Internet Trends', 'Awards'],
  'Film & TV': ['New Releases', 'Classics', 'Streaming', 'Directors', 'Genre Deep Dives'],
  Music: ['New Albums', 'Artist Profiles', 'Genres', 'Production', 'Music History'],
  Gaming: ['New Releases', 'Indie Games', 'Esports', 'Game Design', 'Retro'],
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
