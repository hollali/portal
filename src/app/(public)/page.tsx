import Link from 'next/link'
import {
  ArrowUpRight,
  BookOpen,
  FileText,
  Mic,
  MessagesSquare,
  ScrollText,
  Award,
  Image as ImageIcon,
  Newspaper,
  Video,
  Headphones,
  Landmark,
  Quote,
  Milestone,
  type LucideIcon,
} from 'lucide-react'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'
import { MAN_SECTIONS, ARCHIVE_LINKS } from '@/lib/man'
import { getLibraryCounts, getLatestArchiveItems } from '@/lib/libraryQueries'
import { KIND_CONFIG, type ArchiveKind } from '@/lib/library'

export const dynamic = 'force-dynamic'

const KIND_ICON: Record<string, LucideIcon> = {
  speech: Mic,
  paper: FileText,
  interview: MessagesSquare,
  note: ScrollText,
  letter: ScrollText,
  memo: ScrollText,
}

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

const NUM_ICONS: Record<string, LucideIcon> = {
  Speeches: Mic,
  'Public Papers': FileText,
  Interviews: MessagesSquare,
  'Notes & Correspondence': ScrollText,
  Milestones: Milestone,
  Testimonials: Award,
  Photos: ImageIcon,
  'News Clippings': Newspaper,
  Videos: Video,
  Audio: Headphones,
}

