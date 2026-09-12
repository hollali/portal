export type ArchiveKind = 'speech' | 'paper' | 'interview' | 'note' | 'letter' | 'memo'

export const DOCUMENT_KINDS: ArchiveKind[] = ['speech', 'paper', 'interview', 'note', 'letter', 'memo']

export interface KindConfig {
  label: string
  plural: string
  description: string
  icon: string
}

export const KIND_CONFIG: Record<ArchiveKind, KindConfig> = {
  speech: {
    label: 'Speech',
    plural: 'Speeches',
    description: 'Written speeches and statements delivered on the floor of Parliament, at national events and at international fora.',
    icon: 'mic',
  },
  paper: {
    label: 'Public Paper',
    plural: 'Public Papers',
    description: 'Public papers, policy essays and presentations contributed by Rt. Hon. Bagbin to national and international discussions.',
    icon: 'file-text',
  },
  interview: {
    label: 'Interview',
    plural: 'Interviews',
    description: 'Interviews and press engagements in which the Speaker speaks directly to the issues of the day.',
    icon: 'messages',
  },
  note: {
    label: 'Note',
    plural: 'Notes & Correspondence',
    description: 'Memos, letters and official correspondence — including notices recalling Parliament — written on key national issues.',
    icon: 'scroll',
  },
  letter: {
    label: 'Letter',
    plural: 'Letters',
    description: 'Letters written on key national issues, including to the President and the leadership of the nation.',
    icon: 'mail',
  },
  memo: {
    label: 'Memorandum',
    plural: 'Memos',
    description: 'Memoranda and internal notes on constitutional and parliamentary matters.',
    icon: 'clipboard',
  },
}

export type ListRouteKind = 'speeches' | 'papers' | 'interviews' | 'notes'

export const LIST_ROUTE_KINDS: Record<ListRouteKind, ArchiveKind[]> = {
  speeches: ['speech'],
  papers: ['paper'],
  interviews: ['interview'],
  notes: ['note', 'letter', 'memo'],
}

export const FACET_FIELDS = ['year', 'event', 'location', 'person', 'institution', 'parliament', 'theme'] as const
export type FacetField = (typeof FACET_FIELDS)[number]

export const FACET_LABELS: Record<FacetField, string> = {
  year: 'Year',
  event: 'Event',
  location: 'Location',
  person: 'Person',
  institution: 'Institution',
  parliament: 'Parliament',
  theme: 'Theme',
}

export const PHOTO_FACET_FIELDS: { key: string; label: string }[] = [
  { key: 'year', label: 'Year' },
  { key: 'event', label: 'Event' },
  { key: 'location', label: 'Location' },
  { key: 'person', label: 'Person' },
  { key: 'institution', label: 'Institution' },
  { key: 'parliament', label: 'Parliament' },
  { key: 'theme', label: 'Theme' },
]


export function themeSlugFromLabel(label: string | null | undefined): string | null {
  if (!label) return null
  const key = label.trim().toLowerCase()
  if (THEME_LABEL_TO_SLUG[key]) return THEME_LABEL_TO_SLUG[key]
  const match = CORE_THEMES.find(t => t.name.toLowerCase() === key)
  return match ? match.slug : null
}

export function buildSlug(title: string, id?: number): string {
  const base = normalizeSlug(title)
  return id ? `${base}-${id}` : base
}

export function formatYear(year: number | null | undefined): string {
  return year ? String(year) : '—'
}

export interface CoreTheme {
  slug: string
  name: string
  motto: string
  description: string
}

