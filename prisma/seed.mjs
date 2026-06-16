import { PrismaClient } from '@prisma/client'
import { resolveAndApplyDatabaseEnv } from '../scripts/database-url.mjs'

const DEMO_USER_ID = 'demo-user'

const TRUTH_LEDGER_TEMPLATE = `## [ SYSTEMIC TOPIC TITLE ]

**The Objective Brief:** Clear, fact-dense narrative overview fully stripped of emotional adjectives and partisan buzzwords.

### THE TRUTH LEDGER

**Sources Verified:**
- Raw tracking manifest or institutional ledger reference
- Legal transcript or physical infrastructure asset record

**Reliability Index:** 8.5

### ANALYTICAL INSIGHT

Highly clinical deductive breakdown mapping long-term **Impact**, logistical **Forecast**, and structural **Systemic Implications** of the story.
`

const SEED_STORIES = [
  {
    id: 'seed-story-1',
    title: 'Global Semiconductor Supply Chain Realignment',
    language: 'English',
    category: 'Technology',
    geoScope: 'Worldwide',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=400&fit=crop',
    durationSeconds: 420,
    reliabilityIndex: 8.7,
    isCached: true,
  },
  {
    id: 'seed-story-2',
    title: 'Central Bank Rate Corridor Analysis Q2',
    language: 'English',
    category: 'Finance & Macroeconomics',
    geoScope: 'Region',
    geoRegion: 'North America',
    thumbnailUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=400&fit=crop',
    durationSeconds: 380,
    reliabilityIndex: 9.1,
    isCached: true,
  },
  {
    id: 'seed-story-3',
    title: 'Clinical Trial Phase III Outcomes Registry',
    language: 'English',
    category: 'Health & Medicine',
    geoScope: 'Worldwide',
    thumbnailUrl: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=400&fit=crop',
    durationSeconds: 395,
    reliabilityIndex: 9.4,
    isCached: true,
  },
  {
    id: 'seed-story-4',
    title: 'Electoral District Boundary Reclassification',
    language: 'English',
    category: 'Politics',
    geoScope: 'State/Province',
    geoState: 'California',
    thumbnailUrl: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=400&h=400&fit=crop',
    durationSeconds: 360,
    reliabilityIndex: 8.0,
    isCached: false,
  },
  {
    id: 'seed-story-5',
    title: 'Cross-Border Energy Grid Interconnect',
    language: 'Spanish',
    category: 'Business',
    geoScope: 'Country',
    geoCountry: 'Mexico',
    thumbnailUrl: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=400&h=400&fit=crop',
    durationSeconds: 445,
    reliabilityIndex: 7.9,
    isCached: true,
  },
]

function buildMarkdown(title) {
  return TRUTH_LEDGER_TEMPLATE.replace('[ SYSTEMIC TOPIC TITLE ]', title.toUpperCase())
}

async function main() {
  await resolveAndApplyDatabaseEnv()
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

  try {
  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {
      subscriptionActive: true,
      coreTokens: 50,
      email: 'demo@clearsight.local',
    },
    create: {
      id: DEMO_USER_ID,
      email: 'demo@clearsight.local',
      subscriptionActive: true,
      coreTokens: 50,
    },
  })

  for (const story of SEED_STORIES) {
    await prisma.story.upsert({
      where: { id: story.id },
      update: {
        title: story.title,
        language: story.language,
        category: story.category,
        geoScope: story.geoScope,
        geoRegion: story.geoRegion ?? null,
        geoCountry: story.geoCountry ?? null,
        geoState: story.geoState ?? null,
        geoLocal: story.geoLocal ?? null,
        thumbnailUrl: story.thumbnailUrl,
        durationSeconds: story.durationSeconds,
        reliabilityIndex: story.reliabilityIndex,
        isCached: story.isCached,
        markdownContent: buildMarkdown(story.title),
        sourcesVerified: { seeded: true, compiledAt: new Date().toISOString() },
      },
      create: {
        id: story.id,
        title: story.title,
        language: story.language,
        category: story.category,
        geoScope: story.geoScope,
        geoRegion: story.geoRegion ?? null,
        geoCountry: story.geoCountry ?? null,
        geoState: story.geoState ?? null,
        geoLocal: story.geoLocal ?? null,
        thumbnailUrl: story.thumbnailUrl,
        durationSeconds: story.durationSeconds,
        reliabilityIndex: story.reliabilityIndex,
        isCached: story.isCached,
        markdownContent: buildMarkdown(story.title),
        sourcesVerified: { seeded: true, compiledAt: new Date().toISOString() },
      },
    })
  }

  console.log(`Seeded demo user (${DEMO_USER_ID}) and ${SEED_STORIES.length} stories.`)
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
