import {
  CONTENT_CATEGORIES,
  canonicalizeCategory,
  typeForCategory,
  type ContentCategory,
  type ContentType,
} from '@/lib/taxonomy'
import { HOST_ANDERSON } from '@/lib/hosts'

export interface AnalysisFramework {
  /** Short label for prompts */
  label: string
  /** Directive bullets for briefing ANALYTICAL INSIGHT section */
  briefingDirectives: string[]
  /** Directive bullets for podcast script generation */
  podcastDirectives: string[]
  /** Required analytical arc for podcast dialogue */
  analyticalArc: string
  /** Mandatory forecast instruction */
  forecastMandate: string
  /** Anti-fluff rules for podcast scripts */
  antiFluffRules: string[]
}

const DEFAULT_FRAMEWORK: AnalysisFramework = {
  label: 'General intelligence analysis',
  briefingDirectives: [
    'Identify the primary causal drivers behind the reported development — not just what happened, but why',
    'Compare key actors, sides, or alternatives: strengths, weaknesses, and leverage points',
    'Assess second-order effects and who gains or loses from the current trajectory',
    'Provide a forward-looking forecast with 2–3 realistic scenarios and confidence levels',
  ],
  podcastDirectives: [
    'Break down WHY the outcome or development occurred — name specific causal factors',
    'Compare strengths and weaknesses of the main parties or sides involved',
    'Discuss second-order effects that standard headlines skip',
    'Close with a concrete forecast: what happens next and under what conditions',
  ],
  analyticalArc:
    'Structure the conversation: (1) verified facts → (2) causal analysis → (3) comparative breakdown → (4) forecast',
  forecastMandate:
    'MANDATORY: Include a forward-looking forecast segment before the closing summary.',
  antiFluffRules: [
    'Ban filler reactions: "wow", "that\'s huge", "incredible", "let\'s dive in", "so interesting"',
    'Ban recap turns that restate the headline without adding analysis',
    'Ban hype and emotional commentary without analytical substance',
    'Every host turn must introduce a NEW factor, comparison, data point, or prediction',
  ],
}

// Type-level frameworks for Education and Entertainment. Specific categories can
// still override via FRAMEWORKS; otherwise generation falls back to the Type
// default (News uses DEFAULT_FRAMEWORK).
const EDUCATION_FRAMEWORK: AnalysisFramework = {
  label: 'Educational explainer',
  briefingDirectives: [
    'Teach the core concept from first principles — assume curiosity, not prior expertise',
    'Define every key term plainly the first time it appears',
    'Ground the idea with concrete examples and intuitive analogies',
    'Surface and correct the most common misconceptions',
  ],
  podcastDirectives: [
    'Build understanding step by step — each turn adds one teachable idea',
    'Translate jargon into plain language with a quick analogy',
    'Use worked examples the listener can picture',
    'Pause to connect the new idea back to what was just established',
  ],
  analyticalArc:
    'Structure: (1) hook / why it matters → (2) core concept from first principles → (3) examples & analogies → (4) recap of key takeaways',
  forecastMandate:
    'MANDATORY: Close with a concrete recap of the key takeaways the listener should remember.',
  antiFluffRules: [
    'Ban unexplained jargon and acronyms',
    'Ban skipping foundational steps the explanation depends on',
    'Every turn must teach a discrete idea, example, or correction',
    'No filler reactions or hype — clarity over excitement',
  ],
}

