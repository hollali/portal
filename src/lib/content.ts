import type { ManSection } from '@/lib/man'
import { MAN_SECTIONS } from '@/lib/man'

export type SectionKey =
  | 'home_hero'
  | 'home_biography'
  | 'home_timeline'
  | 'home_institutions'
  | 'home_schools'
  | 'home_quotes'
  | 'the_man'
  | 'parliament_rulings'
  | 'hero_timeline'
  | 'hero_parliament'
  | 'hero_speaker_record'
  | 'hero_themes'
  | 'hero_ask'
  | 'hero_search'
  | 'hero_media'
  | 'hero_archives'
  | 'archive_collections'
  | 'core_themes'
  | 'media_cards'
  | 'media_socials'
  | 'site_footer'

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

/** Generic eyebrow + two-part display heading + lede used by page heroes. */
export interface PageHeroData {
  eyebrow: string
  titleA: string
  titleAccent: string
  lede: string
}

export interface ManPageData {
  heroTitleA: string
  heroTitleAccent: string
  heroIntro: string
  heroQuote: string
  sections: ManSection[]
}

export interface SchoolItem {
  name: string
  cap: string
}

export interface SchoolsData {
  items: SchoolItem[]
}

export interface QuotesData {
  items: string[]
}

export interface RulingItem {
  tag: string
  title: string
  note: string
}

export interface RulingsData {
  items: RulingItem[]
}

export interface CollectionItem {
  href: string
  label: string
  description: string
  /** Key into the live library counts (speeches, papers, …). Unknown values hide the count. */
  count: string
}

export interface CollectionsData {
  items: CollectionItem[]
}

export interface CoreThemeItem {
  slug: string
  name: string
  motto: string
  description: string
}

export interface CoreThemesData {
  items: CoreThemeItem[]
}

export interface MediaCardItem {
  href: string
  label: string
  note: string
}

export interface MediaCardsData {
  items: MediaCardItem[]
}

export interface SocialItem {
  label: string
  href: string
  handle: string
}

export interface MediaSocialsData {
  items: SocialItem[]
}

export interface FooterLink {
  label: string
  href: string
}

export interface FooterColumn {
  title: string
  links: FooterLink[]
}

export interface FooterData {
  tagline: string
  columns: FooterColumn[]
  social: FooterLink[]
}

export type SectionData =
  | HeroData
  | BiographyData
  | TimelineData
  | InstitutionsData
  | PageHeroData
  | ManPageData
  | SchoolsData
  | QuotesData
  | RulingsData
  | CollectionsData
  | CoreThemesData
  | MediaCardsData
  | MediaSocialsData
  | FooterData

