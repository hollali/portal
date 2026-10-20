import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadMediaRequest, mediaForCandidate } from '@/lib/askMedia'
import type { SearchCandidate } from '@/lib/askSearch'

const db = vi.hoisted(() => ({
  image: { findMany: vi.fn(), count: vi.fn() },
  video: { findMany: vi.fn(), count: vi.fn() },
  audio: { findMany: vi.fn(), count: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: db }))

const candidate = (over: Partial<SearchCandidate>): SearchCandidate =>
  ({
    collection: 'videos',
    collectionLabel: 'Videos',
    kind: 'video',
    kindLabel: 'Video',
    title: 'A video',
    href: '/videos/1',
    year: null,
    excerpt: '',
    body: '',
    hasTranscript: false,
    url: null,
    sourceName: null,
    fields: [],
    matchTotal: 1,
    completeTotal: 1,
    ...over,
  }) as SearchCandidate

beforeEach(() => {
  vi.clearAllMocks()
})

describe('inline media for citations', () => {
  it('turns a YouTube watch page into a thumbnail and privacy-preserving embed', () => {
    const media = mediaForCandidate(
      candidate({ url: 'https://www.youtube.com/watch?v=abc123DEF45' }),
    )
    expect(media).toEqual({
      type: 'video',
      poster: 'https://i.ytimg.com/vi/abc123DEF45/hqdefault.jpg',
      embedUrl: 'https://www.youtube-nocookie.com/embed/abc123DEF45?rel=0',
    })
  })

  it('uses a direct video file rather than treating it as a page', () => {
    expect(
      mediaForCandidate(candidate({ url: 'https://cdn.example.test/clip.mp4' })),
    ).toEqual({ type: 'video', src: 'https://cdn.example.test/clip.mp4' })
  })

  it('only renders audio when there is a playable file', () => {
    expect(
      mediaForCandidate(
        candidate({ collection: 'audio', kind: 'audio', url: 'https://cdn.example.test/talk.mp3' }),
      ),
    ).toEqual({ type: 'audio', src: 'https://cdn.example.test/talk.mp3' })

    expect(
      mediaForCandidate(
        candidate({ collection: 'audio', kind: 'audio', url: 'https://example.test/recording' }),
      ),
    ).toBeUndefined()
  })

  it('does not invent a player for a catalogue page', () => {
    expect(
      mediaForCandidate(candidate({ url: 'https://example.test/a-video-page' })),
    ).toBeUndefined()
  })
})


describe('media collection requests', () => {
  it('shows photographs as images without claiming a caption', async () => {
    db.image.findMany.mockResolvedValue([
      {
        id: 9,
        url: 'https://example.test/photo.jpg',
        localPath: null,
        source: 'Example News',
        caption: null,
        year: null,
        event: null,
        location: null,
      },
    ])
    db.image.count.mockResolvedValue(283)

    const result = await loadMediaRequest('photos', null)
    expect(result.citations[0].media).toEqual({
      type: 'image',
      src: 'https://example.test/photo.jpg',
      alt: 'Photograph 9 from Example News',
    })
    expect(result.citations[0].excerpt).toBe('Example News')
    expect(result.summary).toContain('no captions')
    expect(result.totalMatched).toBe(283)
  })

  it('gives a YouTube video an inline thumbnail and embed', async () => {
    db.video.findMany.mockResolvedValue([
      {
        id: 7,
        title: 'Keynote on Parliament',
        url: 'https://www.youtube.com/watch?v=abc123DEF45',
        localPath: null,
        source: null,
        channel: 'Example Channel',
        category: 'Politics',
        year: null,
        event: null,
      },
    ])
    db.video.count.mockResolvedValue(430)

    const result = await loadMediaRequest('videos', null)
    expect(result.citations[0].media?.embedUrl).toBe(
      'https://www.youtube-nocookie.com/embed/abc123DEF45?rel=0',
    )
    expect(result.summary).toContain('no transcripts')
  })

  it('will not quietly ignore a dated request over undated records', async () => {
    db.audio.findMany.mockResolvedValue([])
    db.audio.count.mockResolvedValue(0)

    const result = await loadMediaRequest('audio', { from: 2020, to: 2020, label: '2020' })
    expect(result.citations).toEqual([])
    expect(result.summary).toContain('no dated recordings in 2020')
    expect(result.period).toEqual({ from: 2020, to: 2020, label: '2020' })
  })
})