const ENTERTAINMENT_FRAMEWORK: AnalysisFramework = {
  label: 'Narrative storytelling',
  briefingDirectives: [
    'Establish the central narrative and what is at stake',
    'Lay out a clear timeline of the key events',
    'Introduce the key figures and their motivations',
    'Surface the most compelling unanswered questions',
  ],
  podcastDirectives: [
    'Tell it as a story with genuine narrative tension and pacing',
    'Foreground vivid, specific detail over generalities',
    'Build toward the central mystery, twist, or turning point',
    'Clearly separate established fact from speculation as you go',
  ],
  analyticalArc:
    'Structure: (1) cold-open hook → (2) background & key players → (3) the central twist or mystery → (4) where things stand & open questions',
  forecastMandate:
    'MANDATORY: Close by clearly separating what is established fact from open speculation.',
  antiFluffRules: [
    'Ban presenting unverified claims or rumor as established fact',
    'Ban filler reactions that stall the narrative',
    'Keep momentum with concrete, sensory detail',
    'Avoid moralizing or gratuitous sensationalism',
  ],
}

const LIFESTYLE_FRAMEWORK: AnalysisFramework = {
  label: 'Practical lifestyle guide',
  briefingDirectives: [
    'Lead with the practical question or goal the listener actually has',
    'Give specific, actionable steps or options — not vague encouragement',
    'Explain the why behind each recommendation so choices are informed',
    'Note common mistakes, trade-offs, and how to avoid or weigh them',
  ],
  podcastDirectives: [
    'Open with the real-life situation or goal the episode solves for',
    'Walk through concrete, doable steps the listener can act on today',
    'Explain the reasoning and trade-offs behind each tip',
    'Share practical examples, rules of thumb, and pitfalls to avoid',
  ],
  analyticalArc:
    'Structure: (1) the goal / problem → (2) what to know first → (3) step-by-step approach & options → (4) pitfalls and trade-offs → (5) a simple action plan',
  forecastMandate:
    'MANDATORY: Close with a short, concrete action plan — the first steps the listener should take.',
  antiFluffRules: [
    'Ban vague motivation with no concrete action ("just be consistent")',
    'Ban unexplained recommendations — always give the reason and trade-off',
    'Every segment must add a step, option, example, or pitfall',
    'Keep it warm and practical — no hype, no filler reactions',
  ],
}

const TYPE_FRAMEWORKS: Record<ContentType, AnalysisFramework> = {
  News: DEFAULT_FRAMEWORK,
  Education: EDUCATION_FRAMEWORK,
  Entertainment: ENTERTAINMENT_FRAMEWORK,
  Lifestyle: LIFESTYLE_FRAMEWORK,
}

/**
 * Builds a topic-specialized Education framework on the shared explainer base,
 * focusing the directives/arc on one subject. Keeps the educational tone while
 * giving each topic its own analytical lens.
 */
function eduFramework(label: string, focus: string, arc: string): AnalysisFramework {
  return {
    label,
    briefingDirectives: [
      `Teach the core idea of ${focus} from first principles — assume curiosity, not expertise`,
      'Define every key term plainly the first time it appears',
      `Ground the idea with concrete, picturable examples drawn from ${focus}`,
      'Surface and correct the most common misconception about it',
    ],
    podcastDirectives: [
      `Build understanding of ${focus} step by step — each turn adds one teachable idea`,
      'Translate jargon into plain language with a quick analogy',
      'Use a worked example or vivid scenario the listener can picture',
      'Connect each new idea back to what was just established',
    ],
    analyticalArc: arc,
    forecastMandate:
      'MANDATORY: Close with a concrete recap of the key takeaways the listener should remember.',
    antiFluffRules: [
      'Ban unexplained jargon and acronyms',
      'Ban skipping foundational steps the explanation depends on',
      'Every turn must teach a discrete idea, example, or correction',
      'No filler reactions or hype — clarity over excitement',
    ],
  }
}

