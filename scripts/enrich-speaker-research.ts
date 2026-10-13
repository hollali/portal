import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { Prisma, PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

interface ResearchSourceRecord {
  record_id: string
  title: string
  original_url: string
  download_url: string | null
  publication_date: string | null
  sitting_date: string | null
  accessed_date: string
  document_type: string
  term_or_session: string | null
  persons: string[]
  locator: string | null
  summary: string
  relevance: string
  verification_status: string
  notes: string | null
}

interface ResearchEventRecord {
  event_id: string
  start_date?: string | null
  end_date?: string | null
  type?: string
  description?: string
  attribution?: string
  source_record_ids?: string[]
  news_record_ids?: number[]
  evidence_status?: string
  notes?: string | null
}

interface NewsUpdate {
  news_id: number
  expected_title_contains: string
  canonical_url: string
  title: string
  date: string | null
  source_name: string
  snippet: string
  notes_addition: string
}

interface EnrichmentData {
  enrichment_id: string
  dataset_id: string
  accessed_date: string
  coverage_after_enrichment: Record<string, unknown>
  source_records: ResearchSourceRecord[]
  source_updates: Array<{
    record_id: string
    title?: string
    document_type?: string
    publication_date: string | null
    sitting_date: string | null
    verification_status: string
    summary: string
    notes: string
  }>
  event_updates: ResearchEventRecord[]
  events: ResearchEventRecord[]
  news_updates: NewsUpdate[]
  database_change_summary: Record<string, unknown>
}

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error('DATABASE_URL is not configured')

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: DATABASE_URL }) })
const deltaFile = path.resolve(process.cwd(), 'ghana_speaker_enrichment.json')

function canonicalUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.hostname === 'www.bing.com' && url.pathname.includes('/news/apiclick.aspx')) {
      const target = url.searchParams.get('url')
      if (target) return canonicalUrl(target)
    }
    url.protocol = 'https:'
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    url.hash = ''
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|oc$|hl$|gl$|ceid$)/i.test(key)) url.searchParams.delete(key)
    }
    url.searchParams.sort()
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '')
    return url.toString()
  } catch {
    return value.trim()
  }
}

function mergeNotes(...values: Array<string | null | undefined>) {
  return [...new Set(values.map(value => value?.trim()).filter((value): value is string => Boolean(value)))].join('\n\n') || null
}

