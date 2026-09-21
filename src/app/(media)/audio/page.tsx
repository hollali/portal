import type { Metadata } from 'next'
import MediaArchive from '@/components/MediaArchive'
import { AUDIO_CATEGORIES } from '@/lib/library'

export const metadata: Metadata = {
  title: 'Audio Archive',
  description: 'Speeches, interviews, radio programmes and parliamentary addresses of Rt. Hon. Alban Bagbin.',
}

export const dynamic = 'force-dynamic'

export default function AudioArchivePage() {
  return (
    <MediaArchive
      kind="audio"
      eyebrow="Archive · Audio Library"
      heading={<>The <span className="p-serif">audio archive</span></>}
      sub="Speeches, interviews, radio programmes and parliamentary addresses — the Speaker in sound, indexed for research."
      categories={AUDIO_CATEGORIES}
    />
  )
}