const EDUCATION_TOPIC_FRAMEWORKS: Partial<Record<ContentCategory, AnalysisFramework>> = {
  Mathematics: eduFramework(
    'Mathematics explainer',
    'a mathematical concept',
    'Structure: (1) the question it answers → (2) the concept from first principles → (3) a worked example → (4) where it shows up in the world → (5) recap'
  ),
  'Science & Discovery': eduFramework(
    'Science explainer',
    'a scientific concept or discovery',
    'Structure: (1) the phenomenon → (2) the mechanism → (3) the evidence/experiment → (4) why it matters → (5) recap'
  ),
  'Space & Astronomy': eduFramework(
    'Space & astronomy explainer',
    'an astronomical idea',
    'Structure: (1) the cosmic question → (2) what we observe → (3) the explanation → (4) open frontiers → (5) recap'
  ),
  History: eduFramework(
    'History explainer',
    'a historical event or era',
    'Structure: (1) the moment that matters → (2) the context that led to it → (3) what happened → (4) consequences and legacy → (5) recap'
  ),
  'Medicine & Health': eduFramework(
    'Medicine & health explainer',
    'a medical or health topic',
    'Structure: (1) the condition/process → (2) how the body is involved → (3) what the evidence shows → (4) practical implications → (5) recap'
  ),
  'Money & Economics': eduFramework(
    'Money & economics explainer',
    'an economic concept',
    'Structure: (1) the everyday question → (2) the underlying mechanism → (3) a concrete example → (4) the bigger-picture effects → (5) recap'
  ),
  'Arts & Culture': eduFramework(
    'Arts & culture explainer',
    'an artistic movement, work, or cultural idea',
    'Structure: (1) the hook → (2) context and influences → (3) what makes it distinctive → (4) lasting impact → (5) recap'
  ),
  'Nature & Environment': eduFramework(
    'Nature & environment explainer',
    'a natural-world or environmental topic',
    'Structure: (1) the system → (2) how it works → (3) what is changing → (4) why it matters → (5) recap'
  ),
  'Technology & Coding': eduFramework(
    'Technology & coding explainer',
    'a technology or programming concept',
    'Structure: (1) the problem it solves → (2) how it works under the hood → (3) a concrete example → (4) where it is used → (5) recap'
  ),
  'Career & Job Market': {
    label: 'Career & job-market guidance',
    briefingDirectives: [
      'Identify the concrete labor-market shift and the data behind it',
      'Explain the forces driving the change (technology, demographics, policy, economics)',
      'Specify which roles, industries, and regions are most affected',
      'Lay out the skills that are rising in value and how to build them',
    ],
    podcastDirectives: [
      'Open with the trend and the evidence — not vague optimism or doom',
      'Explain the drivers behind the shift in plain terms',
      'Name who is affected and how, with specifics',
      'Give concrete, actionable next steps the listener can start now',
    ],
    analyticalArc:
      'Structure: (1) trend snapshot → (2) what is driving it → (3) who is affected → (4) skills that matter now → (5) concrete next steps',
    forecastMandate:
      'MANDATORY: Close with a short, actionable plan — the first steps the listener should take.',
    antiFluffRules: [
      'Ban generic motivation without specifics',
      'Ban buzzwords with no concrete meaning',
      'Every segment must add a driver, an affected group, a skill, or a step',
      'No hype — practical, grounded guidance only',
    ],
  },
}

