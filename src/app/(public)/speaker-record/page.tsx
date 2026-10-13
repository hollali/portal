import type { Metadata } from 'next'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'
import SpeakerResearchExplorer, { type PublicEvent, type PublicSource } from '@/components/SpeakerResearchExplorer'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Speaker Record & Sources',
  description: 'A source-linked public record of Alban Sumana Kingsford Bagbin’s parliamentary career, public activities, and Speaker decisions.',
}

const DATASET_ID = 'GH-PARL-SPEAKER-BAGBIN-2026-10-13'

export default async function SpeakerRecordPage() {
  const dataset = await prisma.researchDataset.findUnique({
    where: { id: DATASET_ID },
    include: {
      sources: { orderBy: [{ publicationDate: 'desc' }, { recordId: 'asc' }] },
      events: {
        orderBy: [{ startDate: 'asc' }, { eventId: 'asc' }],
        include: {
          sourceLinks: {
            include: {
              source: {
                select: {
                  recordId: true,
                  title: true,
                  originalUrl: true,
                  verificationStatus: true,
                },
              },
            },
          },
          newsLinks: {
            include: {
              news: { select: { id: true, title: true, url: true, sourceName: true } },
            },
          },
        },
      },
    },
  })

  const sources: PublicSource[] = (dataset?.sources ?? []).map(source => ({
    recordId: source.recordId,
    title: source.title,
    originalUrl: source.originalUrl,
    downloadUrl: source.downloadUrl,
    publicationDate: source.publicationDate,
    sittingDate: source.sittingDate,
    accessedDate: source.accessedDate,
    documentType: source.documentType,
    termOrSession: source.termOrSession,
    persons: Array.isArray(source.persons) ? source.persons.filter((person): person is string => typeof person === 'string') : [],
    locator: source.locator,
    summary: source.summary,
    relevance: source.relevance,
    verificationStatus: source.verificationStatus,
    notes: source.notes,
  }))

  const events: PublicEvent[] = (dataset?.events ?? []).map(event => ({
    eventId: event.eventId,
    startDate: event.startDate,
    endDate: event.endDate,
    type: event.type,
    description: event.description,
    attribution: event.attribution,
    evidenceStatus: event.evidenceStatus,
    notes: event.notes,
    sourceLinks: event.sourceLinks.map(({ source }) => source),
    newsLinks: event.newsLinks.map(({ news }) => news),
  }))

  const coverage = dataset?.coverage as {
    pages_or_items_directly_inspected?: number
    additional_search_index_only_sources?: number
    scope_statement?: string
  } | undefined

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh' }}>
      <PublicHeader />
      <SpeakerResearchExplorer
        sources={sources}
        events={events}
        accessedDate={dataset?.accessedDate ?? 'Unknown'}
        cutoffDate={dataset?.cutoffDate ?? 'Unknown'}
        pagesInspected={coverage?.pages_or_items_directly_inspected ?? 0}
        indexOnlySources={coverage?.additional_search_index_only_sources ?? 0}
        scopeStatement={coverage?.scope_statement ?? 'Research coverage is being compiled.'}
      />
      <PublicFooter />
    </div>
  )
}
