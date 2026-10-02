import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { renderMarkdown } from '@/lib/markdown'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await prisma.contentPage.findUnique({ where: { slug } })
  if (!page || page.status !== 'published') return { title: 'Not Found' }
  return { title: `${page.title} · AlbanBagbin`, description: page.title }
}

export default async function CmsPage({ params }: Props) {
  const { slug } = await params
  const page = await prisma.contentPage.findUnique({ where: { slug } })

  if (!page || page.status !== 'published') notFound()

  const html = renderMarkdown(page.body)

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh' }}>
      <PublicHeader />
      <main id="content" style={{ maxWidth: 820, margin: '0 auto', padding: 'clamp(3rem, 6vw, 5rem) 1.5rem 4rem' }}>
        <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>
          About
        </span>
        <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2rem, 4.5vw, 3rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0 1.5rem', color: 'var(--p-text-1)' }}>
          {page.title}
        </h1>
        <div className="cms-prose" dangerouslySetInnerHTML={{ __html: html }} />
      </main>
      {/* Not a bare copyright line: with the header collapsed into the drawer
          on mobile, this is one of the few permanent ways off a CMS page. */}
      <PublicFooter />
    </div>
  )
}