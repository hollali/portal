import type { Metadata } from 'next'
import PublicFooter from '@/components/PublicFooter'
import PhotoArchive from './PhotoArchive'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Photo Library · AlbanBagbin',
  description: 'Historical and current photographs, curated by year, event and theme.',
}

export default function PhotosPage() {
  return (
    <>
      <PhotoArchive />
      <PublicFooter />
    </>
  )
}
