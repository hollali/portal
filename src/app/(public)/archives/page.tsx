import Link from 'next/link'
import { ArrowUpRight, BookOpen, type LucideIcon } from 'lucide-react'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'
import { ARCHIVE_LINKS } from '@/lib/man'
import { getLibraryCounts } from '@/lib/libraryQueries'

export const dynamic = 'force-dynamic'

const COUNT_KEYS: Record<string, [keyof Awaited<ReturnType<typeof getLibraryCounts>>, string]> = {
  speeches: ['speeches', 'Speeches'],
  papers: ['papers', 'Public Papers'],
  interviews: ['interviews', 'Interviews'],
  notes: ['notes', 'Notes & Correspondence'],
  milestones: ['milestones', 'Milestones'],
  testimonials: ['testimonials', 'Testimonials'],
  photos: ['photos', 'Photos'],
  news: ['news', 'News Clippings'],
  videos: ['videos', 'Videos'],
  audio: ['audio', 'Audio'],
}

const HUB_ICONS: Record<string, LucideIcon> = {
  'Speeches': BookOpen,
  'Public Papers': BookOpen,
  'Interviews': BookOpen,
  'Notes & Correspondence': BookOpen,
  'Milestones': BookOpen,
  'Testimonials': BookOpen,
  'Photos': BookOpen,
  'News Clippings': BookOpen,
  'Videos': BookOpen,
  'Audio': BookOpen,
}

export default async function ArchivesHub() {
  const counts = await getLibraryCounts()

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh' }}>
      <PublicHeader />

      <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(3.5rem, 7vw, 5.5rem) 1.5rem' }}>
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>Digital archives</span>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2.5rem, 6vw, 4rem)', letterSpacing: '-0.035em', lineHeight: 1.02, fontWeight: 800, margin: '1rem 0', color: 'var(--p-text-1)' }}>
            The archive collections
          </h1>
          <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: 'var(--p-text-2)', maxWidth: '40rem', margin: 0 }}>
            Speeches, papers, interviews, correspondence, milestones, testimonials, photographs and press coverage — a growing record of the Speaker&apos;s public life, in his own words and the words of others.
          </p>
        </div>
      </section>

      <section className="p-section" style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 5rem) 1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: '1rem' }}>
          {ARCHIVE_LINKS.map(link => {
            const [countKey] = COUNT_KEYS[link.count]!
            const n = counts[countKey]
            const Icon = HUB_ICONS[link.label] || BookOpen
            return (
              <Link key={link.href} href={link.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="p-card-lift" style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.5rem', height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ width: 42, height: 42, borderRadius: 11, background: 'var(--p-surface-2)', border: '1px solid var(--p-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                      <Icon size={20} />
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.875rem', fontWeight: 700, color: 'var(--p-text-2)' }}>
                      {n.toLocaleString()} <ArrowUpRight size={14} style={{ color: 'var(--primary)' }} />
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', fontFamily: 'var(--font-display), sans-serif', color: 'var(--p-text-1)', marginBottom: '0.4rem' }}>{link.label}</div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--p-text-3)', lineHeight: 1.6 }}>{link.description}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}