async function main() {
  const delta = JSON.parse(fs.readFileSync(deltaFile, 'utf8')) as EnrichmentData
  const dataset = await prisma.researchDataset.findUnique({ where: { id: delta.dataset_id }, select: { id: true, coverage: true } })
  if (!dataset) throw new Error(`Base research dataset ${delta.dataset_id} is not present; no enrichment was applied.`)

  const [sourcesBefore, eventsBefore, matchingNewsBefore, archiveMatches, milestoneMatches] = await Promise.all([
    prisma.researchSource.count({ where: { datasetId: delta.dataset_id } }),
    prisma.researchEvent.count({ where: { datasetId: delta.dataset_id } }),
    prisma.news.count({ where: { OR: [{ title: { contains: 'Bagbin', mode: 'insensitive' } }, { snippet: { contains: 'Bagbin', mode: 'insensitive' } }, { notes: { contains: 'Bagbin', mode: 'insensitive' } }] } }),
    prisma.archiveItem.count({ where: { OR: [{ title: { contains: 'Bagbin', mode: 'insensitive' } }, { excerpt: { contains: 'Bagbin', mode: 'insensitive' } }, { body: { contains: 'Bagbin', mode: 'insensitive' } }] } }),
    prisma.milestone.count({ where: { OR: [{ title: { contains: 'Bagbin', mode: 'insensitive' } }, { description: { contains: 'Bagbin', mode: 'insensitive' } }] } }),
  ])

  let newsRowsUpdated = 0
  for (const item of delta.news_updates) {
    const current = await prisma.news.findUnique({ where: { id: item.news_id } })
    if (!current) throw new Error(`Matched News row #${item.news_id} is missing; refusing to create a substitute.`)
    const titleMatches = current.title?.toLowerCase().includes(item.expected_title_contains.toLowerCase())
    const alreadyCanonical = current.url === item.canonical_url && current.title === item.title
    if (!titleMatches && !alreadyCanonical) {
      throw new Error(`Dedupe guard failed for News row #${item.news_id}; current title did not match the recorded match.`)
    }
    const collision = await prisma.news.findFirst({ where: { url: item.canonical_url, NOT: { id: item.news_id } }, select: { id: true } })
    if (collision) throw new Error(`Canonical URL for News #${item.news_id} already belongs to News #${collision.id}; no row was overwritten.`)
    const oldUrlNote = current.url && current.url !== item.canonical_url
      ? `Previous aggregator URL from matched row: ${current.url}`
      : null
    await prisma.news.update({
      where: { id: item.news_id },
      data: {
        title: item.title,
        url: item.canonical_url,
        sourceName: item.source_name,
        ...(item.date ? { date: item.date } : {}),
        snippet: item.snippet,
        notes: mergeNotes(current.notes, item.notes_addition, oldUrlNote),
      },
    })
    newsRowsUpdated++
  }

  for (const update of delta.source_updates) {
    await prisma.researchSource.update({
      where: { recordId: update.record_id },
      data: {
        ...(update.title ? { title: update.title } : {}),
        ...(update.document_type ? { documentType: update.document_type } : {}),
        publicationDate: update.publication_date,
        sittingDate: update.sitting_date,
        verificationStatus: update.verification_status,
        summary: update.summary,
        notes: update.notes,
      },
    })
  }

  const [knownSources, knownNews, knownArchive] = await Promise.all([
    prisma.researchSource.findMany({ select: { recordId: true, datasetId: true, originalUrl: true } }),
    prisma.news.findMany({ where: { url: { not: null } }, select: { id: true, url: true } }),
    prisma.archiveItem.findMany({ where: { sourceUrl: { not: null } }, select: { id: true, sourceUrl: true } }),
  ])
  const sourceUrlKeys = new Map<string, { kind: 'source'; id: string }>()
  const newsUrlKeys = new Map<string, number>()
  const archiveUrlKeys = new Map<string, number>()
  for (const row of knownSources) {
    const key = canonicalUrl(row.originalUrl)
    if (key) sourceUrlKeys.set(key, { kind: 'source', id: row.recordId })
  }
  for (const row of knownNews) {
    const key = canonicalUrl(row.url)
    if (key) newsUrlKeys.set(key, row.id)
  }
  for (const row of knownArchive) {
    const key = canonicalUrl(row.sourceUrl)
    if (key) archiveUrlKeys.set(key, row.id)
  }

  const sourceAliases = new Map<string, string>()
  const sourceNewsAliases = new Map<string, number>()
  let newSources = 0
  let sourceDuplicatesSkipped = 0
  for (const source of delta.source_records) {
    const key = canonicalUrl(source.original_url)
    const byId = await prisma.researchSource.findUnique({ where: { recordId: source.record_id }, select: { datasetId: true, originalUrl: true } })
    if (byId) {
      if (byId.datasetId !== delta.dataset_id || canonicalUrl(byId.originalUrl) !== key) {
        throw new Error(`Stable record ID ${source.record_id} conflicts with existing data; refused to overwrite.`)
      }
      continue
    }
    const sameSource = key ? sourceUrlKeys.get(key) : undefined
    if (sameSource) {
      sourceAliases.set(source.record_id, sameSource.id)
      sourceDuplicatesSkipped++
      continue
    }
    const sameNews = key ? newsUrlKeys.get(key) : undefined
    if (sameNews) {
      sourceNewsAliases.set(source.record_id, sameNews)
      sourceDuplicatesSkipped++
      continue
    }
    const sameArchive = key ? archiveUrlKeys.get(key) : undefined
    if (sameArchive) {
      throw new Error(`Source ${source.record_id} matches ArchiveItem #${sameArchive}; resolve that match before importing.`)
    }

    await prisma.researchSource.create({
      data: {
        recordId: source.record_id,
        datasetId: delta.dataset_id,
        title: source.title,
        originalUrl: source.original_url,
        downloadUrl: source.download_url,
        publicationDate: source.publication_date,
        sittingDate: source.sitting_date,
        accessedDate: source.accessed_date,
        documentType: source.document_type,
        termOrSession: source.term_or_session,
        persons: source.persons as Prisma.InputJsonValue,
        locator: source.locator,
        summary: source.summary,
        relevance: source.relevance,
        verificationStatus: source.verification_status,
        notes: source.notes,
      },
    })
    newSources++
    if (key) sourceUrlKeys.set(key, { kind: 'source', id: source.record_id })
  }

  const updates = new Map<string, ResearchEventRecord>()
  for (const event of [...delta.event_updates, ...delta.events]) updates.set(event.event_id, event)
  let newEvents = 0
  let refreshedEvents = 0
  for (const event of updates.values()) {
    const existing = await prisma.researchEvent.findUnique({ where: { eventId: event.event_id }, select: { datasetId: true } })
    if (existing && existing.datasetId !== delta.dataset_id) throw new Error(`Event ID ${event.event_id} belongs to another dataset.`)
    if (!existing && (!event.type || !event.description || !event.attribution || !event.evidence_status)) {
      throw new Error(`New event ${event.event_id} is missing required fields.`)
    }
    const update: Record<string, unknown> = {}
    if ('start_date' in event) update.startDate = event.start_date
    if ('end_date' in event) update.endDate = event.end_date
    if (event.type !== undefined) update.type = event.type
    if (event.description !== undefined) update.description = event.description
    if (event.attribution !== undefined) update.attribution = event.attribution
    if (event.evidence_status !== undefined) update.evidenceStatus = event.evidence_status
    if ('notes' in event) update.notes = event.notes

    if (existing) {
      await prisma.researchEvent.update({ where: { eventId: event.event_id }, data: update })
      refreshedEvents++
    } else {
      await prisma.researchEvent.create({
        data: {
          eventId: event.event_id,
          datasetId: delta.dataset_id,
          startDate: event.start_date ?? null,
          endDate: event.end_date ?? null,
          type: event.type!,
          description: event.description!,
          attribution: event.attribution!,
          evidenceStatus: event.evidence_status!,
          notes: event.notes ?? null,
        },
      })
      newEvents++
    }
  }

  const allEvents = [...updates.values()]
  const syncSourceLinks = allEvents.filter(event => Array.isArray(event.source_record_ids))
  const syncNewsLinks = allEvents.filter(event => Array.isArray(event.news_record_ids))
  for (const event of syncSourceLinks) await prisma.researchEventSource.deleteMany({ where: { eventId: event.event_id } })
  for (const event of syncNewsLinks) await prisma.researchEventNews.deleteMany({ where: { eventId: event.event_id } })

  const sourceLinks: Array<{ eventId: string; recordId: string }> = []
  const newsLinks: Array<{ eventId: string; newsId: number }> = []
  for (const event of allEvents) {
    for (const sourceId of event.source_record_ids ?? []) {
      const canonicalId = sourceAliases.get(sourceId) ?? sourceId
      if (sourceNewsAliases.has(sourceId)) newsLinks.push({ eventId: event.event_id, newsId: sourceNewsAliases.get(sourceId)! })
      else sourceLinks.push({ eventId: event.event_id, recordId: canonicalId })
    }
    for (const newsId of event.news_record_ids ?? []) newsLinks.push({ eventId: event.event_id, newsId })
  }

  const uniqueSourceLinks = [...new Map(sourceLinks.map(link => [`${link.eventId}\0${link.recordId}`, link])).values()]
  const uniqueNewsLinks = [...new Map(newsLinks.map(link => [`${link.eventId}\0${link.newsId}`, link])).values()]
  if (uniqueSourceLinks.length) await prisma.researchEventSource.createMany({ data: uniqueSourceLinks, skipDuplicates: true })
  if (uniqueNewsLinks.length) await prisma.researchEventNews.createMany({ data: uniqueNewsLinks, skipDuplicates: true })

  const [sourceCount, eventCount, sourceLinkCount, newsLinkCount, datasetRow] = await Promise.all([
    prisma.researchSource.count({ where: { datasetId: delta.dataset_id } }),
    prisma.researchEvent.count({ where: { datasetId: delta.dataset_id } }),
    prisma.researchEventSource.count({ where: { event: { datasetId: delta.dataset_id } } }),
    prisma.researchEventNews.count({ where: { event: { datasetId: delta.dataset_id } } }),
    prisma.researchDataset.findUnique({ where: { id: delta.dataset_id }, select: { coverage: true } }),
  ])
  const coverage = {
    ...((datasetRow?.coverage as Record<string, unknown> | undefined) ?? {}),
    ...delta.coverage_after_enrichment,
    unique_source_urls_catalogued: sourceCount,
    event_records: eventCount,
    event_source_links: sourceLinkCount,
    event_news_links: newsLinkCount,
    last_enrichment_id: delta.enrichment_id,
    last_enrichment_accessed_date: delta.accessed_date,
  }
  await prisma.researchDataset.update({ where: { id: delta.dataset_id }, data: { coverage: coverage as Prisma.InputJsonValue } })

  console.log(JSON.stringify({
    enrichment: delta.enrichment_id,
    sourceRecordsInserted: newSources,
    sourceRecordsMatchedAndSkipped: sourceDuplicatesSkipped,
    sourceRecordsUpdated: delta.source_updates.length,
    matchedNewsRowsUpdated: newsRowsUpdated,
    eventsInserted: newEvents,
    existingEventsUpdated: refreshedEvents,
    beforeImport: { sourceCount: sourcesBefore, eventCount: eventsBefore },
    currentDatabase: { sourceCount, eventCount, sourceLinkCount, newsLinkCount },
    dedupeCheck: { newsMatchesBefore: matchingNewsBefore, archiveMatches, milestoneMatches },
  }, null, 2))
}

main()
  .catch(error => {
    console.error('Speaker research enrichment failed:', error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
