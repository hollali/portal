import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { Prisma, PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'

interface SourceRecord {
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

interface EventRecord {
  event_id: string
  start_date: string | null
  end_date: string | null
  type: string
  description: string
  attribution: string
  source_record_ids: string[]
  evidence_status: string
  notes: string | null
}

interface ResearchData {
  dataset_id: string
  title: string
  accessed_date: string
  cutoff_date: string
  subject: Record<string, unknown>
  coverage: Record<string, unknown>
  sources: SourceRecord[]
  events: EventRecord[]
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is not configured')

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) })
const dataPath = path.resolve(process.cwd(), 'ghana_speaker_dataset.json')

async function main() {
  const research = JSON.parse(fs.readFileSync(dataPath, 'utf8')) as ResearchData

  await prisma.researchDataset.upsert({
    where: { id: research.dataset_id },
    create: {
      id: research.dataset_id,
      title: research.title,
      accessedDate: research.accessed_date,
      cutoffDate: research.cutoff_date,
      subject: research.subject as Prisma.InputJsonValue,
      coverage: research.coverage as Prisma.InputJsonValue,
    },
    update: {
      title: research.title,
      accessedDate: research.accessed_date,
      cutoffDate: research.cutoff_date,
      subject: research.subject as Prisma.InputJsonValue,
      coverage: research.coverage as Prisma.InputJsonValue,
    },
  })

  for (const source of research.sources) {
    await prisma.researchSource.upsert({
      where: { recordId: source.record_id },
      create: {
        recordId: source.record_id,
        datasetId: research.dataset_id,
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
      update: {
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
  }

  for (const event of research.events) {
    await prisma.researchEvent.upsert({
      where: { eventId: event.event_id },
      create: {
        eventId: event.event_id,
        datasetId: research.dataset_id,
        startDate: event.start_date,
        endDate: event.end_date,
        type: event.type,
        description: event.description,
        attribution: event.attribution,
        evidenceStatus: event.evidence_status,
        notes: event.notes,
      },
      update: {
        startDate: event.start_date,
        endDate: event.end_date,
        type: event.type,
        description: event.description,
        attribution: event.attribution,
        evidenceStatus: event.evidence_status,
        notes: event.notes,
      },
    })
  }

  const eventIds = research.events.map(event => event.event_id)
  await prisma.researchEventSource.deleteMany({ where: { eventId: { in: eventIds } } })
  const links = research.events.flatMap(event => event.source_record_ids.map(recordId => ({
    eventId: event.event_id,
    recordId,
  })))
  if (links.length) await prisma.researchEventSource.createMany({ data: links, skipDuplicates: true })

  const [sourceCount, eventCount, linkCount] = await Promise.all([
    prisma.researchSource.count({ where: { datasetId: research.dataset_id } }),
    prisma.researchEvent.count({ where: { datasetId: research.dataset_id } }),
    prisma.researchEventSource.count({ where: { eventId: { in: eventIds } } }),
  ])
  console.log(`Imported ${sourceCount} sources, ${eventCount} events, and ${linkCount} event-source links into ${research.dataset_id}.`)
}

main()
  .catch(error => {
    console.error('Speaker research import failed:', error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