const FRAMEWORKS: Partial<Record<ContentCategory, AnalysisFramework>> = {
  Sports: {
    label: 'Sports performance analysis',
    briefingDirectives: [
      'Identify 3–5 key causal factors behind the outcome (roster depth, coaching adjustments, matchups, injuries, momentum, tactical execution)',
      'Analyze the losing/opposing side: specific strengths that worked and weaknesses that were exploited',
      'Analyze the winning side: what they did differently and whether it is sustainable',
      'Forecast next season or next phase: roster outlook, competitive positioning, and realistic title/contention trajectory for both teams',
    ],
    podcastDirectives: [
      'Break down the specific factors that decided the outcome — not the scoreline recap',
      'Analyze the opponent\'s strengths AND weaknesses with concrete examples from the briefing',
      'Discuss roster, coaching, matchup, or tactical dynamics that standard highlight reels miss',
      'Forecast how both teams project for next season — contention window, roster needs, competitive outlook',
    ],
    analyticalArc:
      'Structure: (1) outcome facts → (2) key win/loss factors → (3) opponent strengths & weaknesses → (4) next-season forecast for both sides',
    forecastMandate:
      'MANDATORY: ${hostB} must deliver a next-season forecast for both teams before the closing summary.',
    antiFluffRules: [
      'Ban fan-reaction fluff: "what a game", "they deserved it", "history was made" without analysis',
      'Ban scoreline recaps — assume the listener knows who won',
      'Every turn must name a factor, matchup, roster element, or projection',
      'No generic praise — replace with specific performance analysis',
    ],
  },
  Politics: {
    label: 'Political power analysis',
    briefingDirectives: [
      'Map power dynamics: who gains leverage, who loses it, and why',
      'Identify coalition, institutional, or electoral drivers behind the development',
      'Compare strategic options available to key actors and their trade-offs',
      'Forecast 2–3 realistic forward scenarios with triggers and probability language',
    ],
    podcastDirectives: [
      'Explain the power dynamics driving the development — not just what was announced',
      'Identify winners and losers with specific mechanisms (votes, leverage, alliances)',
      'Compare strategic options and why actors chose or may choose certain paths',
      'Forecast realistic scenarios: what happens next and what would change the trajectory',
    ],
    analyticalArc:
      'Structure: (1) reported facts → (2) power dynamics & drivers → (3) winners/losers comparison → (4) scenario forecast',
    forecastMandate:
      'MANDATORY: Include a scenario-based political forecast before the closing summary.',
    antiFluffRules: [
      'Ban partisan cheerleading or doom rhetoric without analytical backing',
      'Ban restating press releases without interpreting leverage and incentives',
      'Every turn must add a mechanism, stakeholder, or scenario',
    ],
  },
  Business: {
    label: 'Business competitive analysis',
    briefingDirectives: [
      'Identify market catalysts and structural drivers behind the development',
      'Analyze competitive positioning: who gains market share, margin, or strategic advantage',
      'Assess supply chain, regulatory, or consumer second-order effects',
      'Forecast business outlook: earnings trajectory, competitive response, and industry reshaping',
    ],
    podcastDirectives: [
      'Break down the business drivers — not the headline announcement',
      'Compare competitive positioning: who wins, who loses, and why structurally',
      'Discuss second-order market effects standard business news skips',
      'Forecast the industry outlook and likely competitive responses',
    ],
    analyticalArc:
      'Structure: (1) facts → (2) market catalysts → (3) competitive positioning → (4) industry forecast',
    forecastMandate:
      'MANDATORY: Include a business/industry outlook forecast before the closing summary.',
    antiFluffRules: [
      'Ban stock-price hype without connecting to fundamentals',
      'Ban CEO quote recitation without strategic interpretation',
      'Every turn must add a catalyst, competitive factor, or projection',
    ],
  },
  'Finance & Macroeconomics': {
    label: 'Macroeconomic analysis',
    briefingDirectives: [
      'Identify macro catalysts: rates, inflation, employment, trade, fiscal policy drivers',
      'Compare impact across sectors, regions, and asset classes',
      'Assess transmission mechanisms and lag effects on consumers and businesses',
      'Forecast economic trajectory with specific indicators to watch',
    ],
    podcastDirectives: [
      'Explain the macro drivers — not just the data release headline',
      'Compare cross-sector and cross-region impact with specific mechanisms',
      'Discuss transmission effects and what standard finance headlines miss',
      'Forecast the economic trajectory and key indicators to monitor',
    ],
    analyticalArc:
      'Structure: (1) data/facts → (2) macro drivers → (3) sector/region comparison → (4) economic forecast',
    forecastMandate:
      'MANDATORY: Include an economic outlook forecast with indicators to watch before closing.',
    antiFluffRules: [
      'Ban market panic/cheer without connecting to data and mechanisms',
      'Ban repeating CPI/GDP numbers without interpreting drivers',
      'Every turn must add a transmission mechanism, comparison, or projection',
    ],
  },
  Technology: {
    label: 'Technology impact analysis',
    briefingDirectives: [
      'Explain the technical or regulatory mechanism behind the development',
      'Compare to prior state, alternatives, and competitive landscape',
      'Assess adoption barriers, security/regulatory risks, and ecosystem effects',
      'Forecast adoption trajectory and industry restructuring implications',
    ],
    podcastDirectives: [
      'Explain HOW and WHY the technology development matters — not product hype',
      'Compare against alternatives and the prior competitive landscape',
      'Discuss adoption, regulatory, or security implications others miss',
      'Forecast the technology trajectory and who wins/loses in the ecosystem',
    ],
    analyticalArc:
      'Structure: (1) facts → (2) mechanism/what changed → (3) competitive comparison → (4) adoption forecast',
    forecastMandate:
      'MANDATORY: Include a technology adoption/industry forecast before closing.',
    antiFluffRules: [
      'Ban gadget hype and "revolutionary" language without technical substance',
      'Ban feature-list recitation without strategic analysis',
      'Every turn must add a mechanism, comparison, or trajectory prediction',
    ],
  },
  Science: {
    label: 'Scientific significance analysis',
    briefingDirectives: [
      'Explain the scientific mechanism or finding and why it matters now',
      'Compare to prior research, consensus, and alternative explanations',
      'Assess practical implications for policy, industry, or public health',
      'Forecast research trajectory and real-world impact timeline',
    ],
    podcastDirectives: [
      'Explain the scientific significance — not just the discovery headline',
      'Compare to prior consensus and what this changes',
      'Discuss practical implications standard science news skips',
      'Forecast the research and real-world impact trajectory',
    ],
    analyticalArc:
      'Structure: (1) finding facts → (2) scientific mechanism → (3) comparison to prior state → (4) impact forecast',
    forecastMandate:
      'MANDATORY: Include a research/impact timeline forecast before closing.',
    antiFluffRules: [
      'Ban "breakthrough" hype without explaining the mechanism',
      'Ban oversimplification that loses the scientific nuance',
      'Every turn must add a mechanism, comparison, or implication',
    ],
  },
  'Health & Medicine': {
    label: 'Health policy & clinical analysis',
    briefingDirectives: [
      'Explain the clinical, regulatory, or public-health mechanism behind the development',
      'Compare to existing treatments, guidelines, or epidemiological trends',
      'Assess population-level impact, access, and equity implications',
      'Forecast health policy trajectory and patient/outcome implications',
    ],
    podcastDirectives: [
      'Explain the clinical or public-health significance — not fear or hype',
      'Compare to existing standards of care or prior epidemiological data',
      'Discuss access, equity, or policy implications others miss',
      'Forecast the health policy and patient outcome trajectory',
    ],
    analyticalArc:
      'Structure: (1) facts → (2) clinical/policy mechanism → (3) comparison to current standard → (4) health forecast',
    forecastMandate:
      'MANDATORY: Include a health policy/outcome forecast before closing.',
    antiFluffRules: [
      'Ban alarmism or false reassurance without evidence',
      'Ban repeating trial names without interpreting clinical significance',
      'Every turn must add a mechanism, comparison, or population impact',
    ],
  },
  Crime: {
    label: 'Criminal justice & enforcement analysis',
    briefingDirectives: [
      'Identify legal, enforcement, or institutional drivers behind the development',
      'Compare to precedent cases, jurisdictional patterns, and systemic factors',
      'Assess implications for policy, public safety, and institutional trust',
      'Forecast legal trajectory and systemic implications',
    ],
    podcastDirectives: [
      'Analyze the legal and enforcement dynamics — not sensational recap',
      'Compare to precedent and systemic patterns in the briefing',
      'Discuss policy and institutional implications standard crime news skips',
      'Forecast the legal trajectory and broader systemic impact',
    ],
    analyticalArc:
      'Structure: (1) facts → (2) legal/enforcement drivers → (3) precedent comparison → (4) systemic forecast',
    forecastMandate:
      'MANDATORY: Include a legal/systemic forecast before closing.',
    antiFluffRules: [
      'Ban sensationalism and crime-drama language',
      'Ban victim/perpetrator narrative without legal analysis',
      'Every turn must add a legal mechanism, precedent, or systemic factor',
    ],
  },
}

