import { prisma } from '@/lib/prisma'
import { getYouTubeNoCookieEmbedUrl, getYouTubeThumbUrl, isYouTubeUrl } from '@/lib/media'
import { resolveImageSrc, resolvePlayableMediaSrc } from '@/lib/mediaServer'
import {
  ASK_COLLECTION_LABELS,
  ASK_SUGGESTIONS,
  type AskCitation,
  type AskMedia,
  type AskPeriod,
  type AskResult,
} from '@/lib/askQuery'
import type { SearchCandidate } from '@/lib/askSearch'

type MediaCollection = 'photos' | 'videos' | 'audio'

const TAKE = 4

/**
 * The inline part of a search citation.
 *
 * A media row can be a useful answer without being playable: most videos point
 * at YouTube, which needs an embed, and audio rows with no local file are only
 * catalogue entries. The card gets a player or thumbnail only when there is
 * something honest to render.
 */
export function mediaForCandidate(
  candidate: Pick<SearchCandidate, 'collection' | 'url' | 'localPath'>,
): AskMedia | undefined {
  if (candidate.collection === 'videos') {
    // A stored local file is the archive's own copy and beats the source page.
    const src = resolvePlayableMediaSrc(
      { localPath: candidate.localPath, url: candidate.url },
      'video',
    )
    if (src) return { type: 'video', src }
    if (candidate.url && isYouTubeUrl(candidate.url)) {
      const poster = getYouTubeThumbUrl(candidate.url)
      const embedUrl = getYouTubeNoCookieEmbedUrl(candidate.url)
      if (poster && embedUrl) return { type: 'video', poster, embedUrl }
    }
    return undefined
  }

  if (candidate.collection === 'audio') {
    const src = resolvePlayableMediaSrc(
      { localPath: candidate.localPath, url: candidate.url },
      'audio',
    )
    return src ? { type: 'audio', src } : undefined
  }

  return undefined
}

function mediaForPhoto(row: {
  id: number
  url: string | null
  localPath: string | null
  caption: string | null
  source: string | null
}): AskMedia | undefined {
  const src = resolveImageSrc({ localPath: row.localPath, url: row.url })
  if (!src) return undefined
  return {
    type: 'image',
    src,
    alt: row.caption?.trim() || `Photograph ${row.id}${row.source ? ` from ${row.source}` : ''}`,
  }
}

/**
 * "Show me the photographs" is a request to see a collection, not a search for
 * the word "photographs". This returns a small set from the database, with the
 * same honesty constraints as the rest of `/ask`: an image with no caption is
 * shown as a photograph, never described as though the archive knew who or what
 * is in it.
 *
 * A dated request is filtered rather than ignored. Most of these rows are
 * undated, so the empty result says that instead of pretending the archive has
 * nothing from the period.
 */
