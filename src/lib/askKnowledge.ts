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
      /\b(?:born|birth|birthday|date of birth|age|how old|hometown|where (?:is|was) he from|where does he come from|where does he (?:live|reside)|residence|childhood|early life|parents?|mother|father|siblings?|brothers?|sisters?|family background|ethnic\w*|tribe|dagaaba|sombo|upper west)\b/i,
  },
  {
    topic: 'personal',
    pattern:
      /\b(?:married|marriage|wife|spouse|partner|children|kids|family|religion|religious|christian|catholic|church|personal life|family life)\b/i,
  },
  {
    topic: 'education',
    pattern:
      /\b(?:educat\w*|schools?|universit(?:y|ies)|college|degree|ll\.?b|law school|bar|called to the bar|gimpa|stud(?:y|ied)\w*|academic|qualifications?|graduat\w*)\b/i,
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
      /\b(?:career|profession|professional|lawyer|legal practice|attorney|chambers|law trust|business|before politics|tripoli|statistical service|state hotels)\b|what does he do|for a living|is he a lawyer|his job\b/i,
  },
  {
    topic: 'speakership',
    pattern:
      /\b(?:speakership|speaker of|become speaker|became speaker|opposition speaker|preside|presided|8th parliament|9th parliament|deputy speaker|majority leader|minority leader|minister|rulings?|positions?|roles?|offices?|come back|return as speaker)\b/i,
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

const MONTH_NAME = /jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?/i

/**
 * A date typed three ways the profile writes it: "24 September 1957" in prose,
 * "24 Sep 1957" in a hero fact and "2021-01-07" in a research field.
 */
function parseLooseDate(raw: string): Date | null {
  const text = raw.trim()
  if (!text) return null

  const dayFirst = text.match(/([0-9]{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+([0-9]{4})/)
  if (dayFirst && MONTH_NAME.test(dayFirst[2])) {
    const date = new Date(`${dayFirst[1]} ${dayFirst[2]} ${dayFirst[3]}`)
    if (!Number.isNaN(date.getTime())) return date
  }

  const monthFirst = text.match(/([A-Za-z]{3,9})\.?\s+([0-9]{1,2})(?:st|nd|rd|th)?,?\s+([0-9]{4})/)
  if (monthFirst && MONTH_NAME.test(monthFirst[1])) {
    const date = new Date(`${monthFirst[1]} ${monthFirst[2]} ${monthFirst[3]}`)
    if (!Number.isNaN(date.getTime())) return date
  }

  const iso = text.match(/\b([0-9]{4})-([0-9]{2})-([0-9]{2})\b/)
  if (iso) {
    const date = new Date(iso[0])
    if (!Number.isNaN(date.getTime())) return date
  }

  return null
}

function formatLongDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function completeYearsBetween(from: Date, now = new Date()): number {
  const years = now.getUTCFullYear() - from.getUTCFullYear()
  const beforeBirthday =
    now.getUTCMonth() < from.getUTCMonth() ||
    (now.getUTCMonth() === from.getUTCMonth() && now.getUTCDate() < from.getUTCDate())
  return beforeBirthday ? years - 1 : years
}

function dateOfBirthOf(profile: KnowledgeProfile): Date | null {
  const born = profile.hero.facts.find(fact => /\bborn\b/i.test(`${fact.value} ${fact.label}`))
  if (born) {
    const date = parseLooseDate(born.value)
    if (date) return date
  }
  const early = profile.man.sections.find(section => section.id === 'early-life')
  const candidates = [
    profile.biography.intro,
    early?.intro ?? '',
    ...(early?.items.map(item => item.text) ?? []),
    ...profile.milestones.map(item => `${item.year} ${item.description ?? ''} ${item.title}`),
  ]
  for (const text of candidates) {
    const date = parseLooseDate(text)
    if (date) return date
  }
  return null
}

function hailsFrom(profile: KnowledgeProfile): string | null {
  const intro = profile.biography.intro
  const region = intro.match(/([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)*)\s+Region/)?.[1]?.trim()
  const town =
    intro.match(/hails from\s+([A-Za-z]+)/i)?.[1]?.trim() ??
    intro.match(/born in\s+([A-Za-z]+)/i)?.[1]?.trim() ??
    null
  if (town && region) return `${town}, ${region} Region`
  if (region) return `${region} Region`
  return town
}

function parentsOf(profile: KnowledgeProfile): { names: string[]; note: string | null } | null {
  // "…born on 24 September 1957 to <Name> and <Name>, both peasant farmers —".
  // Lazy name runs that stop at " and " and at the comma, each anchored on a
  // capital so the date before "to" cannot be swallowed.
  const intro = profile.biography.intro
  const match = intro.match(/\bto\s+([A-Z][^,;]+?)\s+and\s+([A-Z][^,;]+?),/)
  if (!match) return null
  const [first, second] = [match[1].trim(), match[2].trim()]
  if (!first || !second || first.length > 60 || second.length > 60) return null
  const note = intro.match(/both\s+((?:[a-z]+ ?){1,4})[—–.]/i)?.[1]?.trim() ?? null
  return { names: [first, second], note }
}

function sentenceFromCard(profile: KnowledgeProfile, tag: string, needle: RegExp): string | null {
  const text = card(profile, tag)
  return (
    text
      .split(/(?<=[.!?])\s+/)
      .find(sentence => needle.test(sentence))
      ?.trim() ?? null
  )
}

function decapitalize(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1)
}

function numberWord(n: number): string {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
  return words[n] ?? String(n)
}

function monthYearOf(value: Date | string | null): string {
  const date = value instanceof Date ? value : parseLooseDate(value ?? '')
  if (!date) return 'an undated date'
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function barYearOf(profile: KnowledgeProfile): string | null {
  return card(profile, 'Education').match(/called to the bar(?:\s+in\s+)?(\d{4})/i)?.[1] ?? null
}

function firstParliamentEntry(profile: KnowledgeProfile) {
  return (
    profile.timeline.entries
      .filter(entry => /\b(?:parliament|seat|mp\b|elected)\b/i.test(`${entry.title} ${entry.text}`))
      .sort((a, b) => Number(a.year) - Number(b.year))[0] ?? null
  )
}

function electionCount(profile: KnowledgeProfile): number | null {
  const fact = profile.hero.facts.find(fact => /\b(\d+)\s*terms?\b/i.test(`${fact.value} ${fact.label}`))
  const n = Number(fact?.value.match(/(\d+)/)?.[1])
  return Number.isInteger(n) && n > 0 ? n : null
}

function biographyCitation(profile: KnowledgeProfile): AskCitation {
  return citation('profile', 'Biography', 'profile', 'The Man', 'Early Life', '/the-man#early-life', profile.biography.intro || null)
}

function educationCitation(profile: KnowledgeProfile): AskCitation {
  return citation('profile', 'Biography', 'profile', 'The Man', 'Education', '/the-man#education', card(profile, 'Education') || profile.biography.intro || null)
}

function careerCitation(profile: KnowledgeProfile): AskCitation {
  return citation('profile', 'Biography', 'profile', 'The Man', 'Professional Life', '/the-man#professional-life', card(profile, 'Career') || profile.biography.intro || null)
}

function lifeTimelineCitation(profile: KnowledgeProfile): AskCitation {
  return citation('profile', 'Life timeline', 'timeline', 'Life timeline', 'A life in service', '/timeline', profile.timeline.subheading || null)
}

function publicRecordCitation(): AskCitation {
  return citation('research', 'Public record', 'research', 'Speaker record', 'The Speaker’s sourced public record', '/speaker-record', null)
}

type FactAnswer = { parts: string[]; citations: AskCitation[] }

const FACT_PATTERNS: Array<{
  topic: KnowledgeTopic
  pattern: RegExp
  build: (profile: KnowledgeProfile, question: string) => FactAnswer | null
}> = [
  {
    topic: 'birth',
    pattern: /\b(?:how old|age)\b/i,
    build: profile => {
      const dob = dateOfBirthOf(profile)
      if (!dob) return null
      const age = completeYearsBetween(dob)
      if (age < 0 || age > 130) return null
      const place = hailsFrom(profile)
      return {
        parts: [`He is ${age} years old — born on ${formatLongDate(dob)}${place ? `, and he hails from ${place}` : ''}.`],
        citations: [biographyCitation(profile)],
      }
    },
  },
  {
    topic: 'birth',
    pattern: /\b(?:date of birth|birth time|when was he born)\b/i,
    build: profile => {
      const dob = dateOfBirthOf(profile)
      if (!dob) return null
      const place = hailsFrom(profile)
      return {
        parts: [`He was born on ${formatLongDate(dob)}${place ? `, and he hails from ${place}` : ''}.`],
        citations: [biographyCitation(profile)],
      }
    },
  },
  {
    topic: 'birth',
    pattern: /\b(?:where was he born|hometown|home\s*town|where (?:is|was|does) he (?:from|come from)|birth place|birthplace)\b/i,
    build: profile => {
      const place = hailsFrom(profile)
      if (!place) return null
      const dob = dateOfBirthOf(profile)
      return {
        parts: [
          dob
            ? `He was born on ${formatLongDate(dob)}, and he hails from ${place}.`
            : `He hails from ${place}.`,
        ],
        citations: [biographyCitation(profile)],
      }
    },
  },
  {
    topic: 'birth',
    pattern: /\b(?:parents?|mother|father)\b/i,
    build: profile => {
      const parents = parentsOf(profile)
      if (!parents) return null
      return {
        parts: [
          `His parents are ${parents.names[0]} and ${parents.names[1]}${parents.note ? ` — both ${parents.note}` : ''}.`,
        ],
        citations: [biographyCitation(profile)],
      }
    },
  },
  {
    topic: 'birth',
    pattern: /\b(?:siblings?|brothers?|sisters?|how many children(?:'s)? (?:did|were))\b/i,
    build: profile => {
      const rank = profile.biography.intro.match(/the\s+([a-zA-Z-]+)\s+of\s+([a-zA-Z-]+)\s+children/)
      if (!rank) return null
      return {
        parts: [`He is the ${rank[1]} of ${rank[2]} children in his parents' household.`],
        citations: [biographyCitation(profile)],
      }
    },
  },
  {
    topic: 'birth',
    pattern: /\b(?:ethnic\w*|tribe|dagaaba)\b/i,
    build: profile => {
      const group = profile.biography.intro.match(/member of the ([A-Za-z]+) ethnic group/)?.[1]
      const place = hailsFrom(profile)
      if (!group && !place) return null
      return {
        parts: [
          `${group ? `He is ${group}${place ? `, and he hails from ${place}` : ''}.` : `He hails from ${place}.`}`,
        ],
        citations: [biographyCitation(profile)],
      }
    },
  },
  {
    topic: 'overview',
    pattern: /\b(?:full name|real name|what(?:'s| is) his name|his name)\b/i,
    build: profile => {
      if (!profile.hero.name) return null
      return {
        parts: [`His full name is ${profile.hero.name}.`],
        citations: [
          citation('profile', 'Biography', 'profile', 'The Man', 'The life of a servant-leader', '/the-man', profile.biography.intro || null),
        ],
      }
    },
  },
  {
    topic: 'personal',
    pattern: /\b(?:wife|spouse|married(?: to)?|marriage)\b/i,
    build: profile => {
      const sentence = sentenceFromCard(profile, 'Personal life', /marri|wife|spouse/i)
      if (!sentence) return null
      return {
        parts: [sentence.startsWith('He ') ? sentence : `He is ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`],
        citations: [
          citation('profile', 'Biography', 'profile', 'The Man', 'Personal Life', '/#profile', sentence),
        ],
      }
    },
  },
  {
    topic: 'personal',
    pattern: /\b(?:religion|religious|faith|christian\w*|catholic|muslim|worship)\b/i,
    build: profile => {
      const sentence = sentenceFromCard(profile, 'Personal life', /christian|catholic|religio|faith|worship/i)
      if (!sentence) return null
      return {
        parts: [sentence.startsWith('He ') ? sentence : `He is ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`],
        citations: [
          citation('profile', 'Biography', 'profile', 'The Man', 'Personal Life', '/#profile', sentence),
        ],
      }
    },
  },
  {
    topic: 'personal',
    pattern: /\b(?:children|kids|sons?|daughters?)\b/i,
    build: profile => ({
      parts: ['The published biography does not record whether he has children.'],
      citations: [
        citation('profile', 'Biography', 'profile', 'The Man', 'Personal Life', '/#profile', profile.biography.intro || null),
      ],
    }),
  },
  {
    topic: 'political',
    pattern: /\b(?:party|ndc|political affiliation)\b/i,
    build: profile => {
      const party = profile.subject.party?.split(',')[0]?.trim()
      if (!party) return null
      return {
        parts: [`He is documented as a member of the ${party}.`],
        citations: [
          citation('research', 'Public record', 'research', 'Speaker record', 'The Speaker’s sourced public record', '/speaker-record', null),
        ],
      }
    },
  },
  {
    topic: 'political',
    pattern: /\bconstituency\b/i,
    build: profile => {
      const constituency = profile.subject.constituency?.split(',')[0]?.trim()
      if (!constituency) return null
      return {
        parts: [`His constituency is recorded as ${constituency}.`],
        citations: [
          citation('research', 'Public record', 'research', 'Speaker record', 'The Speaker’s sourced public record', '/speaker-record', null),
        ],
      }
    },
  },
  {
    topic: 'speakership',
    pattern: /\b(?:when did he become speaker|how long(?: has he)? been speaker|speaker since|current (?:role|position|post)|what (?:is|does) (?:his|he) (?:current |present )?(?:role|position|office|job|serve))\b/i,
    build: profile => {
      const role = profile.subject.role
      if (!role) return null
      const start = parseLooseDate(profile.subject.roleStart ?? '')
      return {
        parts: [
          `He currently serves as ${role}${start ? ` — in the role since ${formatLongDate(start)}` : '.'}`,
        ],
        citations: [publicRecordCitation()],
      }
    },
  },
  {
    topic: 'birth',
    pattern: /\bwhere does he (?:live|reside)\b|where is he now|his residence\b/i,
    build: () => ({
      parts: ['The published biography does not record where he currently lives.'],
      citations: [
        citation('profile', 'Biography', 'profile', 'The Man', 'Personal Life', '/#profile', null),
      ],
    }),
  },
  {
    topic: 'education',
    pattern:
      /\b(?:which|what) (?:secondary )?schools?(?: did he attend| did he go to)?\b|where did he (?:go to|attend) (?:his )?(?:secondary )?school/i,
    build: profile => {
      const schools = card(profile, 'Education').match(
        /Attended ([A-Za-z]+ Secondary School(?: and [A-Za-z]+ Secondary School)?)/,
      )?.[1]
      if (!schools) return null
      return {
        parts: [`He attended ${schools}.`],
        citations: [educationCitation(profile)],
      }
    },
  },
  {
    topic: 'education',
    pattern: /\bgimpa\b|\bexecutive masters?\b|\bmasters?\b/i,
    build: profile => {
      const match = card(profile, 'Education').match(
        /completed(?: an| a) ((?:Executive )?Master(?:’|')?s(?: in [^,;.]*?)?) at GIMPA/,
      )
      if (!match) return null
      return {
        parts: [`He later completed an ${match[1].trim()} at GIMPA.`],
        citations: [educationCitation(profile)],
      }
    },
  },
  {
    topic: 'education',
    pattern:
      /\buniversit(?:y|ies)\b|\bdegree\b|\bwhat did he stud(?:y|ied|ies)\b|\bwhat did he read\b|\bfield of study\b/i,
    build: profile => {
      const education = card(profile, 'Education')
      const match = education.match(
        /(?:Earned|Holds)\s+a\s+([^.()]*?)\s+at\s+the\s+University of Ghana(?:\s*\((\d{4})\))?/,
      )
      if (!match) return null
      const degree = match[1].trim()
      return {
        parts: [
          `He earned ${degree.startsWith('a ') ? degree : `a ${degree}`} at the University of Ghana${match[2] ? ` in ${match[2]}` : ''}.`,
        ],
        citations: [educationCitation(profile)],
      }
    },
  },
  {
    topic: 'education',
    pattern: /\blaw school\b|\bghana school of law\b|where did he (?:train|stud(?:y|ied)) law/i,
    build: profile => {
      const education = card(profile, 'Education')
      const city = education.match(/Ghana School of Law(?:\s+in\s+([A-Za-z]+))?/)?.[1]?.trim() ?? null
      if (!/Ghana School of Law/i.test(education)) return null
      return {
        parts: [`He trained at the Ghana School of Law${city ? ` in ${city}` : ''}.`],
        citations: [educationCitation(profile)],
      }
    },
  },
  {
    topic: 'education',
    pattern: /\bcalled to the bar\b|when was he called\b|admitted to the bar\b/i,
    build: profile => {
      const year = barYearOf(profile)
      if (!year) return null
      return {
        parts: [`He was called to the bar in ${year}.`],
        citations: [educationCitation(profile)],
      }
    },
  },
  {
    topic: 'career',
    pattern:
      /\bwhen did he (?:become|qualify as) a lawyer\b|when was he called\b|\bcall to the bar\b|\bbar\b/i,
    build: profile => {
      const year = barYearOf(profile)
      if (!year) return null
      return {
        parts: [`He was called to the bar in ${year}.`],
        citations: [careerCitation(profile)],
      }
    },
  },
  {
    topic: 'career',
    pattern:
      /\bwhat does he do\b|for a living\b|\bis he a lawyer\b|his job\b|his profession\b/i,
    build: profile => {
      const year = barYearOf(profile)
      const profession = profile.subject.role
        ? `He currently serves as ${profile.subject.role}${
            year ? `, and he is a lawyer by profession — called to the bar in ${year}` : ''
          }.`
        : `He is a lawyer by profession${year ? ` — called to the bar in ${year}` : ''}.`
      return {
        parts: [profession],
        citations: [careerCitation(profile), publicRecordCitation()],
      }
    },
  },
  {
    topic: 'career',
    pattern: /\bchambers?\b|\blaw firms?\b|\bakyem\b|\blaw trust\b|where (?:did|does) he pract\w*/i,
    build: profile => {
      const sentence = sentenceFromCard(profile, 'Career', /Akyem Chambers|Law Trust/)
      if (!sentence) return null
      return {
        parts: [`His career: ${sentence}`],
        citations: [careerCitation(profile)],
      }
    },
  },
  {
    topic: 'career',
    pattern:
      /\b(?:tripoli|libya|statistical service|state hotels|before politics|earlier career|previous jobs?|other jobs?|past jobs?|first jobs?|early career)\b/i,
    build: profile => {
      const sentence = sentenceFromCard(profile, 'Career', /Tripoli|Libya|Statistical Service|State Hotels|teacher/)
      if (!sentence) return null
      return {
        parts: [`His career before Parliament: ${sentence}`],
        citations: [careerCitation(profile)],
      }
    },
  },
  {
    topic: 'political',
    pattern:
      /\bwhen (?:was he (?:first )?elected|did he (?:first )?(?:enter|join|become)(?: parliament| an? mp)?)\b|\bdid he win (?:his )?(?:parliamentary )?seat\b|how did he (?:enter|get into) parliament\b/i,
    build: profile => {
      const entry = firstParliamentEntry(profile)
      if (!entry) return null
      const detail = entry.text?.trim() ? ` — ${decapitalize(entry.text.trim())}` : ''
      return {
        parts: [`He first entered Parliament in ${entry.year}${detail}`],
        citations: [lifeTimelineCitation(profile), publicRecordCitation()],
      }
    },
  },
  {
    topic: 'political',
    pattern: /\bhow many (?:times|terms|mandates)\b|\bhow many elections? did he win\b/i,
    build: profile => {
      const n = electionCount(profile)
      if (!n) return null
      return {
        parts: [`He has been elected to Parliament ${numberWord(n)} times.`],
        citations: [publicRecordCitation()],
      }
    },
  },
  {
    topic: 'political',
    pattern: /\bhow long\b.{0,20}\b(?:in parliament|an? mp|member of parliament)\b|\bhow many years (?:in|of) parliament\b/i,
    build: profile => {
      const entry = firstParliamentEntry(profile)
      if (!entry) return null
      const start = Number(entry.year)
      const years = new Date().getUTCFullYear() - start
      return {
        parts: [
          `He has sat in Parliament since ${entry.year}${Number.isFinite(years) && years > 0 ? ` — ${years} years now` : ''}.`,
        ],
        citations: [lifeTimelineCitation(profile), publicRecordCitation()],
      }
    },
  },
  {
    topic: 'speakership',
    pattern:
      /\bre-?elected\b|\bretained as speaker\b|\b9th parliament\b|\bsecond term as speaker\b|\bcome back\b|\breturn as speaker\b/i,
    build: profile => {
      const entries = profile.timeline.entries.filter(entry =>
        /re-?elected|9th parliament|retained/i.test(`${entry.title} ${entry.text}`),
      )
      // An MP re-election ("re-elected with 76.46% of valid votes") also matches
      // the words, so the Speakership entry wins whenever one exists.
      const entry =
        entries.find(entry => /speaker/i.test(`${entry.title} ${entry.text}`)) ?? entries[0]
      if (!entry) return null
      const detail = entry.text?.trim() ? ` — ${decapitalize(entry.text.trim())}` : ''
      return {
        parts: [`He was re-elected in ${entry.year}${detail}`],
        citations: [lifeTimelineCitation(profile), publicRecordCitation()],
      }
    },
  },
  {
    topic: 'speakership',
    pattern:
      /\bfirst (?:speaker\b.{0,40})?opposition\b|\bopposition speaker\b|chosen from the opposition/i,
    build: profile => {
      const match = profile.hero.description.match(/the first[^,;.]*opposition[^,;.]*history/)
      if (!match) return null
      return {
        parts: [`He is ${match[0].trim()}.`],
        citations: [lifeTimelineCitation(profile), publicRecordCitation()],
      }
    },
  },
  {
    topic: 'speakership',
    pattern:
      /\b(?:minister|deputy speaker|majority leader|minority leader)\b|\b(?:were|was|did he (?:serve|hold)).{0,40}\b(?:leadership|roles?|positions?|offices?)\b/i,
    build: profile => {
      const entries = profile.timeline.entries.filter(entry =>
        /\b(?:minister|deputy speaker|majority leader|minority leader)\b/i.test(`${entry.title} ${entry.text}`),
      )
      if (entries.length === 0) {
        return {
          parts: ['The stored chronology does not record a ministerial or House-leadership role for him.'],
          citations: [lifeTimelineCitation(profile)],
        }
      }
      return {
        parts: [
          `His parliamentary leadership roles: ${entries
            .map(entry => `${entry.year} — ${entry.title}: ${entry.text}`)
            .join(' ')}`,
        ],
        citations: [lifeTimelineCitation(profile), publicRecordCitation()],
      }
    },
  },
  {
    topic: 'international',
    pattern: /\b(?:ipu|cpa|apnac|commonwealth|unicef)\b/i,
    build: (profile, question) => {
      const keyword = (question.match(/\b(?:ipu|cpa|apnac|commonwealth|unicef)\b/i)?.[0] ?? '').toLowerCase()
      if (!keyword) return null
      const relevant = profile.events
        .filter(event =>
          new RegExp(`\\b${keyword}\\b`, 'i').test(`${event.type} ${event.description}`),
        )
        .reverse()
        .slice(0, 3)
      if (relevant.length === 0) return null
      return {
        parts: [
          relevant
            .map(event => `${monthYearOf(event.startDate)} — ${event.description.trim()}`)
            .join(' · '),
        ],
        citations: [publicRecordCitation()],
      }
    },
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
 *
 * When the caller passes the question, a narrow fact question ("what is his
 * age", "who is his wife") is answered with the single fact it asked for; any
 * question whose fact cannot be extracted from the stored text falls back to
 * the full topic answer below rather than to an empty reply.
 */
export function answerFromProfile(
  topic: KnowledgeTopic,
  profile: KnowledgeProfile,
  question?: string,
): AskResult {
  if (question?.trim()) {
    const fact = FACT_PATTERNS.filter(
      entry => entry.topic === topic && entry.pattern.test(question),
    )
      .map(entry => entry.build(profile, question))
      .find((answer): answer is FactAnswer => answer !== null)
    if (fact) return buildAnswer(topic, fact.parts, fact.citations)
  }

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