// Combined category → framework lookup (News + Education topics).
const ALL_FRAMEWORKS: Partial<Record<ContentCategory, AnalysisFramework>> = {
  ...FRAMEWORKS,
  ...EDUCATION_TOPIC_FRAMEWORKS,
}

function isContentCategory(value: string): value is ContentCategory {
  return (CONTENT_CATEGORIES as readonly string[]).includes(value)
}

/**
 * Returns category-aware analytical framework for briefings and podcasts.
 * Falls back to generic intelligence analysis for Top/unknown categories.
 */
export function getAnalysisFramework(category: string, type?: ContentType): AnalysisFramework {
  const canonical = canonicalizeCategory(category)
  if (isContentCategory(canonical) && ALL_FRAMEWORKS[canonical]) {
    return ALL_FRAMEWORKS[canonical] as AnalysisFramework
  }
  const resolvedType = type ?? typeForCategory(canonical)
  return TYPE_FRAMEWORKS[resolvedType] ?? DEFAULT_FRAMEWORK
}

/** Format briefing directives as a prompt block */
export function formatBriefingAnalysisBlock(category: string, type?: ContentType): string {
  const fw = getAnalysisFramework(category, type)
  const bullets = fw.briefingDirectives.map((d) => `- ${d}`).join('\n')
  return `### ANALYTICAL INSIGHT
(${fw.label} — go beyond standard news headlines. Ground all analysis in verified facts above.)
${bullets}
${fw.forecastMandate}`
}

