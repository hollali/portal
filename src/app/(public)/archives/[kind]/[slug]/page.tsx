import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowLeft, Calendar, Download, ExternalLink, FileText, MapPin, Building2, Video, AudioLines, Image as ImageIcon, BookOpen, CircleCheck, Info } from 'lucide-react'
import { KIND_ICON } from '@/lib/kindIcon'
import { prisma } from '@/lib/prisma'
import { renderMarkdown } from '@/lib/markdown'
import { isYouTubeUrl, getYouTubeEmbedUrl } from '@/lib/media'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'
import { LIST_ROUTE_KINDS } from '@/lib/library'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ kind: string; slug: string }>
}

const KIND_NAME: Record<string, string> = {
  speech: 'Speech',
  paper: 'Paper',
  interview: 'Interview',
  note: 'Notes & Correspondence',
  letter: 'Notes & Correspondence',
  memo: 'Notes & Correspondence',
}

const KIND_PLURAL: Record<string, string> = {
  speech: 'speeches',
  paper: 'papers',
  interview: 'interviews',
  note: 'notes',
  letter: 'notes',
  memo: 'notes',
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

  const Icon = KIND_ICON[item.kind] ?? FileText
  const kindName = KIND_NAME[item.kind] || kind
  const backLabel = KIND_PLURAL[item.kind] || KIND_PLURAL[kind] || kind
  const bodyHtml = item.body ? renderMarkdown(item.body) : null

  const videoEmbed = item.videoUrl ? getYouTubeEmbedUrl(item.videoUrl) : null
  const hasMedia = !!(item.videoUrl || item.audioUrl || item.photoUrl)

  const facts: { label: string; value: string; valueOnly?: boolean }[] = [
    item.year ? { label: 'Year', value: String(item.year) } : null,
    item.date ? { label: 'Date', value: item.date } : null,
    item.occasion ? { label: 'Occasion', value: item.occasion } : null,
    item.event ? { label: 'Event', value: item.event } : null,
    item.venue ? { label: 'Venue', value: item.venue } : null,
    item.location ? { label: 'Location', value: item.location } : null,
    item.institution ? { label: 'Institution', value: item.institution } : null,
    item.parliament ? { label: 'Parliament', value: item.parliament } : null,
    item.theme ? { label: 'Theme', value: item.theme } : null,
    item.source ? { label: 'Source', value: item.source } : null,
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh' }}>
      <PublicHeader />

      {/* ── Hero band ── */}
      <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(2.75rem, 5vw, 4.5rem) 1.5rem 2.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.75rem' }}>
            <Link href={`/archives/${kind}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--p-text-3)', textDecoration: 'none', fontSize: '0.85rem' }}>
              <ArrowLeft size={14} /> Back to {backLabel}
            </Link>

            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', padding: '0.3rem 0.7rem', borderRadius: 999 }}>
              <Icon size={12} strokeWidth={2.25} /> {kindName}
            </span>
          </div>

          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2.1rem, 5vw, 3.25rem)', letterSpacing: '-0.03em', lineHeight: 1.08, margin: '1.25rem 0 0.9rem', color: 'var(--p-text-1)', maxWidth: '52rem' }}>{item.title}</h1>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: 'var(--p-text-3)' }}>
            {item.year && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <Calendar size={14} style={{ color: 'var(--primary)' }} />
                {item.year}
                {item.date && item.date !== String(item.year) ? ` · ${item.date}` : ''}
              </span>
            )}
            {item.occasion && <span>{item.occasion}</span>}
            {item.venue && <span>{item.venue}</span>}
          </div>

          {(item.filePath || item.sourceUrl) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginTop: '1.75rem' }}>
              {item.filePath && (
                <a href={`/api/dl?file=${encodeURIComponent(item.filePath)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--primary)', color: 'var(--primary-fg)', textDecoration: 'none', fontWeight: 600, padding: '0.75rem 1.4rem', borderRadius: 999, fontSize: '0.9rem' }}>
                  <Download size={16} /> Download{ item.fileName ? ` (${item.fileName})` : '' }
                </a>
              )}
              {item.sourceUrl && (
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--p-text-1)', textDecoration: 'none', fontWeight: 600, padding: '0.75rem 1.4rem', borderRadius: 999, fontSize: '0.9rem', border: '1px solid var(--p-border-3)' }}>
                  <ExternalLink size={15} /> View original source
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      <main id="content" style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(2.25rem, 4vw, 3.25rem) 1.5rem 4rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '2.5rem', alignItems: 'start' }} className="stack-sm">
          {/* ── Reading column ── */}
          <article>
            {item.excerpt && (
              <div style={{ background: 'color-mix(in srgb, var(--primary) 6%, var(--p-surface))', border: '1px solid color-mix(in srgb, var(--primary) 22%, transparent)', borderLeft: '3px solid var(--primary)', borderRadius: 12, padding: '1.35rem 1.6rem', marginBottom: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.6rem' }}>
                  <BookOpen size={13} /> Abstract
                </div>
                <p style={{ margin: 0, fontSize: '1.05rem', lineHeight: 1.75, color: 'var(--p-text-2)' }}>{item.excerpt}</p>
              </div>
            )}

            {hasMedia && (
              <section style={{ borderTop: '1px solid var(--p-border)', paddingTop: '1.5rem', marginBottom: '2rem' }}>
                <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>The record in motion</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '1rem', marginTop: '1rem' }}>
                  {item.videoUrl && (
                    <div style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.1rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.66rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--p-text-4)', marginBottom: '0.6rem' }}>
                        <Video size={13} style={{ color: 'var(--primary)' }} /> Video
                      </span>
                      {videoEmbed ? (
                        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 10, overflow: 'hidden', background: '#000' }}>
                          <iframe src={videoEmbed} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen allow="autoplay" />
                        </div>
                      ) : (
                        <a href={item.videoUrl} target="_blank" rel="noopener noreferrer" className="p-link-primary" style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>Play / open video <ExternalLink size={14} /></a>
                      )}
                    </div>
                  )}
                  {item.audioUrl && (
                    <div style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.1rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.66rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--p-text-4)', marginBottom: '0.6rem' }}>
                        <AudioLines size={13} style={{ color: 'var(--primary)' }} /> Audio
                      </span>
                      {isYouTubeUrl(item.audioUrl) ? (
                        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 10, overflow: 'hidden', background: '#000' }}>
                          <iframe src={getYouTubeEmbedUrl(item.audioUrl)!} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen allow="autoplay" />
                        </div>
                      ) : (
                        <audio controls style={{ width: '100%' }}>
                          <source src={item.audioUrl} />
                        </audio>
                      )}
                    </div>
                  )}
                  {item.photoUrl && (
                    <div style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.1rem' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.66rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--p-text-4)', marginBottom: '0.6rem' }}>
                        <ImageIcon size={13} style={{ color: 'var(--primary)' }} /> Photograph
                      </span>
                      <a href={item.photoUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
                        <img src={item.photoUrl} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 10, border: '1px solid var(--p-border-2)' }} />
                      </a>
                    </div>
                  )}
                </div>
              </section>
            )}

            {bodyHtml ? (
              <article className="cms-prose" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            ) : (
              item.excerpt ? null : (
                <p style={{ color: 'var(--p-text-3)' }}>No transcript is available for this record yet.</p>
              )
            )}

            {item.source && (
              <p style={{ marginTop: '2.5rem', fontSize: '0.78rem', color: 'var(--p-text-4)', fontFamily: 'var(--font-mono), monospace' }}>
                Source: {item.source}
              </p>
            )}
          </article>

          {/* ── Facts rail ── */}
          <aside style={{ position: 'sticky', top: '1.5rem' }}>
            <div style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 1.25rem', borderBottom: '1px solid var(--p-border)', fontFamily: 'var(--font-mono), monospace', fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--p-text-4)' }}>
                <Info size={13} style={{ color: 'var(--primary)' }} /> Record details
              </div>
              <dl style={{ margin: 0, padding: '0.5rem 1.25rem 1rem' }}>
                {facts.map(f => (
                  <div key={f.label} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--p-border-2)' }}>
                    <dt style={{ fontSize: '0.66rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-text-4)', margin: 0 }}>{f.label}</dt>
                    <dd style={{ margin: '0.2rem 0 0', fontSize: '0.9rem', color: 'var(--p-text-1)', lineHeight: 1.4 }}>{f.value}</dd>
                  </div>
                ))}
                <div style={{ padding: '0.6rem 0 0' }}>
                  <dt style={{ fontSize: '0.66rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--p-text-4)', margin: 0 }}>Record</dt>
                  <dd style={{ margin: '0.2rem 0 0', fontSize: '0.9rem', color: 'var(--p-text-1)', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <CircleCheck size={14} style={{ color: item.sourceType === 'verified' ? 'var(--success)' : 'var(--p-text-4)' }} />
                    {item.sourceType === 'verified' ? 'Verified' : 'Archived'} · #{item.id}
                  </dd>
                </div>
              </dl>
            </div>
            {item.fileName && (
              <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px dashed var(--p-border-3)', borderRadius: 12, padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--p-text-3)' }}>
                <FileText size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} /> {item.fileName}
              </div>
            )}
          </aside>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}