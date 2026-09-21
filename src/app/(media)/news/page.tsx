import type { Metadata } from 'next'
import NewsArchive from '@/components/NewsArchive'

export const metadata: Metadata = {
  title: 'News Archive',
  description: 'Press coverage of Rt. Hon. Alban Bagbin collected and archived by source — searchable and exportable.',
}

export const dynamic = 'force-dynamic'

export default function NewsListPage() {
  return <NewsArchive />
}