export async function loadMediaRequest(
  collection: MediaCollection,
  period: AskPeriod | null,
): Promise<AskResult> {
  const label = ASK_COLLECTION_LABELS[collection]
  const yearWhere = period
    ? {
        year: {
          ...(period.from !== null ? { gte: period.from } : {}),
          ...(period.to !== null ? { lte: period.to } : {}),
        },
      }
    : {}

  if (collection === 'photos') {
    const where = {
      ...yearWhere,
      OR: [{ localPath: { not: null } }, { url: { not: null } }],
    }
    const [rows, total] = await Promise.all([
      prisma.image.findMany({
        where,
        orderBy: [{ faceMatchScore: 'desc' }, { id: 'desc' }],
        take: TAKE,
        select: {
          id: true,
          url: true,
          localPath: true,
          source: true,
          caption: true,
          year: true,
          event: true,
          location: true,
        },
      }),
      prisma.image.count({ where }),
    ])

    const citations: AskCitation[] = rows.map(row => {
      const media = mediaForPhoto(row)
      return {
        kind: 'photo',
        kindLabel: 'Photograph',
        collection: 'photos',
        collectionLabel: label,
        title: row.caption?.trim() || `Photograph #${row.id}`,
        href: `/images/${row.id}`,
        year: row.year,
        excerpt: [row.event, row.location, row.source].filter(Boolean).join(' · ') || null,
        hasTranscript: false,
        matched: [],
        ...(media ? { media } : {}),
      }
    })

    if (citations.length === 0) {
      return mediaResult(
        period
          ? `The photo archive has no photographs dated ${period.label}. Its records are largely uncaptioned and undated, so it cannot answer a dated request yet.`
          : 'The photo archive has no photographs with a stored image file.',
        collection,
        0,
        period,
      )
    }

    return mediaResult(
      `Here ${citations.length === 1 ? 'is' : 'are'} ${citations.length} photograph${citations.length === 1 ? '' : 's'} from the photo archive. They are records, not evidence: the archive holds no captions for them, so I can show the image but cannot tell you who or what it shows.`,
      collection,
      total,
      period,
      citations,
    )
  }

  if (collection === 'videos') {
    const where = { status: 'published', ...yearWhere }
    const [rows, total] = await Promise.all([
      prisma.video.findMany({
        where,
        orderBy: [{ featured: 'desc' }, { id: 'desc' }],
        take: TAKE,
        select: {
          id: true,
          title: true,
          url: true,
          localPath: true,
          source: true,
          channel: true,
          category: true,
          year: true,
          event: true,
        },
      }),
      prisma.video.count({ where }),
    ])

    const citations: AskCitation[] = rows.map(row => {
      const media = mediaForCandidate({
        collection: 'videos',
        url: row.url,
        localPath: row.localPath,
      })
      return {
        kind: 'video',
        kindLabel: 'Video',
        collection: 'videos',
        collectionLabel: label,
        title: row.title || `Video #${row.id}`,
        href: `/videos/${row.id}`,
        year: row.year,
        excerpt: [row.category, row.channel, row.event].filter(Boolean).join(' · ') || null,
        hasTranscript: false,
        matched: [],
        ...(row.url ? { url: row.url } : {}),
        ...(row.channel || row.source ? { sourceName: row.channel || row.source } : {}),
        ...(media ? { media } : {}),
      }
    })

    if (citations.length === 0) {
      return mediaResult(
        period
          ? `The video archive has no dated videos in ${period.label}. Its rows are catalogued but carry no broadcast dates, so it cannot answer a dated request.`
          : 'The video archive has no published videos yet.',
        collection,
        0,
        period,
      )
    }

    const playable = citations.filter(c => c.media).length
    return mediaResult(
      `Here ${citations.length === 1 ? 'is' : 'are'} ${citations.length} video${citations.length === 1 ? '' : 's'} from the archive. ` +
        (playable > 0
          ? `The cards are catalogue records — the archive has no transcripts, so I can show the video but cannot quote it.`
          : `The cards link to the original video pages; no local video file is held for them, and the archive has no transcripts.`),
      collection,
      total,
      period,
      citations,
    )
  }

  const where = { status: 'published', ...yearWhere }
  const [rows, total] = await Promise.all([
    prisma.audio.findMany({
      where,
      orderBy: [{ featured: 'desc' }, { id: 'desc' }],
      take: TAKE,
      select: {
        id: true,
        title: true,
        url: true,
        localPath: true,
        source: true,
        artist: true,
        caption: true,
        category: true,
        year: true,
        event: true,
      },
    }),
    prisma.audio.count({ where }),
  ])

  const citations: AskCitation[] = rows.map(row => {
    const media = mediaForCandidate({
      collection: 'audio',
      url: row.url,
      localPath: row.localPath,
    })
    return {
      kind: 'audio',
      kindLabel: 'Audio',
      collection: 'audio',
      collectionLabel: label,
      title: row.title || row.caption || `Audio #${row.id}`,
      href: `/audio/${row.id}`,
      year: row.year,
      excerpt: [row.caption, row.artist, row.event].filter(Boolean).join(' · ') || null,
      hasTranscript: false,
      matched: [],
      ...(row.url ? { url: row.url } : {}),
      ...(row.artist || row.source ? { sourceName: row.artist || row.source } : {}),
      ...(media ? { media } : {}),
    }
  })

  if (citations.length === 0) {
    return mediaResult(
      period
        ? `The audio archive has no dated recordings in ${period.label}. Its rows are catalogued but carry no dates, so it cannot answer a dated request.`
        : 'The audio archive has no published recordings yet.',
      collection,
      0,
      period,
    )
  }

  const playable = citations.filter(c => c.media).length
  return mediaResult(
    `Here ${citations.length === 1 ? 'is' : 'are'} ${citations.length} audio recording${citations.length === 1 ? '' : 's'} from the archive. ` +
      (playable > 0
        ? `The cards are catalogue records — the archive has no transcripts, so I can play the ones with an audio file but cannot quote them.`
        : `The cards link to the original recordings; no local audio file is held for them, and the archive has no transcripts.`),
    collection,
    total,
    period,
    citations,
  )
}

function mediaResult(
  summary: string,
  collection: MediaCollection,
  total: number,
  period: AskPeriod | null,
  citations: AskCitation[] = [],
): AskResult {
  return {
    summary,
    terms: [],
    match: 'all',
    citations,
    timeline: [],
    testimonials: [],
    collectionCounts: [{ collection, label: ASK_COLLECTION_LABELS[collection], count: total }],
    matchedTerms: [],
    unmatched: [],
    totalMatched: total,
    suggested: ASK_SUGGESTIONS.slice(0, 3),
    ...(period ? { period } : {}),
    limitations: [
      collection === 'photos'
        ? 'Photographs are shown from the archive’s image records. They have no captions, so they cannot support a statement about what was said.'
        : 'Media records are matched and shown from their catalogue metadata only; the archive has no transcripts for them yet.',
    ],
  }
}
