import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { renderMarkdown } from '@/lib/markdown'
import PublicHeader from '@/components/PublicHeader'

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
      <main style={{ maxWidth: 820, margin: '0 auto', padding: 'clamp(3rem, 6vw, 5rem) 1.5rem 4rem' }}>
        <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>
          About
        </span>
        <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2rem, 4.5vw, 3rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0 1.5rem', color: 'var(--p-text-1)' }}>
          {page.title}
        </h1>
        <div className="cms-prose" dangerouslySetInnerHTML={{ __html: html }} />
      </main>
      <footer style={{ borderTop: '1px solid var(--p-border)', background: 'var(--p-surface-2)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--p-text-3)' }}>
            © {new Date().getFullYear()} AlbanBagbin · Public profile & media archive
          </span>
        </div>
      </footer>
    </div>
  )
}