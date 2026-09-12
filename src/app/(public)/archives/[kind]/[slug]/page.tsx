import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowLeft, Calendar, Download, ExternalLink, FileText, Mic, MessagesSquare, ScrollText, MapPin, Building2 } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { renderMarkdown } from '@/lib/markdown'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'
import { LIST_ROUTE_KINDS } from '@/lib/library'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ kind: string; slug: string }>
}

const KIND_ICON: Record<string, React.ElementType> = {
  speech: Mic,
  paper: FileText,
  interview: MessagesSquare,
  note: ScrollText,
  letter: ScrollText,
  memo: ScrollText,
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kind, slug } = await params
  const listKind = kind as keyof typeof LIST_ROUTE_KINDS
  const kinds = LIST_ROUTE_KINDS[listKind]
  if (!kinds) return { title: 'Not Found' }
  const item = await prisma.archiveItem.findUnique({ where: { slug } })
  if (!item || item.status !== 'published' || !kinds.includes(item.kind as never)) return { title: 'Not Found' }
  return { title: `${item.title} · AlbanBagbin Archives`, description: item.excerpt || item.title }
}

export default async function ArchiveDetailPage({ params }: Props) {
  const { kind, slug } = await params
  const listKind = kind as keyof typeof LIST_ROUTE_KINDS
  const kinds = LIST_ROUTE_KINDS[listKind]
  if (!kinds) notFound()

  const item = await prisma.archiveItem.findUnique({ where: { slug } })
  if (!item || item.status !== 'published' || !kinds.includes(item.kind as never)) notFound()

  const Icon = KIND_ICON[item.kind] || FileText
  const bodyHtml = item.body ? renderMarkdown(item.body) : null
  const facets = [
    item.year && { label: 'Year', value: String(item.year), icon: Calendar },
    item.event && { label: 'Event', value: item.event, icon: null },
    item.location && { label: 'Location', value: item.location, icon: MapPin },
    item.person && { label: 'Person', value: item.person, icon: null },
    item.institution && { label: 'Institution', value: item.institution, icon: Building2 },
    item.parliament && { label: 'Parliament', value: item.parliament, icon: null },
    item.theme && { label: 'Theme', value: item.theme, icon: null },
  ].filter(Boolean) as { label: string; value: string; icon: React.ElementType | null }[]

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh' }}>
      <PublicHeader />

      <main style={{ maxWidth: 860, margin: '0 auto', padding: 'clamp(2.5rem, 5vw, 4rem) 1.5rem 4rem' }}>
        <Link href={`/archives/${kind}`} className="p-link-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--p-text-3)', textDecoration: 'none', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          <ArrowLeft size={15} /> Back to {kind === 'notes' ? 'Notes & Correspondence' : kind}
        </Link>

        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', padding: '0.35rem 0.75rem', borderRadius: 999 }}>
          <Icon size={12} /> Archive · {kind}
        </span>

        <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2rem, 5vw, 3rem)', letterSpacing: '-0.03em', lineHeight: 1.1, margin: '1.25rem 0 1rem', color: 'var(--p-text-1)' }}>{item.title}</h1>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
          {facets.map(f => (
            <span key={`${f.label}-${f.value}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--p-text-2)', border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 999, padding: '0.35rem 0.85rem' }}>
              {f.icon && <f.icon size={13} style={{ color: 'var(--primary)' }} />}
              <span style={{ fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', fontSize: '0.62rem', letterSpacing: '0.06em', color: 'var(--p-text-4)' }}>{f.label}:</span> {f.value}
            </span>
          ))}
          {item.venue && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--p-text-2)', border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 999, padding: '0.35rem 0.85rem' }}>
              <Building2 size={13} style={{ color: 'var(--primary)' }} />
              <span style={{ fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', fontSize: '0.62rem', letterSpacing: '0.06em', color: 'var(--p-text-4)' }}>Venue:</span> {item.venue}
            </span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '2.5rem' }}>
          {item.filePath && (
            <a href={`/api/dl?file=${encodeURIComponent(item.filePath)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--primary)', color: 'var(--primary-fg)', textDecoration: 'none', fontWeight: 600, padding: '0.7rem 1.3rem', borderRadius: 999, fontSize: '0.9rem' }}>
              <Download size={16} /> Download{ item.fileName ? ` (${item.fileName})` : '' }
            </a>
          )}
          {item.sourceUrl && (
            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--p-text-1)', textDecoration: 'none', fontWeight: 600, padding: '0.7rem 1.3rem', borderRadius: 999, fontSize: '0.9rem', border: '1px solid color-mix(in srgb, var(--foreground) 20%, transparent)' }}>
              <ExternalLink size={15} /> View original source
            </a>
          )}
          {item.excerpt && !item.body && (
            <p style={{ width: '100%', color: 'var(--p-text-2)', fontSize: '1.05rem', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>{item.excerpt}</p>
          )}
        </div>

        {bodyHtml && (
          <article className="cms-prose" style={{ borderTop: '1px solid var(--p-border)', paddingTop: '2rem' }} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        )}

        {item.source && (
          <p style={{ marginTop: '2.5rem', fontSize: '0.78rem', color: 'var(--p-text-4)', fontFamily: 'var(--font-mono), monospace' }}>
            Source: {item.source}
          </p>
        )}
      </main>

      <PublicFooter />
    </div>
  )
}