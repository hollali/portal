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
  Milestone,
  type LucideIcon,
} from 'lucide-react'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'
import HeroSection from '@/components/HeroSection'
import LatestToArchive from '@/components/LatestToArchive'
import TestimonialCarousel from '@/components/TestimonialCarousel'
import { getLibraryCounts, getLatestArchiveItems, getHeroContent, getSectionData } from '@/lib/libraryQueries'
import type {
  BiographyData,
  CollectionsData,
  InstitutionsData,
  ManPageData,
  QuotesData,
  SchoolsData,
  TimelineData,
} from '@/lib/content'

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

const NUM_ICONS: Record<string, LucideIcon> = {
  Speeches: Mic,
  'Public Papers': FileText,
  Interviews: MessagesSquare,
  'Notes & Correspondence': ScrollText,
  Milestones: Milestone,
  Testimonials: Award,
  Photos: ImageIcon,
  'Photo Library': ImageIcon,
  'News Clippings': Newspaper,
  Videos: Video,
  Audio: Headphones,
}

export default async function LibraryHome() {
  const counts = await getLibraryCounts()
  const latest = await getLatestArchiveItems(8)
  const heroContent = await getHeroContent()
  const [schools, collections, manPage, quotes, biography, timeline, institutions] = await Promise.all([
    getSectionData<SchoolsData>('home_schools'),
    getSectionData<CollectionsData>('archive_collections'),
    getSectionData<ManPageData>('the_man'),
    getSectionData<QuotesData>('home_quotes'),
    getSectionData<BiographyData>('home_biography'),
    getSectionData<TimelineData>('home_timeline'),
    getSectionData<InstitutionsData>('home_institutions'),
  ])

  const MAN_SECTIONS = manPage.sections
  const ARCHIVE_LINKS = collections.items
  const SCHOOLS = schools.items

  const quickStats = [
    { value: counts.speeches, label: 'Speeches' },
    { value: counts.notes, label: 'Letters & memos' },
    { value: counts.photos, label: 'Photos' },
    { value: counts.testimonials, label: 'Testimonials' },
  ]

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh', overflowX: 'hidden' }}>
      <PublicHeader />

      <HeroSection stats={quickStats} content={heroContent} />

      {/* ── Schools attended marquee ─────────────────── */}
      <div className="marquee-paused" style={{ borderTop: '1px solid var(--p-border)', borderBottom: '1px solid var(--p-border)', overflow: 'hidden', padding: '1rem 0', background: 'var(--p-surface-2)' }}>
        <div className="marquee-track">
          {[...SCHOOLS, ...SCHOOLS].map((s, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingRight: '2.5rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--p-text-4)' }}>
              <span>{s.name}</span>
              {s.cap && <span style={{ color: 'var(--p-text-3)' }}>{s.cap}</span>}
              <span style={{ color: 'var(--primary)' }}>◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Archive quick links ───────────────────────── */}
      <section className="p-section" data-motion-entry style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 5rem) 1.5rem' }}>
        <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>The digital archives</span>
        <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2rem, 4.5vw, 3rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0 0.5rem', color: 'var(--p-text-1)' }}>
          Explore <span className="p-serif">the collections</span>
        </h2>
        <p style={{ color: 'var(--p-text-3)', maxWidth: '42rem', margin: '0 0 2.5rem' }}>
          Every item in the library — in his own words and in the words of others — organised for research and reference.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
          {ARCHIVE_LINKS.map(link => {
            const entry = COUNT_KEYS[link.count]
            const Icon = NUM_ICONS[link.label] || BookOpen
            const n = entry ? counts[entry[0]] : null
            return (
              <Link key={link.href} href={link.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div className="p-card-lift" style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.4rem', height: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.9rem' }}>
                    <span style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--p-border)', background: 'var(--p-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                      <Icon size={19} />
                    </span>
                    {n !== null && (
                      <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.875rem', fontWeight: 700, color: 'var(--p-text-2)' }}>{n.toLocaleString()}</span>
                    )}
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
        <div className="p-section" data-motion-entry style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(3.5rem, 7vw, 5.5rem) 1.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>The Man</span>
              <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2rem, 4.5vw, 3rem)', letterSpacing: '-0.03em', margin: '0.75rem 0 0', color: 'var(--p-text-1)' }}>
                The life <span className="p-serif">behind the office</span>
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

      {/* ── Profile (CMS: home_biography + home_institutions) ── */}
      <section id="profile" className="p-section" data-motion-entry style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 5rem) 1.5rem', scrollMarginTop: 96 }}>
        <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>Profile</span>
        <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2rem, 4.5vw, 3rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0 0.75rem', color: 'var(--p-text-1)', whiteSpace: 'pre-line' }}>
          {biography.heading}
        </h2>
        <p style={{ color: 'var(--p-text-2)', maxWidth: '46rem', margin: '0 0 2rem', lineHeight: 1.7 }}>{biography.intro}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '1rem' }}>
          {biography.cards.map(c => (
            <div key={c.tag} className="p-card" style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.5rem' }}>
              <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)' }}>{c.tag}</span>
              <p style={{ margin: '0.6rem 0 0', fontSize: '0.88rem', color: 'var(--p-text-2)', lineHeight: 1.65 }}>{c.text}</p>
            </div>
          ))}
        </div>
        {institutions.items.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1.5rem' }}>
            {institutions.items.map(name => (
              <span key={name} style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--p-text-3)', border: '1px solid var(--p-border)', borderRadius: 999, padding: '0.4rem 0.9rem', background: 'var(--p-surface)' }}>
                {name}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ── Career timeline strip (CMS: home_timeline) ───── */}
      <section style={{ borderTop: '1px solid var(--p-border)', background: 'var(--p-surface-3)' }}>
        <div className="p-section" data-motion-entry style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>Career timeline</span>
              <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2rem, 4.5vw, 3rem)', letterSpacing: '-0.03em', margin: '0.75rem 0 0', color: 'var(--p-text-1)', whiteSpace: 'pre-line' }}>
                {timeline.heading}
              </h2>
              <p style={{ color: 'var(--p-text-3)', maxWidth: '42rem', margin: '0.75rem 0 0' }}>{timeline.subheading}</p>
            </div>
            <Link href="/timeline" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--p-text-1)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, borderBottom: '1px solid var(--primary)', paddingBottom: '0.25rem' }}>
              Full timeline <ArrowUpRight size={15} style={{ color: 'var(--primary)' }} />
            </Link>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: '1rem' }}>
            {timeline.entries.slice(0, 8).map(e => (
              <div key={`${e.year}-${e.title}`} className="p-card" style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.25rem' }}>
                <div style={{ fontFamily: 'var(--font-mono), monospace', fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>{e.year}</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', fontFamily: 'var(--font-display), sans-serif', color: 'var(--p-text-1)', margin: '0.35rem 0' }}>{e.title}</div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--p-text-3)', lineHeight: 1.6 }}>{e.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Latest additions ───────────────────────────── */}
      <LatestToArchive items={latest} />


      {/* ── Testimonial band ───────────────────────────── */}
      <section style={{ borderTop: '1px solid var(--p-border)', background: 'var(--p-surface-3)' }}>
        <div className="p-section" data-motion-entry style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 6vw, 4.5rem) 1.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
            <div style={{ maxWidth: 680 }}>
              <TestimonialCarousel
                quotes={quotes.items.map(quote => ({ quote }))}
              />
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