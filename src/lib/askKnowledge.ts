import type { AskCitation, AskResult } from '@/lib/askQuery'
import type {
  BiographyData,
  CoreThemeItem,
  HeroData,
  ManPageData,
  RulingsData,
  TimelineData,
} from '@/lib/content'

/**
 * Deterministic answers about the person, built from database rows.
 *
 * This is deliberately not a model and not a search ranking. The reader asks a
 * life/history question, a small set of intent patterns selects the relevant
 * database content, and the answer is composed from those stored sentences. The
 * result keeps the normal `AskResult` shape so citations, history and copy/save
 * work exactly as they do for archive answers.
 */

export type KnowledgeTopic =
  | 'overview'
  | 'birth'
  | 'education'
  | 'career'
  | 'political'
  | 'speakership'
  | 'personal'
  | 'timeline'
  | 'values'
  | 'international'

export interface KnowledgeMilestone {
  year: string
  title: string
  description: string | null
  category: string
}

export interface KnowledgeTestimonial {
  author: string
  role: string | null
  quote: string
  year: number | null
}

export interface KnowledgeEvent {
  startDate: Date | string | null
  type: string
  description: string
  attribution: string | null
}

export interface KnowledgeProfile {
  hero: HeroData
  biography: BiographyData
  timeline: TimelineData
  man: ManPageData
  rulings: RulingsData
  themes: CoreThemeItem[]
  institutions: string[]
  subject: {
    party: string | null
    constituency: string | null
    role: string | null
    roleStart: string | null
  }
  milestones: KnowledgeMilestone[]
  testimonials: KnowledgeTestimonial[]
  events: KnowledgeEvent[]
  researchSourceCount: number
  researchEventCount: number
}

const ARCHIVE_INTENT =
  /\b(?:archive|record|records|document|documents|speech|speeches|address|remarks?|quote|quotes|letter|letters|paper|papers|interview|interviews|news|video|videos|audio|photo|photos|testimonial|testimonials|say|says|said|write|wrote|mention|talk about|position on|view on|stance on|find|show me|show us|notice)\b/i