export default async function LibraryHome() {
  const counts = await getLibraryCounts()
  const latest = await getLatestArchiveItems(8)

  const quickStats = [
    { value: counts.speeches.toLocaleString(), label: 'Speeches' },
    { value: counts.notes.toLocaleString(), label: 'Letters & memos' },
    { value: counts.photos.toLocaleString(), label: 'Photos' },
    { value: counts.testimonials.toLocaleString(), label: 'Testimonials' },
  ]

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh', overflowX: 'hidden' }}>
      <PublicHeader />

      {/* ── Hero ───────────────────────────────────────── */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div className="orb" style={{ position: 'absolute', top: -140, right: -120, width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, rgba(242,169,0,0.22) 0%, rgba(29,66,137,0.18) 45%, transparent 70%)', filter: 'blur(10px)', pointerEvents: 'none' }} />
        <div className="p-hero p-section" style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(4rem, 9vw, 7rem) 1.5rem clamp(2.5rem, 5vw, 4rem)', display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', alignItems: 'center', gap: '3rem' }}>
          <div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', padding: '0.375rem 0.75rem', borderRadius: 999 }}>
              <Landmark size={12} /> Speaker of the Parliament of Ghana
            </span>
            <h1 style={{ fontFamily: 'var(--font-display), var(--font-inter), sans-serif', fontSize: 'clamp(2.75rem, 7vw, 5rem)', lineHeight: 0.98, letterSpacing: '-0.035em', fontWeight: 800, margin: '1.5rem 0', color: 'var(--p-text-1)' }}>
              The Digital Library of
              <br />
              <span style={{ background: 'linear-gradient(90deg,#f9d06b,#f2a900,#bf7f00)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                Rt. Hon. Alban S. K. Bagbin
              </span>
            </h1>
            <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: 'var(--p-text-2)', maxWidth: '34rem', margin: '0 0 2rem' }}>
              His speeches, public papers, interviews, personal correspondence, photographs and milestones — collected in one place as a record of a thirty-year career in service to Ghana&apos;s democracy.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <Link href="/archives" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'var(--primary)', color: 'var(--primary-fg)', textDecoration: 'none', fontWeight: 600, padding: '0.75rem 1.4rem', borderRadius: 999, fontSize: '0.9375rem' }}>
                Explore the archives <ArrowUpRight size={16} />
              </Link>
              <Link href="/the-man" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--p-text-1)', textDecoration: 'none', fontWeight: 600, padding: '0.75rem 1.4rem', borderRadius: 999, fontSize: '0.9375rem', border: '1px solid color-mix(in srgb, var(--foreground) 20%, transparent)' }}>
                The Man
              </Link>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginTop: '2.75rem' }}>
              {quickStats.map(s => (
                <div key={s.label}>
                  <div style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--p-text-1)', fontFamily: 'var(--font-display), sans-serif', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--p-text-3)', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ position: 'relative', justifySelf: 'center', width: '100%', maxWidth: 420, display: 'flex', justifyContent: 'center' }}>
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/8/8b/Speaker_Alban_Bagbin-2_%28cropped%29.jpg"
              alt="Alban Bagbin, Speaker of the Parliament of Ghana"
              width={400}
              height={500}
              style={{ width: '100%', maxWidth: 400, borderRadius: 16, objectFit: 'cover', aspectRatio: '4/5', border: '1px solid var(--p-border-3)', boxShadow: 'var(--p-shadow), 0 0 0 1px color-mix(in srgb, var(--primary) 25%, transparent)' }}
            />
            <div style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', width: '86%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'color-mix(in srgb, var(--p-surface-2) 82%, transparent)', backdropFilter: 'blur(10px)', border: '1px solid var(--p-border-3)', borderRadius: 12, padding: '0.7rem 1rem' }}>
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--p-text-3)', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Speaker since</div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--p-text-1)' }}>7 January 2021</div>
              </div>
              <Quote size={20} style={{ color: 'var(--primary)' }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Archive quick links ───────────────────────── */}
      <section className="p-section" style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 5rem) 1.5rem' }}>
        <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>The digital archives</span>
        <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2rem, 4.5vw, 3rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0 0.5rem', color: 'var(--p-text-1)' }}>
          Explore the collections
        </h2>
        <p style={{ color: 'var(--p-text-3)', maxWidth: '42rem', margin: '0 0 2.5rem' }}>
          Every item in the library — in his own words and in the words of others — organised for research and reference.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
          {ARCHIVE_LINKS.map(link => {
            const [countKey, label] = COUNT_KEYS[link.count]!
            const Icon = NUM_ICONS[label] || BookOpen
            const n = counts[countKey]
            return (
              <Link key={link.href} href={link.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="p-card-lift" style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.4rem', height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' }}>
                    <span style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--p-border)', background: 'var(--p-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                      <Icon size={19} />
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.875rem', fontWeight: 700, color: 'var(--p-text-2)' }}>{n.toLocaleString()}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--p-text-1)', fontFamily: 'var(--font-display), sans-serif', marginBottom: '0.35rem' }}>{link.label}</div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--p-text-3)', lineHeight: 1.55 }}>{link.description}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── The Man teaser ─────────────────────────────── */}
      <section style={{ borderTop: '1px solid var(--p-border)', background: 'var(--p-surface-3)' }}>
        <div className="p-section" style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(3.5rem, 7vw, 5.5rem) 1.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>The Man</span>
              <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2rem, 4.5vw, 3rem)', letterSpacing: '-0.03em', margin: '0.75rem 0 0', color: 'var(--p-text-1)' }}>
                The life behind the office
              </h2>
            </div>
            <Link href="/the-man" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--p-text-1)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, borderBottom: '1px solid var(--primary)', paddingBottom: '0.25rem' }}>
              Read the full profile <ArrowUpRight size={15} style={{ color: 'var(--primary)' }} />
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '1rem' }}>
            {MAN_SECTIONS.map(s => (
              <Link key={s.id} href={`/the-man#${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="p-card" style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.5rem', height: '100%' }}>
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', color: 'var(--primary)' }}>{s.eyebrow}</span>
                  <div style={{ fontWeight: 700, fontSize: '1.125rem', fontFamily: 'var(--font-display), sans-serif', color: 'var(--p-text-1)', margin: '0.4rem 0 0.5rem' }}>{s.title}</div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--p-text-3)', lineHeight: 1.55 }}>
                    {s.items.slice(0, 3).map(i => i.title).join(' · ')}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Latest additions ───────────────────────────── */}
      <section className="p-section" style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(3.5rem, 7vw, 5.5rem) 1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>Recently added</span>
            <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2rem, 4.5vw, 3rem)', letterSpacing: '-0.03em', margin: '0.75rem 0 0', color: 'var(--p-text-1)' }}>
              Latest to the archive
            </h2>
          </div>
          <Link href="/archives" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--p-text-1)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, borderBottom: '1px solid var(--primary)', paddingBottom: '0.25rem' }}>
            View everything <ArrowUpRight size={15} style={{ color: 'var(--primary)' }} />
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))', gap: '1rem' }}>
          {latest.length === 0 && (
            <p style={{ color: 'var(--p-text-3)' }}>New archive items will appear here as they are digitised.</p>
          )}
          {latest.map(item => {
            const Icon = KIND_ICON[item.kind] || FileText
            const cfg = KIND_CONFIG[item.kind as ArchiveKind]
            const route = item.kind === 'note' || item.kind === 'letter' || item.kind === 'memo' ? 'notes' : `${item.kind}s`
            return (
              <Link key={item.id} href={`/archives/${route}/${item.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="p-card-lift" style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.4rem', height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.7rem' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.6875rem', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)' }}>
                      <Icon size={13} /> {cfg?.label || item.kind}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--p-text-4)', fontFamily: 'var(--font-mono), monospace' }}>{item.date || item.year || ''}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--p-text-1)', fontFamily: 'var(--font-display), sans-serif', lineHeight: 1.35, marginBottom: '0.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {[item.event, item.location, item.theme].filter(Boolean).slice(0, 3).map(f => (
                      <span key={f} style={{ fontSize: '0.6875rem', color: 'var(--p-text-3)', border: '1px solid var(--p-border-2)', background: 'var(--p-surface-2)', borderRadius: 999, padding: '0.2rem 0.6rem' }}>{f}</span>
                    ))}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* ── Testimonial band ───────────────────────────── */}
      <section style={{ borderTop: '1px solid var(--p-border)', background: 'var(--p-surface-3)' }}>
        <div className="p-section" style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
            <div style={{ maxWidth: 680 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>
                <Quote size={13} /> Testimonials
              </span>
              <blockquote style={{ margin: '1rem 0 0', fontSize: 'clamp(1.1rem, 2.4vw, 1.45rem)', lineHeight: 1.55, color: 'var(--p-text-1)', fontFamily: 'var(--font-display), sans-serif' }}>
                &ldquo;In Rt. Hon. Alban Bagbin, Ghana has a Speaker whose commitment to parliamentary independence and the rule of law speaks to the highest traditions of legislative service.&rdquo;
              </blockquote>
              <Link href="/archives/testimonials" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--p-text-1)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, borderBottom: '1px solid var(--primary)', paddingBottom: '0.25rem', marginTop: '1.25rem' }}>
                Read more testimonials <ArrowUpRight size={15} style={{ color: 'var(--primary)' }} />
              </Link>
            </div>
            <div style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.5rem', minWidth: 240 }}>
              <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--p-text-4)', marginBottom: '0.75rem' }}>The archive at a glance</div>
              {[
                ['Speeches & papers', counts.speeches + counts.papers],
                ['Letters & memos', counts.notes],
                ['Milestones', counts.milestones],
                ['Photos', counts.photos],
                ['Total documents', counts.total],
              ].map(([label, n]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', padding: '0.4rem 0', borderBottom: '1px solid var(--p-border-2)' }}>
                  <span style={{ color: 'var(--p-text-3)' }}>{label}</span>
                  <span style={{ color: 'var(--p-text-1)', fontWeight: 700 }}>{Number(n).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <PublicFooter />
    </div>
  )
}