/** Format podcast directives as a prompt block */
export function formatPodcastAnalysisBlock(category: string, hostB: string, type?: ContentType): string {
  const fw = getAnalysisFramework(category, type)
  const directives = fw.podcastDirectives.map((d) => `- ${d}`).join('\n')
  const antiFluff = fw.antiFluffRules.map((r) => `- ${r}`).join('\n')
  const forecast = fw.forecastMandate.replace('${hostB}', hostB)

  return `ANALYTICAL FRAMEWORK (${fw.label}):
${directives}

REQUIRED ARC: ${fw.analyticalArc}
${forecast}

ANTI-FLUFF RULES (strict):
${antiFluff}
- Ban meta-commentary about the podcast itself`
}

/** Format editorial review checklist additions for podcast scripts */
export function formatPodcastReviewAnalysisBlock(category: string, type?: ContentType): string {
  const fw = getAnalysisFramework(category, type)
  const directives = fw.podcastDirectives.map((d, i) => `${i + 9}. Ensure the script covers: ${d}`).join('\n')
  const antiFluff = fw.antiFluffRules
    .map((r, i) => `${i + 9 + fw.podcastDirectives.length}. Enforce anti-fluff: ${r}`)
    .join('\n')

  return `ANALYTICAL QUALITY REQUIREMENTS (${fw.label}):
${directives}
${9 + fw.podcastDirectives.length}. Verify the script follows this arc: ${fw.analyticalArc}
${10 + fw.podcastDirectives.length}. ${fw.forecastMandate.replace('${hostB}', HOST_ANDERSON.name)}
${antiFluff}
${9 + fw.podcastDirectives.length + fw.antiFluffRules.length + 1}. Replace any generic/fluff line with a specific analytical insight from the briefing`
}
