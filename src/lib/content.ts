export type SectionKey =
  | 'home_hero'
  | 'home_biography'
  | 'home_timeline'
  | 'home_institutions'

export interface HeroFact {
  icon?: string
  value: string
  label: string
}

export interface HeroData {
  eyebrow: string
  name: string
  displayName: string
  description: string
  portraitUrl: string
  portraitAlt: string
  profileLabel: string
  profileValue: string
  facts: HeroFact[]
}

export interface BioCard {
  tag: string
  text: string
}

export interface BiographyData {
  heading: string
  intro: string
  cards: BioCard[]
}

export interface TimelineEntry {
  year: string
  title: string
  text: string
}

export interface TimelineData {
  heading: string
  subheading: string
  entries: TimelineEntry[]
}

export interface InstitutionsData {
  items: string[]
}

export type SectionData = HeroData | BiographyData | TimelineData | InstitutionsData

export const DEFAULT_HERO: HeroData = {
  eyebrow: 'Rt. Hon. · Speaker of the Parliament of Ghana',
  name: 'Alban Sumana',
  displayName: 'Kingsford Bagbin',
  description:
    'Ghanaian lawyer, statesman and legislator — elected Speaker of the 8th Parliament in 2021 as the first Speaker chosen from the opposition in Ghana’s history, and re-elected to preside over the 9th Parliament in 2025.',
  portraitUrl:
    'https://upload.wikimedia.org/wikipedia/commons/8/8b/Speaker_Alban_Bagbin-2_%28cropped%29.jpg',
  portraitAlt: 'Alban Bagbin in 2021',
  profileLabel: 'Incumbent since',
  profileValue: '7 January 2021',
  facts: [
    { icon: 'scale', value: '8th & 9th', label: 'Speaker of the Fourth Republic' },
    { icon: 'landmark', value: '7 terms', label: 'Member of Parliament' },
    { icon: 'graduation-cap', value: 'LL.B · Bar 1982', label: 'University of Ghana · Ghana School of Law' },
    { icon: 'sparkles', value: '24 Sep 1957', label: 'Born in Sombo, Upper West Region' },
  ],
}

export const DEFAULT_BIOGRAPHY: BiographyData = {
  heading: 'A legislator for\nseven parliaments.',
  intro:
    'Alban Sumana Kingsford Bagbin was born on 24 September 1957 to Sansunni Bagbin and Margaret B. Bagbin, both peasant farmers — the fourth of nine children. A member of the Dagaaba ethnic group, he hails from Sombo in the Upper West Region of Ghana.',
  cards: [
    {
      tag: 'Education',
      text: 'Attended Wa Secondary School and Tamale Secondary School. Earned a Bachelor of Arts in Law and English at the University of Ghana (1980), trained at the Ghana School of Law in Accra and was called to the bar in 1982. Later completed an Executive Master’s in Governance and Leadership at GIMPA.',
    },
    {
      tag: 'Career',
      text: 'Acting secretary to the Statistical Service Board (1980–82), personnel manager at the State Hotels Corporation (1982–83) and English teacher in Tripoli, Libya. Joined Akyem Chambers as an attorney on return to Ghana in 1986, rising to partner, and has been a partner at the Law Trust company since 1993.',
    },
    {
      tag: 'Personal life',
      text: 'Married to Alice Adjua Yornas Bagbin, a Programme Officer at the UNICEF Office in Ghana. He is a Christian and worships as a Roman Catholic.',
    },
  ],
}

export const DEFAULT_TIMELINE: TimelineData = {
  heading: 'Thirty years of\nparliamentary service.',
  subheading:
    'From constituency MP to the Speaker’s chair — the milestones of a career spanning every parliament of the Fourth Republic.',
  entries: [
    { year: '1992', title: 'Elected to Parliament', text: 'Won the Nadowli North seat in the 1992 general elections on the NDC ticket — the start of seven consecutive terms.' },
    { year: '1996', title: 'Retained Nadowli North', text: 'Re-elected with 76.46% of valid votes cast (12,605 of 16,485 votes).' },
    { year: '2001', title: 'Minority Leader', text: 'Served as Minority Leader in Parliament from 2001 to 2009.' },
    { year: '2009', title: 'Majority Leader', text: 'Appointed Majority Leader of the Ghanaian Parliament under President John Atta Mills.' },
    { year: '2010', title: 'Cabinet Minister', text: 'Appointed Minister for Water Resources, Works and Housing in January 2010.' },
    { year: '2012', title: 'Minister for Health', text: 'Served as Minister for Health from January 2012 until February 2013.' },
    { year: '2017', title: 'Second Deputy Speaker', text: 'Elected Second Deputy Speaker of Parliament (2017–2021).' },
    { year: '2021', title: 'Speaker of Parliament', text: 'Elected Speaker of the 8th Parliament — the first Speaker ever chosen from the opposition in Ghana’s history.' },
    { year: '2024', title: 'Vacant seats ruling', text: 'Declared four seats vacant over party-switching; the Supreme Court later overturned the decision.' },
    { year: '2025', title: 'Re-elected Speaker', text: 'Retained as Speaker of the 9th Parliament of the Fourth Republic on 7 January 2025.' },
  ],
}

export const DEFAULT_INSTITUTIONS: InstitutionsData = {
  items: [
    'Parliament of Ghana',
    'National Democratic Congress',
    'University of Ghana',
    'Ghana School of Law',
    'GIMPA',
    'UNICEF',
    '4th Republic',
    'Commonwealth',
  ],
}

export const DEFAULT_SECTIONS: Record<SectionKey, SectionData> = {
  home_hero: DEFAULT_HERO,
  home_biography: DEFAULT_BIOGRAPHY,
  home_timeline: DEFAULT_TIMELINE,
  home_institutions: DEFAULT_INSTITUTIONS,
}

export interface PubSection {
  key: string
  title: string | null
  body: string | null
  data: SectionData | null
}

export type SectionsMap = Partial<Record<SectionKey, PubSection>>

export function parseData<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return { ...fallback, ...JSON.parse(raw) } as T
  } catch {
    return fallback
  }
}

export function sectionData<T>(key: SectionKey, sections: SectionsMap | null | undefined, fallback: T): T {
  const section = sections?.[key]
  return parseData<T>(section?.data ? JSON.stringify(section.data) : null, fallback)
}

export function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled'
}