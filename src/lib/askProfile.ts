import { prisma } from '@/lib/prisma'
import { getSectionData } from '@/lib/libraryQueries'
import type {
  BiographyData,
  CoreThemesData,
  HeroData,
  InstitutionsData,
  ManPageData,
  RulingsData,
  TimelineData,
} from '@/lib/content'
import type { KnowledgeEvent, KnowledgeProfile } from '@/lib/askKnowledge'

export const SPEAKER_DATASET_ID = 'GH-PARL-SPEAKER-BAGBIN-2026-10-13'

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/**
 * Load every person-facing row the chatbot is allowed to answer from.
 *
 * The CMS sections already fall back to the compiled-in biography when a row is
 * missing, so this works on a freshly seeded database as well as a fully edited
 * one. Milestones, testimonials, research and the identity subject are read
 * directly from their tables rather than copied into a second knowledge store.
 */
export async function loadKnowledgeProfile(): Promise<KnowledgeProfile> {
  const [hero, biography, timeline, man, rulings, themes, institutions, dataset, milestones, testimonials, events, researchSourceCount] =
    await Promise.all([
      getSectionData<HeroData>('home_hero'),
      getSectionData<BiographyData>('home_biography'),
      getSectionData<TimelineData>('home_timeline'),
      getSectionData<ManPageData>('the_man'),
      getSectionData<RulingsData>('parliament_rulings'),
      getSectionData<CoreThemesData>('core_themes'),
      getSectionData<InstitutionsData>('home_institutions'),
      prisma.researchDataset.findUnique({
        where: { id: SPEAKER_DATASET_ID },
        select: { subject: true },
      }),
      prisma.milestone.findMany({
        where: { status: 'published' },
        orderBy: [{ year: 'asc' }, { order: 'asc' }],
        select: { year: true, title: true, description: true, category: true },
      }),
      prisma.testimonial.findMany({
        where: { status: 'published' },
        orderBy: [{ sortOrder: 'asc' }],
        select: { author: true, role: true, quote: true, year: true },
      }),
      prisma.researchEvent.findMany({
        orderBy: [{ startDate: 'asc' }],
        select: { startDate: true, type: true, description: true, attribution: true },
      }),
      prisma.researchSource.count({ where: { datasetId: SPEAKER_DATASET_ID } }),
    ])

  const subject = (dataset?.subject && typeof dataset.subject === 'object'
    ? dataset.subject
    : {}) as Record<string, unknown>

  return {
    hero,
    biography,
    timeline,
    man,
    rulings,
    themes: themes.items,
    institutions: institutions.items,
    subject: {
      party: str(subject.party_affiliation_documented),
      constituency: str(subject.constituency_documented),
      role: str(subject.current_role),
      roleStart: str(subject.role_start_date),
    },
    milestones,
    testimonials,
    events: events as KnowledgeEvent[],
    researchSourceCount,
    researchEventCount: events.length,
  }
}
