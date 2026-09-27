import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'
import TestimonialArchive from '@/components/TestimonialArchive'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Testimonials · AlbanBagbin Archives',
  description: 'What prominent figures in Ghana and the world have said of Rt. Hon. Alban Bagbin.',
}

export default async function TestimonialsPage() {
  const rows = await prisma.testimonial.findMany({
    where: { status: 'published' },
    orderBy: [{ sortOrder: 'asc' }, { year: 'desc' }],
    select: {
      id: true,
      author: true,
      role: true,
      quote: true,
      source: true,
      year: true,
      photoUrl: true,
    },
  })

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh' }}>
      <PublicHeader />
      <TestimonialArchive records={rows} />
      <PublicFooter />
    </div>
  )
}
