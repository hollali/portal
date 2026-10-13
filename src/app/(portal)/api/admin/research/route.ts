import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth'
import { Prisma } from '@/generated/prisma/client'

const DATASET_ID = 'GH-PARL-SPEAKER-BAGBIN-2026-10-13'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalText(value: unknown): string | null {
  return text(value) || null
}

function authorizationError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  return NextResponse.json(
    { error: message === 'Unauthorized' ? 'Sign in to manage research records.' : 'You do not have permission to manage research records.' },
    { status: message === 'Unauthorized' ? 401 : 403 },
  )
}

export async function GET() {
  try {
    await requireRole('admin', 'editor')
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const [dataset, newsCandidates] = await Promise.all([
      prisma.researchDataset.findUnique({
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
                      downloadUrl: true,
                      verificationStatus: true,
                    },
                  },
                },
              },
              newsLinks: {
                include: {
                  news: { select: { id: true, title: true, url: true, date: true, sourceName: true } },
                },
              },
            },
          },
        },
      }),
      prisma.news.findMany({
        where: {
          OR: [
            { title: { contains: 'Bagbin', mode: 'insensitive' } },
            { title: { contains: 'Alban', mode: 'insensitive' } },
            { snippet: { contains: 'Bagbin', mode: 'insensitive' } },
            { notes: { contains: 'Bagbin', mode: 'insensitive' } },
          ],
        },
        select: { id: true, title: true, url: true, date: true, sourceName: true },
        orderBy: { id: 'desc' },
        take: 200,
      }),
    ])

    if (!dataset) return NextResponse.json({ error: 'Research dataset not found' }, { status: 404 })
    return NextResponse.json({ dataset: { ...dataset, newsCandidates } })
  } catch (error) {
    console.error('Failed to load Speaker research dataset:', error)
    return NextResponse.json({ error: 'The database could not load the Speaker research dataset.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    await requireRole('admin', 'editor')
  } catch (error) {
    return authorizationError(error)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const action = text(body.action)
  const mode = text(body.mode)
  const recordType = text(body.recordType)
  const recordId = text(body.recordId)

  if (action === 'delete') {
    if (!recordId || !['source', 'event'].includes(recordType)) {
      return NextResponse.json({ error: 'Choose a valid source or event to delete.' }, { status: 400 })
    }
    try {
      const where = recordType === 'source'
        ? { recordId, datasetId: DATASET_ID }
        : { eventId: recordId, datasetId: DATASET_ID }
      if (recordType === 'source') {
        const deleted = await prisma.researchSource.deleteMany({ where: where as { recordId: string; datasetId: string } })
        if (!deleted.count) return NextResponse.json({ error: 'That source record no longer exists.' }, { status: 404 })
      } else {
        const deleted = await prisma.researchEvent.deleteMany({ where: where as { eventId: string; datasetId: string } })
        if (!deleted.count) return NextResponse.json({ error: 'That timeline event no longer exists.' }, { status: 404 })
      }
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error('Failed to delete Speaker research record:', error)
      return NextResponse.json({ error: 'Could not delete the research record.' }, { status: 500 })
    }
  }

  if (action !== 'upsert') return NextResponse.json({ error: 'Unsupported research action.' }, { status: 400 })
  if (!['create', 'update'].includes(mode)) return NextResponse.json({ error: 'Choose create or update mode.' }, { status: 400 })

  if (recordType === 'source') {
    const title = text(body.title)
    const originalUrl = text(body.originalUrl)
    const accessedDate = text(body.accessedDate)
    const documentType = text(body.documentType)
    const summary = text(body.summary)
    const relevance = text(body.relevance)
    const verificationStatus = text(body.verificationStatus)
    const recordKey = recordId || text(body.recordId)
    if (!recordKey || !title || !originalUrl || !accessedDate || !documentType || !summary || !relevance || !verificationStatus) {
      return NextResponse.json({ error: 'Complete all required source fields before saving.' }, { status: 400 })
    }
    try {
      const url = new URL(originalUrl)
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Invalid URL protocol')
    } catch {
      return NextResponse.json({ error: 'Enter a valid HTTP or HTTPS original source URL.' }, { status: 400 })
    }

    const rawPersons = Array.isArray(body.persons)
      ? body.persons
      : text(body.persons).split(/[\n,]/)
    const persons = rawPersons.map(value => text(value)).filter(Boolean)
    try {
      const existing = await prisma.researchSource.findUnique({ where: { recordId: recordKey }, select: { datasetId: true } })
      if (existing && existing.datasetId !== DATASET_ID) {
        return NextResponse.json({ error: 'That source ID belongs to a different research dataset.' }, { status: 409 })
      }
      if (mode === 'create' && existing) return NextResponse.json({ error: 'That source ID already exists. Choose another ID or edit the existing record.' }, { status: 409 })
      if (mode === 'update' && !existing) return NextResponse.json({ error: 'That source record no longer exists.' }, { status: 404 })
      await prisma.researchSource.upsert({
        where: { recordId: recordKey },
        create: {
          recordId: recordKey,
          datasetId: DATASET_ID,
          title,
          originalUrl,
          downloadUrl: optionalText(body.downloadUrl),
          publicationDate: optionalText(body.publicationDate),
          sittingDate: optionalText(body.sittingDate),
          accessedDate,
          documentType,
          termOrSession: optionalText(body.termOrSession),
          persons,
          locator: optionalText(body.locator),
          summary,
          relevance,
          verificationStatus,
          notes: optionalText(body.notes),
        },
        update: {
          title,
          originalUrl,
          downloadUrl: optionalText(body.downloadUrl),
          publicationDate: optionalText(body.publicationDate),
          sittingDate: optionalText(body.sittingDate),
          accessedDate,
          documentType,
          termOrSession: optionalText(body.termOrSession),
          persons,
          locator: optionalText(body.locator),
          summary,
          relevance,
          verificationStatus,
          notes: optionalText(body.notes),
        },
      })
      return NextResponse.json({ success: true, recordId: recordKey })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return NextResponse.json({ error: 'Another source record already uses this original URL.' }, { status: 409 })
      }
      console.error('Failed to save Speaker research source:', error)
      return NextResponse.json({ error: 'Could not save the source record.' }, { status: 500 })
    }
  }

  if (recordType === 'event') {
    const eventKey = recordId || text(body.eventId)
    const type = text(body.type)
    const description = text(body.description)
    const attribution = text(body.attribution)
    const evidenceStatus = text(body.evidenceStatus)
    if (!eventKey || !type || !description || !attribution || !evidenceStatus) {
      return NextResponse.json({ error: 'Complete all required timeline event fields before saving.' }, { status: 400 })
    }
    const sourceRecordIds = Array.isArray(body.sourceRecordIds)
      ? [...new Set(body.sourceRecordIds.map(value => text(value)).filter(Boolean))]
      : []
    const newsIds = Array.isArray(body.newsIds)
      ? [...new Set(body.newsIds.map(value => Number(value)).filter(value => Number.isSafeInteger(value) && value > 0))]
      : []
    try {
      const existing = await prisma.researchEvent.findUnique({ where: { eventId: eventKey }, select: { datasetId: true } })
      if (existing && existing.datasetId !== DATASET_ID) {
        return NextResponse.json({ error: 'That event ID belongs to a different research dataset.' }, { status: 409 })
      }
      if (mode === 'create' && existing) return NextResponse.json({ error: 'That event ID already exists. Choose another ID or edit the existing event.' }, { status: 409 })
      if (mode === 'update' && !existing) return NextResponse.json({ error: 'That timeline event no longer exists.' }, { status: 404 })
      const linkedSources = sourceRecordIds.length
        ? await prisma.researchSource.findMany({
            where: { datasetId: DATASET_ID, recordId: { in: sourceRecordIds } },
            select: { recordId: true },
          })
        : []
      if (linkedSources.length !== sourceRecordIds.length) {
        return NextResponse.json({ error: 'One or more linked source IDs do not exist in this dataset.' }, { status: 400 })
      }
      const linkedNews = newsIds.length
        ? await prisma.news.findMany({ where: { id: { in: newsIds } }, select: { id: true } })
        : []
      if (linkedNews.length !== newsIds.length) {
        return NextResponse.json({ error: 'One or more linked News record IDs do not exist.' }, { status: 400 })
      }

      await prisma.$transaction(async transaction => {
        await transaction.researchEvent.upsert({
          where: { eventId: eventKey },
          create: {
            eventId: eventKey,
            datasetId: DATASET_ID,
            startDate: optionalText(body.startDate),
            endDate: optionalText(body.endDate),
            type,
            description,
            attribution,
            evidenceStatus,
            notes: optionalText(body.notes),
          },
          update: {
            startDate: optionalText(body.startDate),
            endDate: optionalText(body.endDate),
            type,
            description,
            attribution,
            evidenceStatus,
            notes: optionalText(body.notes),
          },
        })
        await transaction.researchEventSource.deleteMany({ where: { eventId: eventKey } })
        if (sourceRecordIds.length) {
          await transaction.researchEventSource.createMany({
            data: sourceRecordIds.map(sourceId => ({ eventId: eventKey, recordId: sourceId })),
          })
        }
        await transaction.researchEventNews.deleteMany({ where: { eventId: eventKey } })
        if (newsIds.length) {
          await transaction.researchEventNews.createMany({
            data: newsIds.map(newsId => ({ eventId: eventKey, newsId })),
          })
        }
      })
      return NextResponse.json({ success: true, eventId: eventKey })
    } catch (error) {
      console.error('Failed to save Speaker research event:', error)
      return NextResponse.json({ error: 'Could not save the timeline event.' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Choose a valid source or event record type.' }, { status: 400 })
}