const LIFE_PHRASE =
  /\b(?:his|her|the speaker'?s?)\s+(?:life|history|biography|background|story|career|timeline|journey)\b/i

const OVERVIEW =
  /\b(?:who\s+(?:is|was|are|were)|who'?s|biography|life story|personal history|full name|his name|real name|tell me about (?:him|himself|her|the speaker|alban|bagbin)|tell me who|introduce (?:him|the speaker)|overview of (?:him|his life))\b/i

const TOPIC_PATTERNS: Array<{ topic: KnowledgeTopic; pattern: RegExp }> = [
  {
    topic: 'birth',
    pattern:
      /\b(?:born|birth|birthday|date of birth|age|how old|hometown|where (?:is|was) he from|where does he come from|childhood|early life|parents?|mother|father|siblings?|brothers?|sisters?|family background|ethnic|dagaaba|sombo|upper west)\b/i,
  },
  {
    topic: 'personal',
    pattern:
      /\b(?:married|marriage|wife|spouse|partner|children|kids|family|religion|religious|christian|catholic|church|personal life|family life)\b/i,
  },
  {
    topic: 'education',
    pattern:
      /\b(?:educat\w*|schools?|universit(?:y|ies)|college|degree|ll\.?b|law school|bar|called to the bar|gimpa|stud(?:y|ied)\w*|academic|qualifications?)\b/i,
  },
  {
    topic: 'international',
    pattern:
      /\b(?:international|ipu|cpa\b|apnac|global|africa|african|commonwealth|unicef|diplomatic|delegation)\b/i,
  },
  {
    topic: 'political',
    pattern:
      /\b(?:politic(?:s|al)?|party|ndc|constituency|nadowli|mp\b|member of parliament|elected|election|elections|terms?|seat|parliament)\b/i,
  },
  {
    topic: 'career',
    pattern:
      /\b(?:career|profession|professional|lawyer|legal practice|attorney|chambers|law trust|business|before politics|tripoli|statistical service|state hotels)\b/i,
  },
  {
    topic: 'speakership',
    pattern:
      /\b(?:speakership|speaker of|become speaker|became speaker|preside|presided|8th parliament|9th parliament|deputy speaker|majority leader|minority leader|minister|rulings?|positions?|roles?|offices?)\b/i,
  },
  {
    topic: 'values',
    pattern:
      /\b(?:values?|believe|belief|beliefs|philosophy|principles?|stand for|ideas?|themes?|legacy|convictions?|what drives)\b/i,
  },
  {
    topic: 'timeline',
    pattern:
      /\b(?:timeline|chronology|(?:his|the speaker'?s?) milestones?|history|over the years|key moments|career path)\b/i,
  },
]

/**
 * Decide whether a turn is a life/history question.
 *
 * Archive questions keep priority: "what did he say about education" is a
 * request for a speech, not a request for a school history. Only a question
 * about his life or his facts bypasses the archive search.
 */
export function detectKnowledgeTopic(question: string): KnowledgeTopic | null {
  const q = question.trim()
  if (!q) return null

  const lifeQuestion = LIFE_PHRASE.test(q)
  if (ARCHIVE_INTENT.test(q) && !lifeQuestion) return null

  // "What did he do before politics?" is a question about the earlier career,
  // even though it names politics. It has to win before the political pattern.
  if (/\bbefore (?:politics|parliament|public life)\b/i.test(q)) return 'career'

  for (const { topic, pattern } of TOPIC_PATTERNS) {
    if (pattern.test(q)) return topic
  }
  if (OVERVIEW.test(q) || lifeQuestion) return 'overview'
  return null
}

function withArticle(text: string): string {
  if (!text) return text
  if (/^(?:a|an|the)\b/i.test(text)) return text
  return `${/^[aeiou]/i.test(text) ? 'an' : 'a'} ${text}`
}

function join(items: string[]): string {
  const clean = items.map(item => item.trim()).filter(Boolean)
  if (clean.length <= 1) return clean[0] ?? ''
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`
  return `${clean.slice(0, -1).join(', ')} and ${clean[clean.length - 1]}`
}

function card(profile: KnowledgeProfile, tag: string): string {
  return profile.biography.cards.find(item => item.tag.toLowerCase() === tag.toLowerCase())?.text ?? ''
}

function manSection(profile: KnowledgeProfile, id: string): string[] {
  const section = profile.man.sections.find(item => item.id === id)
  if (!section) return []
  return section.items.map(item => `${item.title}: ${item.text}`)
}

function yearOf(value: Date | string | null): string {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : String(date.getUTCFullYear())
}

function citation(
  kind: string,
  kindLabel: string,
  collection: string,
  collectionLabel: string,
  title: string,
  href: string,
  excerpt: string | null,
): AskCitation {
  return {
    kind,
    kindLabel,
    collection,
    collectionLabel,
    title,
    href,
    year: null,
    excerpt,
    hasTranscript: false,
    matched: [],
    url: null,
    sourceName: null,
  }
}

const SUGGESTIONS: Record<KnowledgeTopic, string[]> = {
  overview: [
    'Where was he born?',
    'Tell me about his education',
    'How did his political career begin?',
    'What does he stand for?',
  ],
  birth: [
    'Tell me about his education',
    'What was his early career?',
    'How did he enter Parliament?',
  ],
  education: [
    'What did he do after law school?',
    'When did he enter Parliament?',
    'Who is he married to?',
  ],
  career: [
    'When did he enter Parliament?',
    'What positions has he held?',
    'What does he stand for?',
  ],
  political: [
    'How did he become Speaker?',
    'What are his key rulings?',
    'What is his timeline?',
  ],
  speakership: [
    'What are his key rulings?',
    'How did he enter Parliament?',
    'What does he stand for?',
  ],
  personal: [
    'Where was he born?',
    'What is his education?',
    'What does he stand for?',
  ],
  timeline: [
    'Tell me about his early life',
    'How did he become Speaker?',
    'What are his key rulings?',
  ],
  values: [
    'What are his key rulings?',
    'What did he say about Parliament?',
    'Show me his speeches',
  ],
  international: [
    'What positions has he held?',
    'What are his key rulings?',
    'What is his timeline?',
  ],
}

function buildAnswer(
  topic: KnowledgeTopic,
  parts: string[],
  citations: AskCitation[],
): AskResult {
  const summary = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  return {
    summary,
    terms: [],
    match: 'all',
    citations,
    timeline: [],
    testimonials: [],
    collectionCounts: [],
    matchedTerms: [],
    unmatched: [],
    totalMatched: citations.length,
    suggested: SUGGESTIONS[topic],
    conversation: {
      kind: 'profile',
      lead: '',
      quotes: [],
      firstPerson: false,
      anchor: [],
    },
  }
}

/**
 * Compose a prose answer from an already-loaded profile. Pure on purpose: the
 * route can unit-test the wording without a database, and the loader stays a
 * thin mapping layer.
 */
export function answerFromProfile(
  topic: KnowledgeTopic,
  profile: KnowledgeProfile,
): AskResult {
  const { hero, biography, timeline, subject } = profile
  const parts: string[] = []
  const citations: AskCitation[] = []

  const bioCitation = citation(
    'profile',
    'Biography',
    'profile',
    'The Man',
    'The life of a servant-leader',
    '/the-man',
    biography.intro,
  )
  const timelineCitation = citation(
    'profile',
    'Life timeline',
    'timeline',
    'Life timeline',
    'A life in service',
    '/timeline',
    timeline.subheading,
  )
  const recordCitation = citation(
    'research',
    'Public record',
    'research',
    'Speaker record',
    'The Speaker’s sourced public record',
    '/speaker-record',
    `A source-linked chronology with ${profile.researchSourceCount} source records and ${profile.researchEventCount} events.`,
  )

  if (topic === 'overview') {
    parts.push(`${hero.displayName} is ${withArticle(hero.description)}`)
    parts.push(biography.intro)
    const education = card(profile, 'Education')
    const career = card(profile, 'Career')
    const personal = card(profile, 'Personal life')
    if (education) parts.push(`His education: ${education}`)
    if (career) parts.push(`His career: ${career}`)
    if (personal) parts.push(`Personal life: ${personal}`)
    if (subject.constituency) {
      parts.push(`He has represented ${subject.constituency.split(',')[0]}.`)
    }
    if (subject.party) {
      parts.push(`He is a member of the ${subject.party.split(',')[0]}.`)
    }
    parts.push(
      `In Parliament he has been elected seven times, and he has served as Speaker since ${hero.profileValue}.`,
    )
    if (profile.rulings.items.length) {
      parts.push(
        `His Speakership is associated with ${join(profile.rulings.items.slice(0, 3).map(item => item.title))}.`,
      )
    }
    citations.push(bioCitation, timelineCitation, recordCitation)
  }

  if (topic === 'birth') {
    parts.push(biography.intro)
    const early = profile.man.sections.find(section => section.id === 'early-life')
    const childhood = early?.items.find(item => /childhood/i.test(item.title))
    const sombo = early?.items.find(item => /sombo/i.test(item.title))
    if (childhood) parts.push(childhood.text)
    if (sombo) parts.push(sombo.text)
    citations.push(
      citation('profile', 'Biography', 'profile', 'The Man', 'Early Life', '/the-man#early-life', early?.intro ?? biography.intro),
      timelineCitation,
    )
  }

  if (topic === 'education') {
    const education = card(profile, 'Education')
    if (education) parts.push(education)
    citations.push(
      citation('profile', 'Biography', 'profile', 'The Man', 'Education', '/the-man#education', education || biography.intro),
      timelineCitation,
    )
  }

  if (topic === 'career') {
    const career = card(profile, 'Career')
    if (career) parts.push(career)
    parts.push(
      'Alongside his legal practice he built a parliamentary career that now spans every parliament of the Fourth Republic.',
    )
    citations.push(
      citation('profile', 'Biography', 'profile', 'The Man', 'Professional Life', '/the-man#professional-life', career || biography.intro),
      recordCitation,
    )
  }

  if (topic === 'political') {
    const partyName = subject.party?.split(',')[0]
    const constituencyName = subject.constituency?.split(',')[0]
    const party = partyName ? ` He is documented as a member of the ${partyName}.` : ''
    const constituency = constituencyName ? ` His constituency is recorded as ${constituencyName}.` : ''
    parts.push(
      `${hero.displayName} entered Parliament as an MP and has been elected seven times.${party}${constituency}`,
    )
    const entries = timeline.entries.filter(entry => Number(entry.year) >= 1992)
    if (entries.length) {
      parts.push(
        `The main steps: ${entries
          .map(entry => `${entry.year} — ${entry.title}: ${entry.text}`)
          .join(' ')}`,
      )
    }
    citations.push(timelineCitation, recordCitation)
  }

  if (topic === 'speakership') {
    parts.push(hero.description)
    const entries = timeline.entries.filter(entry => /speaker|minister|leader|deputy/i.test(entry.title))
    if (entries.length) {
      parts.push(entries.map(entry => `${entry.year} — ${entry.title}: ${entry.text}`).join(' '))
    }
    const rulings = profile.rulings.items.slice(0, 3)
    if (rulings.length) {
      parts.push(`His Speakership is associated with ${join(rulings.map(item => item.title))}.`)
    }
    citations.push(
      citation('profile', 'Parliament', 'parliament', 'Parliament', 'A Parliament that stands its ground', '/parliament', rulings[0]?.note ?? hero.description),
      timelineCitation,
      recordCitation,
    )
  }

  if (topic === 'personal') {
    const personal = card(profile, 'Personal life')
    if (personal) parts.push(personal)
    parts.push(
      'Beyond that, the published biography does not list further family details.',
    )
    citations.push(
      citation('profile', 'Biography', 'profile', 'The Man', 'Personal Life', '/#profile', personal || biography.intro),
    )
  }

  if (topic === 'timeline') {
    // Use the seed/research milestones only for the years before the curated
    // parliamentary timeline starts; otherwise 1992 onwards is listed twice.
    const early = profile.milestones.filter(item => Number(item.year) < 1992)
    const dated = [
      ...early,
      ...timeline.entries.map(entry => ({
        year: entry.year,
        title: entry.title,
        description: entry.text,
        category: 'milestone',
      })),
    ]
      .filter(item => item.year)
      .sort((a, b) => Number(a.year) - Number(b.year))
    const seen = new Set<string>()
    const unique = dated.filter(item => {
      const key = `${item.year}:${item.title}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    parts.push(
      `The stored chronology runs from ${unique[0]?.year ?? '1957'} to ${unique[unique.length - 1]?.year ?? '2025'}.`,
    )
    parts.push(
      unique
        .map(item => `${item.year} — ${item.title}${item.description ? `: ${item.description}` : ''}`)
        .join(' '),
    )
    citations.push(timelineCitation, recordCitation)
  }

  if (topic === 'values') {
    const values = manSection(profile, 'values')
    if (values.length) parts.push(values.join(' '))
    if (profile.themes.length) {
      parts.push(
        `The themes that recur across the archive are ${join(profile.themes.map(theme => theme.name))}.`,
      )
    }
    if (profile.rulings.items.length) {
      parts.push(
        `In the Chair, those convictions appear in ${join(profile.rulings.items.slice(0, 3).map(item => item.title))}.`,
      )
    }
    citations.push(
      citation('profile', 'Themes', 'profile', 'Themes', 'Themes & ideas', '/themes', profile.themes[0]?.description ?? null),
      citation('profile', 'Rulings', 'parliament', 'Parliament', 'A Parliament that stands its ground', '/parliament', profile.rulings.items[0]?.note ?? null),
    )
  }

  if (topic === 'international') {
    const institutions = profile.institutions.length
      ? `His public record lists ${join(profile.institutions)} among the institutions and bodies associated with his career.`
      : ''
    if (institutions) parts.push(institutions)
    const international = profile.events
      .filter(event =>
        /international|ipu|african|apnac|cpa|diplomatic|delegation|unicef|commonwealth|global/i.test(
          `${event.type} ${event.description}`,
        ),
      )
      .slice(0, 6)
    if (international.length) {
      parts.push(
        `International milestones include ${international
          .map(event => `${yearOf(event.startDate)} — ${event.description}`)
          .join(' ')}`,
      )
    }
    citations.push(
      citation('profile', 'Institutions', 'profile', 'The Man', 'Institutions & affiliations', '/the-man', institutionExcerpt(profile)),
      recordCitation,
    )
  }

  return buildAnswer(topic, parts, citations)
}

function institutionExcerpt(profile: KnowledgeProfile): string | null {
  return profile.institutions.length ? profile.institutions.join(' · ') : null
}