export const DEFAULT_HERO: HeroData = {
  eyebrow: 'Rt. Hon. · Speaker of the Parliament of Ghana',
  name: 'Alban Sumana Kingsford Bagbin',
  displayName: 'Rt. Hon. Alban Bagbin',
  description:
    'Ghanaian lawyer, statesman and legislator — elected Speaker of the 8th Parliament in 2021 as the first Speaker chosen from the opposition in Ghana’s history, and re-elected to preside over the 9th Parliament in 2025.',
  portraitUrl: '/images/bagbin-speaker.jpg',
  portraitAlt: 'Alban Bagbin, Speaker of the Parliament of Ghana',
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

export const DEFAULT_MAN_PAGE: ManPageData = {
  heroTitleA: 'The life of a',
  heroTitleAccent: 'servant-leader',
  heroIntro:
    'Born in the fields of Sombo, schooled by dedication, called to the Bar, and returned to the people — four chapters trace the man behind the Speaker’s chair.',
  heroQuote:
    '“Born a fourth of nine children to peasant farmers, I know the meaning of hard work, of family and of the dignity of every Ghanaian.”',
  sections: MAN_SECTIONS,
}

export const DEFAULT_SCHOOLS: SchoolsData = {
  items: [
    { name: 'Wa Secondary School', cap: 'Senior secondary' },
    { name: 'Tamale Secondary School', cap: 'Senior secondary' },
    { name: 'University of Ghana', cap: 'BA Law & English · 1980' },
    { name: 'Ghana School of Law', cap: 'Called to the Bar · 1982' },
    { name: 'GIMPA', cap: 'Executive Master’s · Governance & Leadership' },
  ],
}

export const DEFAULT_QUOTES: QuotesData = {
  items: [
    'In Rt. Hon. Alban Bagbin, Ghana has a Speaker whose commitment to parliamentary independence and the rule of law speaks to the highest traditions of legislative service.',
    'Three decades in public life, and he has never stopped showing up — for the people of the Upper West first, and for Parliament as an institution always.',
    'His is a career built on the conviction that the chamber belongs to the people it serves — and the records are kept so the people can see it.',
  ],
}

export const DEFAULT_RULINGS: RulingsData = {
  items: [
    { tag: 'Independence', title: 'A Speaker for the whole House', note: 'As the 8th Parliament opened with an evenly-balanced House, the Speaker declared himself the servant of the entire membership — not any single caucus — and rebuilt the legitimacy of the Chair around that neutrality.' },
    { tag: 'Separation of powers', title: 'Funding without subservience', note: 'The push for an independently-funded legislature — one that can oversee the Executive without depending on it for its own budget — became a defining constitutional project of the Speakership.' },
    { tag: 'Constitutional power', title: 'Recalling the House', note: 'Recalled an adjourned Parliament under the provisions of Article 112(3) of the Constitution, a rarely-used power asserted to bring the House back for urgent national business.' },
    { tag: 'Even balance', title: 'The two-party floor', note: 'Steered an unprecedented statistical tie in the House — 137 to 137 — through rules and improvisation that safeguarded the authority of the Chamber while keeping government business moving.' },
  ],
}

export const DEFAULT_TIMELINE_HERO: PageHeroData = {
  eyebrow: 'The public life',
  titleA: 'A life in',
  titleAccent: 'service',
  lede: 'Follow Rt. Hon. Alban Bagbin’s journey from the Upper West Region to the Speaker’s chair, through the moments that shaped a life in public service.',
}

export const DEFAULT_PARLIAMENT_HERO: PageHeroData = {
  eyebrow: 'Parliament · The 8th House',
  titleA: 'A Parliament that',
  titleAccent: 'stands its ground',
  lede: 'From an evenly-balanced House to landmark rulings on the independence of the legislature — the parliamentary record of a Speaker who believed the House belongs to the people it serves.',
}

export const DEFAULT_SPEAKER_HERO: PageHeroData = {
  eyebrow: 'Parliament · Sourced public record',
  titleA: 'The Speaker’s',
  titleAccent: 'public record',
  lede: 'A source-linked chronology of Rt. Hon. Alban Sumana Kingsford Bagbin — every claim traceable to a Hansard, order paper, report, or archived publication. Start with the timeline, then inspect the documents behind it.',
}

export const DEFAULT_THEMES_HERO: PageHeroData = {
  eyebrow: 'The man · Ideas',
  titleA: 'Themes &',
  titleAccent: 'ideas',
  lede: 'The strands that run through a public career — from the independence of Parliament to poverty reduction and pan-Africanism. Browse each theme through the speeches, papers, interviews and correspondence that give it voice.',
}

export const DEFAULT_ASK_HERO: PageHeroData = {
  eyebrow: 'Archive research',
  titleA: 'Ask the',
  titleAccent: 'archive',
  lede: 'Search in plain language. Every answer links back to published records.',
}

export const DEFAULT_SEARCH_HERO: PageHeroData = {
  eyebrow: 'Search',
  titleA: 'Search',
  titleAccent: 'the library',
  lede: '',
}

export const DEFAULT_MEDIA_HERO: PageHeroData = {
  eyebrow: 'Media & Social',
  titleA: 'The moving record,',
  titleAccent: 'heard and seen',
  lede: 'Photographs, film, sound and the clippings of public conversation — gathered here so the legacy can be watched, listened to and read, not just listed.',
}

export const DEFAULT_ARCHIVES_HERO: PageHeroData = {
  eyebrow: 'Digital archives',
  titleA: 'The archive',
  titleAccent: 'collections',
  lede: 'Speeches, papers, interviews, correspondence, milestones, testimonials, photographs and press coverage — a growing record of the Speaker’s public life, in his own words and the words of others.',
}

export const DEFAULT_COLLECTIONS: CollectionsData = {
  items: [
    { href: '/archives/speeches', label: 'Speeches', description: 'Parliamentary and public addresses, in his own words.', count: 'speeches' },
    { href: '/archives/papers', label: 'Public Papers', description: 'Policy essays, presentations and public writings.', count: 'papers' },
    { href: '/archives/interviews', label: 'Interviews', description: 'Interviews and press engagements on the issues of the day.', count: 'interviews' },
    { href: '/archives/notes', label: 'Notes & Correspondence', description: 'Memos and letters on key national issues, including notices recalling Parliament.', count: 'notes' },
    { href: '/archives/milestones', label: 'Milestones', description: 'The landmark moments of a thirty-year public career.', count: 'milestones' },
    { href: '/archives/testimonials', label: 'Testimonials', description: 'What prominent figures in Ghana and the world have said of him.', count: 'testimonials' },
    { href: '/archives/photos', label: 'Photo Library', description: 'Historical and current photographs, curated by year, event and theme.', count: 'photos' },
    { href: '/news', label: 'News Clippings', description: 'Press coverage from across the Ghanaian and international media.', count: 'news' },
    { href: '/videos', label: 'Videos', description: 'Speeches, interviews and moments captured on camera.', count: 'videos' },
    { href: '/audio', label: 'Audio', description: 'Radio interviews and audio recordings.', count: 'audio' },
  ],
}

export const DEFAULT_CORE_THEMES: CoreThemesData = {
  items: [
    { slug: 'parliamentary-independence', name: 'Parliamentary Independence', motto: 'A House that answers only to the people', description: 'The separation-of-powers doctrine, independent funding for the legislature, and the Speaker’s defence of the House as a separate and equal arm of government.' },
    { slug: 'constitutional-democracy', name: 'Constitutional Democracy', motto: 'The Constitution is supreme', description: 'Free and fair elections, the rule of law, and the supremacy of the Constitution over every institution — including the House itself.' },
    { slug: 'poverty-reduction', name: 'Poverty Reduction', motto: 'Development must reach the community', description: 'Strategies that match national ambition with community-level implementation, accountability and the realities of rural Ghana.' },
    { slug: 'national-development', name: 'National Development', motto: 'The people’s agenda comes first', description: 'Development rooted in rural communities — health, education, water, housing and opportunity for the least advantaged citizen.' },
    { slug: 'governance-technology', name: 'Governance & Technology', motto: 'A wider door, not a different key', description: 'How digital tools can bring the citizen closer to the law-making process without eroding parliamentary procedure.' },
    { slug: 'national-security', name: 'National Security', motto: 'Two arms, one Constitution', description: 'The constitutional dialogue between the Executive and the Legislature on the security of the republic.' },
    { slug: 'constituency-boundaries', name: 'Constituency Boundaries', motto: 'Fair representation for every citizen', description: 'Bagbin’s long campaign against gerrymandering and for population-based, transparent delimitation of constituencies.' },
    { slug: 'economic-development', name: 'Economic Development & Energy', motto: 'Opportunity for the least advantaged', description: 'Energy policy, e-government, capital-market choices and economic governance that serve Ghana’s development agenda.' },
    { slug: 'integrity-anti-corruption', name: 'Integrity & Anti-Corruption', motto: 'Accountability in public life', description: 'The fight against corruption, the defence of the public purse and the integrity of public institutions.' },
    { slug: 'pan-africanism', name: 'Pan-Africanism & the Global South', motto: 'Ghana, Africa and the world', description: 'Ghana’s voice in Africa, the Commonwealth and the wider Global South through a career of public engagement.' },
  ],
}

export const DEFAULT_MEDIA_CARDS: MediaCardsData = {
  items: [
    { href: '/archives/photos', label: 'Photo Library', note: 'Official and historical photographs, curated by year, event and theme.' },
    { href: '/videos', label: 'Videos', note: 'Speeches, interviews and parliamentary moments captured on camera.' },
    { href: '/audio', label: 'Audio', note: 'Radio engagements, interviews and audio recordings.' },
    { href: '/news', label: 'News', note: 'Press clippings and coverage across Ghanaian and international media.' },
  ],
}

export const DEFAULT_MEDIA_SOCIALS: MediaSocialsData = {
  items: [
    { label: 'Facebook', href: 'https://www.facebook.com/askbagbin', handle: 'Alban Bagbin' },
    { label: 'X (Twitter)', href: 'https://twitter.com/askbagbin', handle: '@askbagbin' },
    { label: 'Instagram', href: 'https://www.instagram.com/askbagbin', handle: 'askbagbin' },
    { label: 'YouTube', href: 'https://www.youtube.com/@askbagbin', handle: 'Alban Bagbin' },
  ],
}

export const DEFAULT_FOOTER: FooterData = {
  tagline:
    'The digital library of Rt. Hon. Alban Sumana Kingsford Bagbin — Speaker of the Parliament of Ghana. Speeches, papers, correspondence, photographs and milestones from a thirty-year public career.',
  columns: [
    {
      title: 'The Man',
      links: [
        { label: 'Early Life', href: '/the-man#early-life' },
        { label: 'Education', href: '/the-man#education' },
        { label: 'Professional Life', href: '/the-man#professional-life' },
        { label: 'Personal Values', href: '/the-man#values' },
      ],
    },
    {
      title: 'Archives',
      links: [
        { label: 'Speeches', href: '/archives/speeches' },
        { label: 'Public Papers', href: '/archives/papers' },
        { label: 'Interviews', href: '/archives/interviews' },
        { label: 'Notes & Correspondence', href: '/archives/notes' },
        { label: 'Milestones', href: '/archives/milestones' },
        { label: 'Testimonials', href: '/archives/testimonials' },
        { label: 'Photo Library', href: '/archives/photos' },
      ],
    },
    {
      title: 'Explore',
      links: [
        { label: 'Timeline', href: '/timeline' },
        { label: 'Speaker record & sources', href: '/speaker-record' },
        { label: 'Videos', href: '/videos' },
        { label: 'Audio', href: '/audio' },
        { label: 'News Clippings', href: '/news' },
        { label: 'Search', href: '/search' },
      ],
    },
  ],
  social: [
    { label: 'Facebook', href: 'https://web.facebook.com/askbagbinofficial' },
    { label: 'X (Twitter)', href: 'https://twitter.com/askbagbin' },
    { label: 'Instagram', href: 'https://www.instagram.com/askbagbin' },
    { label: 'YouTube', href: 'https://www.youtube.com/@askbagbin' },
  ],
}

export const DEFAULT_SECTIONS: Record<SectionKey, SectionData> = {
  home_hero: DEFAULT_HERO,
  home_biography: DEFAULT_BIOGRAPHY,
  home_timeline: DEFAULT_TIMELINE,
  home_institutions: DEFAULT_INSTITUTIONS,
  home_schools: DEFAULT_SCHOOLS,
  home_quotes: DEFAULT_QUOTES,
  the_man: DEFAULT_MAN_PAGE,
  parliament_rulings: DEFAULT_RULINGS,
  hero_timeline: DEFAULT_TIMELINE_HERO,
  hero_parliament: DEFAULT_PARLIAMENT_HERO,
  hero_speaker_record: DEFAULT_SPEAKER_HERO,
  hero_themes: DEFAULT_THEMES_HERO,
  hero_ask: DEFAULT_ASK_HERO,
  hero_search: DEFAULT_SEARCH_HERO,
  hero_media: DEFAULT_MEDIA_HERO,
  hero_archives: DEFAULT_ARCHIVES_HERO,
  archive_collections: DEFAULT_COLLECTIONS,
  core_themes: DEFAULT_CORE_THEMES,
  media_cards: DEFAULT_MEDIA_CARDS,
  media_socials: DEFAULT_MEDIA_SOCIALS,
  site_footer: DEFAULT_FOOTER,
}

export interface PubSection {
  key: string
  title: string | null
  body: string | null
  data: SectionData | null
}

export type SectionsMap = Partial<Record<SectionKey, PubSection>>

export function parseData<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback
  if (typeof raw === 'object') return { ...fallback, ...(raw as Partial<T>) } as T
  if (typeof raw !== 'string') return fallback
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return { ...fallback, ...(parsed as Partial<T>) } as T
  } catch {
    return fallback
  }
  return fallback
}

export function sectionData<T>(key: SectionKey, sections: SectionsMap | null | undefined, fallback: T): T {
  return parseData<T>(sections?.[key]?.data ?? null, fallback)
}

export function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled'
}