export const CORE_THEMES: CoreTheme[] = [
  {
    slug: 'parliamentary-independence',
    name: 'Parliamentary Independence',
    motto: 'A House that answers only to the people',
    description: 'The separation-of-powers doctrine, independent funding for the legislature, and the Speaker’s defence of the House as a separate and equal arm of government.',
  },
  {
    slug: 'constitutional-democracy',
    name: 'Constitutional Democracy',
    motto: 'The Constitution is supreme',
    description: 'Free and fair elections, the rule of law, and the supremacy of the Constitution over every institution — including the House itself.',
  },
  {
    slug: 'poverty-reduction',
    name: 'Poverty Reduction',
    motto: 'Development must reach the community',
    description: 'Strategies that match national ambition with community-level implementation, accountability and the realities of rural Ghana.',
  },
  {
    slug: 'national-development',
    name: 'National Development',
    motto: 'The people’s agenda comes first',
    description: 'Development rooted in rural communities — health, education, water, housing and opportunity for the least advantaged citizen.',
  },
  {
    slug: 'governance-technology',
    name: 'Governance & Technology',
    motto: 'A wider door, not a different key',
    description: 'How digital tools can bring the citizen closer to the law-making process without eroding parliamentary procedure.',
  },
  {
    slug: 'national-security',
    name: 'National Security',
    motto: 'Two arms, one Constitution',
    description: 'The constitutional dialogue between the Executive and the Legislature on the security of the republic.',
  },
  {
    slug: 'constituency-boundaries',
    name: 'Constituency Boundaries',
    motto: 'Fair representation for every citizen',
    description: 'Bagbin’s long campaign against gerrymandering and for population-based, transparent delimitation of constituencies.',
  },
  {
    slug: 'economic-development',
    name: 'Economic Development & Energy',
    motto: 'Opportunity for the least advantaged',
    description: 'Energy policy, e-government, capital-market choices and economic governance that serve Ghana’s development agenda.',
  },
  {
    slug: 'integrity-anti-corruption',
    name: 'Integrity & Anti-Corruption',
    motto: 'Accountability in public life',
    description: 'The fight against corruption, the defence of the public purse and the integrity of public institutions.',
  },
  {
    slug: 'pan-africanism',
    name: 'Pan-Africanism & the Global South',
    motto: 'Ghana, Africa and the world',
    description: 'Ghana’s voice in Africa, the Commonwealth and the wider Global South through a career of public engagement.',
  },
  {
    slug: 'education-youth',
    name: 'Education & the Youth',
    motto: 'The next generation of leaders',
    description: 'Education as the foundation of opportunity — from his own path through Wa, Tamale and Legon to national policy.',
  },
  {
    slug: 'health-social-protection',
    name: 'Health & Social Protection',
    motto: 'Health care for every citizen',
    description: 'Health coverage, insurance and social protection as pillars of a fair society.',
  },
  {
    slug: 'chieftaincy-culture',
    name: 'Chieftaincy & Culture',
    motto: 'The dignity of tradition',
    description: 'The place of chieftaincy, custom and Ghanaian tradition in the public life of the state.',
  },
]

export const THEME_LABEL_TO_SLUG: Record<string, string> = {
  'parliamentary independence': 'parliamentary-independence',
  'poverty reduction': 'poverty-reduction',
  'national development': 'national-development',
  'governance & technology': 'governance-technology',
  'national security': 'national-security',
  'constituency boundaries': 'constituency-boundaries',
  'gerrymandering': 'constituency-boundaries',
  'economic development': 'economic-development',
  'energy': 'economic-development',
  'anti-corruption': 'integrity-anti-corruption',
  'corruption': 'integrity-anti-corruption',
  'integrity': 'integrity-anti-corruption',
  'pan-africanism': 'pan-africanism',
  'education': 'education-youth',
  'youth': 'education-youth',
  'health': 'health-social-protection',
  'social protection': 'health-social-protection',
  'chieftaincy': 'chieftaincy-culture',
  'culture': 'chieftaincy-culture',
  'constitutional': 'constitutional-democracy',
  'democracy': 'constitutional-democracy',
}

export function resolveThemeSlug(label: string | null | undefined): string | null {
  if (!label) return null
  const key = label.trim().toLowerCase()
  if (THEME_LABEL_TO_SLUG[key]) return THEME_LABEL_TO_SLUG[key]
  const match = CORE_THEMES.find(t => t.name.toLowerCase() === key)
  return match ? match.slug : null
}

export type SourceType = 'unverified' | 'parliamentary-record' | 'official-document' | 'press' | 'publication' | 'family'

export const SOURCE_TYPES: SourceType[] = ['unverified', 'parliamentary-record', 'official-document', 'press', 'publication', 'family']

export const SOURCE_TYPE_META: Record<SourceType, { label: string; description: string }> = {
  'parliamentary-record': { label: 'Parliamentary record', description: 'Official proceedings of the Parliament of Ghana — Hansard, orders and notices.' },
  'official-document': { label: 'Official document', description: 'Official correspondence or a document from a public institution.' },
  'press': { label: 'Press', description: 'Published coverage in national or international media.' },
  'publication': { label: 'Publication', description: 'Published writing — books, journals or authored essays.' },
  'family': { label: 'Family & personal', description: 'Family-held or personal material shared with the archive.' },
  'unverified': { label: 'Unverified', description: 'Awaiting verification against an original source.' },
}

export function sourceTypeMeta(type: string | null | undefined): { label: string; description: string } {
  const key = (type || 'unverified') as SourceType
  return SOURCE_TYPE_META[key] || SOURCE_TYPE_META.unverified
}

export function normalizeSlug(title: string) {
  return title
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-') || 'untitled'
}
