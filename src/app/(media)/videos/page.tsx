import type { Metadata } from 'next'
import MediaArchive from '@/components/MediaArchive'
import { VIDEO_CATEGORIES } from '@/lib/library'

export const metadata: Metadata = {
  title: 'Video Archive',
  description: 'Parliamentary speeches, interviews, international engagements, conferences, parliamentary events and documentaries involving Rt. Hon. Alban Bagbin.',
}

export const dynamic = 'force-dynamic'

export default function VideoArchivePage() {
  return (
    <MediaArchive
      kind="videos"
      eyebrow="Archive · Video Library"
      heading={<>The <span className="p-serif">video archive</span></>}
      sub="Parliamentary speeches, interviews, international engagements, conferences, parliamentary events and documentaries — watched in motion, indexed for research."
      categories={VIDEO_CATEGORIES}
    />
  )
}