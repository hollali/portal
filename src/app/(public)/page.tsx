'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { localToMediaUrl } from '@/lib/media'
import PublicHeader from '@/components/PublicHeader'
import {
  ArrowRight,
  ArrowUpRight,
  Image as ImageIcon,
  Video,
  Newspaper,
  Headphones,
  Play,
  Loader2,
  Landmark,
  GraduationCap,
  Scale,
  Quote,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

/* ────────────────────────────────────────────────────────────
   Types
──────────────────────────────────────────────────────────── */

interface Stats {
  images: number
  videos: number
  news: number
  audio: number
  total: number
  sources: Record<string, number>
}

interface ImageItem {
  id: number
  url: string | null
  localPath: string | null
  source: string | null
  collectedAt: string | null
  faceMatch: number | null
}
interface VideoItem {
  id: number
  title: string | null
  source: string | null
  channel: string | null
  collectedAt: string | null
}
interface NewsItem {
  id: number
  title: string | null
  sourceName: string | null
  date: string | null
}
interface AudioItem {
  id: number
  title: string | null
  source: string | null
  artist: string | null
  collectedAt: string | null
}

/* ────────────────────────────────────────────────────────────
   Static content (sourced from Wikipedia)
──────────────────────────────────────────────────────────── */

const INSTITUTIONS = [
  'Parliament of Ghana',
  'National Democratic Congress',
  'University of Ghana',
  'Ghana School of Law',
  'GIMPA',
  'UNICEF',
  '4th Republic',
  'Commonwealth',
]

const TIMELINE = [
  { year: '1992', title: 'Elected to Parliament', text: 'Won the Nadowli North seat in the 1992 general elections on the NDC ticket — the start of seven consecutive terms.' },
  { year: '1996', title: 'Retained Nadowli North', text: 'Re-elected with 76.46% of valid votes cast (12,605 of 16,485 votes).' },
  { year: '2001', title: 'Minority Leader', text: 'Served as Minority Leader in Parliament from 2001 to 2009.' },
  { year: '2009', title: 'Majority Leader', text: 'Appointed Majority Leader of the Ghanaian Parliament under President John Atta Mills.' },
  { year: '2010', title: 'Cabinet Minister', text: 'Appointed Minister for Water Resources, Works and Housing in January 2010.' },
  { year: '2012', title: 'Minister for Health', text: 'Served as Minister for Health from January 2012 until February 2013.' },
  { year: '2017', title: 'Second Deputy Speaker', text: 'Elected Second Deputy Speaker of Parliament (2017–2021).' },
  { year: '2021', title: 'Speaker of Parliament', text: 'Elected Speaker of the 8th Parliament — the first Speaker ever chosen from the opposition in Ghana’s history.' },
  { year: '2024', title: 'Vacant seats ruling', text: 'Declared four seats vacant over party-switching; the Supreme Court later overturned the decision.' },
  { year: '2025', title: 'Re-elected Speaker', text: 'Retained as Speaker of the 9th Parliament of the Fourth Republic on 7 January 2025.' },
]

const FACTS: { icon: LucideIcon; label: string; value: string }[] = [
  { icon: Scale, value: '8th & 9th', label: 'Speaker of the Fourth Republic' },
  { icon: Landmark, value: '7 terms', label: 'Member of Parliament' },
  { icon: GraduationCap, value: 'LL.B · Bar 1982', label: 'University of Ghana · Ghana School of Law' },
  { icon: Sparkles, value: '24 Sep 1957', label: 'Born in Sombo, Upper West Region' },
]

/* ────────────────────────────────────────────────────────────
   Page
──────────────────────────────────────────────────────────── */

export default function PublicHome() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [images, setImages] = useState<ImageItem[]>([])
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [news, setNews] = useState<NewsItem[]>([])
  const [audioItems, setAudioItems] = useState<AudioItem[]>([])
  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {})
    Promise.all([
      fetch('/api/images?perPage=6').then(r => r.json()),
      fetch('/api/videos?perPage=4').then(r => r.json()),
      fetch('/api/news?perPage=4').then(r => r.json()),
      fetch('/api/audio?perPage=4').then(r => r.json()),
    ])
      .then(([i, v, n, a]) => {
        setImages(i.items || [])
        setVideos(v.items || [])
        setNews(n.items || [])
        setAudioItems(a.items || [])
      })
      .catch(() => {})
  }, [])

  const mediaCount = (k: 'images' | 'videos' | 'audio' | 'news') => stats?.[k] ?? 0

  const imgSrc = (img: ImageItem) => localToMediaUrl(img.localPath) || img.url

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh', overflowX: 'hidden' }}>
      <PublicHeader />

      {/* ── Hero ───────────────────────────────────────── */}
      <section style={{ position: 'relative', overflow: 'hidden' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div className="orb"
          style={{
            position: 'absolute', top: -140, right: -120, width: 460, height: 460, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,86,10,0.28) 0%, rgba(255,86,10,0.06) 45%, transparent 70%)',
            filter: 'blur(10px)', pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'relative',
            maxWidth: 1180,
            margin: '0 auto',
            padding: 'clamp(4rem, 9vw, 7.5rem) 1.5rem clamp(2.5rem, 5vw, 4rem)',
            display: 'grid',
            gridTemplateColumns: '1.05fr 0.95fr',
            alignItems: 'center',
            gap: '3rem',
          }}
          className="p-hero p-section"
        >
          <div>
            <span className="p-eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', padding: '0.375rem 0.75rem', borderRadius: 999 }}>
              <Quote size={12} /> Rt. Hon. <span className="hide-sm">&middot; Speaker of the Parliament of Ghana</span>
            </span>

            <h1
              className="p-hero-title"
              style={{
                fontFamily: 'var(--font-display), var(--font-inter), sans-serif',
                fontSize: 'clamp(2.75rem, 7vw, 5.25rem)',
                lineHeight: 0.98,
                letterSpacing: '-0.035em',
                fontWeight: 800,
                margin: '1.5rem 0',
                color: 'var(--p-text-1)',
              }}
            >
              Alban Sumana
              <br />
              <span style={{ background: 'linear-gradient(90deg,#ff560a,#ff7a3d,#f8b84b)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                Kingsford Bagbin
              </span>
            </h1>

            <p style={{ fontSize: '1.05rem', lineHeight: 1.6, color: 'var(--p-text-2)', maxWidth: '34rem', margin: '0 0 2rem' }}>
              Ghanaian lawyer, statesman and legislator — elected Speaker of the 8th Parliament in 2021 as the
              first Speaker chosen from the opposition in Ghana’s history, and re-elected to preside over the 9th
              Parliament in 2025.
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <a
                href="#media"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  background: 'var(--primary)', color: 'var(--primary-fg)', textDecoration: 'none', fontWeight: 600,
                  padding: '0.75rem 1.4rem', borderRadius: 999, fontSize: '0.9375rem',
                  transition: 'background 0.2s, transform 0.2s',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--primary-dark)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--primary)')}
              >
                Explore the media library <ArrowRight size={16} />
              </a>
              <a
                href="#biography"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  color: 'var(--p-text-1)', textDecoration: 'none', fontWeight: 600,
                  padding: '0.75rem 1.4rem', borderRadius: 999, fontSize: '0.9375rem',
                  border: '1px solid color-mix(in srgb, var(--foreground) 20%, transparent)', transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--foreground) 20%, transparent)')}
              >
                Read biography
              </a>
            </div>

            <div className="p-hero-facts" style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginTop: '2.75rem' }}>
              {FACTS.map(f => (
                <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 150 }}>
                  <span style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid var(--p-border)', background: 'var(--p-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                    <f.icon size={18} />
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--p-text-1)', fontFamily: 'var(--font-display), sans-serif' }}>{f.value}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--p-text-3)', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Portrait */}
          <div style={{ position: 'relative', justifySelf: 'center', width: '100%', maxWidth: 420, display: 'flex', justifyContent: 'center' }}>
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/8/8b/Speaker_Alban_Bagbin-2_%28cropped%29.jpg"
              alt="Alban Bagbin in 2021"
              width={400}
              height={500}
              style={{
                width: '100%', maxWidth: 400, borderRadius: 16, objectFit: 'cover', aspectRatio: '4/5',
                border: '1px solid var(--p-border-3)',
                boxShadow: 'var(--p-shadow), 0 0 0 1px color-mix(in srgb, var(--primary) 25%, transparent)',
              }}
            />
            <div style={{
              position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', width: '82%',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'color-mix(in srgb, var(--p-surface-2) 82%, transparent)', backdropFilter: 'blur(10px)', border: '1px solid var(--p-border-3)',
              borderRadius: 12, padding: '0.7rem 1rem',
            }}>
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--p-text-3)', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Incumbent since</div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--p-text-1)' }}>7 January 2021</div>
              </div>
              <Play size={20} style={{ color: 'var(--primary)' }} />
            </div>
          </div>
        </div>

        {/* Live counter bar */}
        <div style={{ borderTop: '1px solid var(--p-border)', background: 'var(--p-surface-3)' }}>
          <div className="p-section" style={{ maxWidth: 1180, margin: '0 auto', padding: '1.25rem 1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '1rem' }}>
            {([
              { label: 'Images in the library', count: mediaCount('images'), href: '/images', icon: ImageIcon, color: '#0084f8' },
              { label: 'Videos collected', count: mediaCount('videos'), href: '/videos', icon: Video, color: '#19d600' },
              { label: 'Audio files', count: mediaCount('audio'), href: '/audio', icon: Headphones, color: '#ff560a' },
              { label: 'News items', count: mediaCount('news'), href: '/news', icon: Newspaper, color: '#ff23fc' },
            ] satisfies { label: string; count: number; href: string; icon: LucideIcon; color: string }[]).map(c => (
              <Link key={c.label} href={c.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <c.icon size={22} style={{ color: c.color }} />
                  <div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-display), sans-serif', lineHeight: 1 }}>
                      {stats === null ? <Loader2 size={18} className="animate-spin" /> : c.count.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--p-text-3)', fontFamily: 'var(--font-mono), monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Institutions marquee ───────────────────────── */}
      <div className="marquee-paused" style={{ borderTop: '1px solid var(--p-border)', borderBottom: '1px solid var(--p-border)', overflow: 'hidden', padding: '1rem 0', background: 'var(--p-surface-2)' }}>
        <div className="marquee-track">
          {[...INSTITUTIONS, ...INSTITUTIONS].map((name, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingRight: '2.5rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--p-text-4)' }}>
              {name} <span style={{ color: 'var(--primary)' }}>◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Biography ──────────────────────────────────── */}
      <section id="biography" className="p-section" style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(4rem, 8vw, 6.5rem) 1.5rem' }}>
        <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>01 · Biography</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', marginTop: '1.25rem' }} className="grid-2-sm">
          <div>
            <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0 0 1.25rem', color: 'var(--p-text-1)' }}>
              A legislator for
              <br /> seven parliaments.
            </h2>
            <p style={{ color: 'var(--p-text-2)', lineHeight: 1.7, fontSize: '1rem' }}>
              Alban Sumana Kingsford Bagbin was born on <strong style={{ color: 'var(--p-text-1)' }}>24 September 1957</strong> to
              Sansunni Bagbin and Margaret B. Bagbin, both peasant farmers — the fourth of nine children. A member of the
              Dagaaba ethnic group, he hails from Sombo in the Upper West Region of Ghana.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { tag: 'Education', text: 'Attended Wa Secondary School and Tamale Secondary School. Earned a Bachelor of Arts in Law and English at the University of Ghana (1980), trained at the Ghana School of Law in Accra and was called to the bar in 1982. Later completed an Executive Master’s in Governance and Leadership at GIMPA.' },
              { tag: 'Career', text: 'Acting secretary to the Statistical Service Board (1980–82), personnel manager at the State Hotels Corporation (1982–83) and English teacher in Tripoli, Libya. Joined Akyem Chambers as an attorney on return to Ghana in 1986, rising to partner, and has been a partner at the Law Trust company since 1993.' },
              { tag: 'Personal life', text: 'Married to Alice Adjua Yornas Bagbin, a Programme Officer at the UNICEF Office in Ghana. He is a Christian and worships as a Roman Catholic.' },
            ].map((b, i) => (
              <div key={b.tag} style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 12, padding: '1.1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', color: 'var(--p-text-3)' }}>0{i + 1}</span>
                  <span style={{ fontWeight: 700, fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono), monospace', color: 'var(--primary)' }}>{b.tag}</span>
                </div>
                <p style={{ margin: 0, color: 'var(--p-text-2)', fontSize: '0.9rem', lineHeight: 1.6 }}>{b.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Career timeline ────────────────────────────── */}
      <section id="career" style={{ borderTop: '1px solid var(--p-border)', background: 'var(--p-surface-3)' }}>
        <div className="p-section" style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(4rem, 8vw, 6.5rem) 1.5rem' }}>
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>02 · Public service & political life</span>
          <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2rem, 4.5vw, 3rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '1rem 0 0.5rem', color: 'var(--p-text-1)' }}>
            Thirty years of
            <br /> parliamentary service.
          </h2>
          <p style={{ color: 'var(--p-text-3)', maxWidth: '40rem', margin: '0 0 2.5rem' }}>
            From constituency MP to the Speaker’s chair — the milestones of a career spanning every parliament of the Fourth Republic.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', gap: '1rem' }}>
            {TIMELINE.map((t, i) => (
              <div key={t.year} style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.5rem', transition: 'border-color 0.25s, transform 0.25s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 50%, transparent)'; e.currentTarget.style.transform = 'translateY(-3px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--p-border)'; e.currentTarget.style.transform = 'translateY(0)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>{t.year}</span>
                  <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', color: 'var(--p-text-4)' }}>0{i + 1}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--p-text-1)', marginBottom: '0.4rem', fontFamily: 'var(--font-display), sans-serif' }}>{t.title}</div>
                <p style={{ margin: 0, color: 'var(--p-text-2)', fontSize: '0.85rem', lineHeight: 1.55 }}>{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Media library ──────────────────────────────── */}
      <section id="media" className="p-section" style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(4rem, 8vw, 6.5rem) 1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>03 · Media library</span>
            <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2rem, 4.5vw, 3rem)', letterSpacing: '-0.03em', margin: '0.75rem 0 0', color: 'var(--p-text-1)' }}>
              Images, videos, audio & news.
            </h2>
          </div>
          <Link href="/images" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--p-text-1)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, borderBottom: '1px solid var(--primary)', paddingBottom: '0.25rem' }}>
            Browse everything <ArrowUpRight size={15} style={{ color: 'var(--primary)' }} />
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '1rem' }}>
          {/* Images — wide panel */}
          <Link href="/images" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.25rem', height: '100%', transition: 'border-color 0.25s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 50%, transparent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--p-border)')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(0,132,248,0.15)', color: '#0084f8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ImageIcon size={18} />
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '1.0625rem', fontFamily: 'var(--font-display), sans-serif', color: 'var(--p-text-1)' }}>Images</span>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.75rem', color: 'var(--primary)' }}>
                  {mediaCount('images').toLocaleString()} <ArrowUpRight size={14} />
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {(images.length ? images : Array.from({ length: 6 }) as (ImageItem | undefined)[]).map((img, i) => {
                  const src = img ? imgSrc(img) : null
                  return (
                    <div key={`img-${img?.id ?? i}`} style={{ aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: 'var(--p-img-bg)', border: '1px solid var(--p-border-2)' }}>
                      {src ? <img src={src} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                    </div>
                  )
                })}
              </div>
            </div>
          </Link>

          {/* Videos */}
          <Link href="/videos" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.25rem', height: '100%', transition: 'border-color 0.25s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 50%, transparent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--p-border)')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(25,214,0,0.15)', color: '#19d600', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Play size={16} fill="currentColor" />
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '1.0625rem', fontFamily: 'var(--font-display), sans-serif', color: 'var(--p-text-1)' }}>Videos</span>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.75rem', color: '#19d600' }}>
                  {mediaCount('videos').toLocaleString()} <ArrowUpRight size={14} />
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(videos.length ? videos : Array.from({ length: 4 }) as (VideoItem | undefined)[]).map((v, i) => (
                  <div key={`v-${v?.id ?? i}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid var(--p-border-2)', background: 'var(--p-surface-2)', borderRadius: 10, padding: '0.65rem 0.85rem' }}>
                    <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: 'rgba(25,214,0,0.12)', color: '#19d600', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Video size={15} />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--p-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v?.title || `Video #${v?.id ?? i + 1}`}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--p-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v?.channel || '—'} · {v?.source || 'source'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Link>

          {/* Audio */}
          <Link href="/audio" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.25rem', height: '100%', transition: 'border-color 0.25s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 50%, transparent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--p-border)')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,86,10,0.15)', color: '#ff560a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Headphones size={18} />
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '1.0625rem', fontFamily: 'var(--font-display), sans-serif', color: 'var(--p-text-1)' }}>Audio</span>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.75rem', color: 'var(--primary)' }}>
                  {mediaCount('audio').toLocaleString()} <ArrowUpRight size={14} />
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {(audioItems.length ? audioItems : Array.from({ length: 4 }) as (AudioItem | undefined)[]).map((a, i) => (
                  <div key={`a-${a?.id ?? i}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid var(--p-border-2)', background: 'var(--p-surface-2)', borderRadius: 10, padding: '0.65rem 0.85rem' }}>
                    <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: 'rgba(255,86,10,0.12)', color: '#ff560a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Play size={13} fill="currentColor" />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--p-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a?.title || `Audio #${a?.id ?? i + 1}`}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--p-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a?.artist || '—'} · {a?.source || 'source'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Link>

          {/* News */}
          <Link href="/news" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.25rem', height: '100%', transition: 'border-color 0.25s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 50%, transparent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--p-border)')}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,35,252,0.15)', color: '#ff23fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Newspaper size={17} />
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '1.0625rem', fontFamily: 'var(--font-display), sans-serif', color: 'var(--p-text-1)' }}>News</span>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.75rem', color: '#ff23fc' }}>
                  {mediaCount('news').toLocaleString()} <ArrowUpRight size={14} />
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }} className="grid-2-sm">
                {(news.length ? news : Array.from({ length: 4 }) as (NewsItem | undefined)[]).map((n, i) => (
                  <div key={`n-${n?.id ?? i}`}
                    style={{ border: '1px solid var(--p-border-2)', background: 'var(--p-surface-2)', borderRadius: 10, padding: '0.8rem 0.9rem' }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--p-text-1)', lineHeight: 1.4, marginBottom: '0.35rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {n?.title || `News item from ${n?.sourceName || 'the archives'}`}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', color: 'var(--p-text-3)' }}>
                      {n?.sourceName} · {n?.date?.slice(0, 10) || ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* ── CTA band ───────────────────────────────────── */}
      <section className="p-section" style={{ padding: '0 1.5rem 5rem' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', borderRadius: 20, position: 'relative', overflow: 'hidden', background: 'var(--p-cta-bg)', border: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)', padding: 'clamp(2.5rem, 5vw, 4rem)' }}>
          <div className="orb" style={{ position: 'absolute', top: -80, right: -60, width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,86,10,0.35), transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
            <div style={{ maxWidth: 560 }}>
              <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', color: 'var(--primary)', textTransform: 'uppercase' }}>The full archive</span>
              <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', letterSpacing: '-0.03em', margin: '0.5rem 0 0', color: 'var(--p-text-1)' }}>
                {stats ? `${stats.total.toLocaleString()} items collected across ${Object.keys(stats.sources).length || 'many'} sources.` : 'Everything collected, searchable in one place.'}
              </h2>
              <p style={{ color: 'var(--p-cta-text)', margin: '0.75rem 0 0', fontSize: '0.95rem', lineHeight: 1.6 }}>
                Images, videos, audio and news coverage on Rt. Hon. Alban S. K. Bagbin — maintained live in the OSINT portal.
              </p>
            </div>
            <div className="p-cta-buttons" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
              <Link href="/login" style={{ background: 'var(--primary)', color: 'var(--primary-fg)', textDecoration: 'none', fontWeight: 700, padding: '0.8rem 1.5rem', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                Open the portal <ArrowRight size={16} />
              </Link>
              <Link href="/search" style={{ border: '1px solid color-mix(in srgb, var(--foreground) 25%, transparent)', color: 'var(--p-text-1)', textDecoration: 'none', fontWeight: 600, padding: '0.8rem 1.5rem', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                Search everything
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--p-border)', background: 'var(--p-surface-2)' }}>
        <div className="p-section" style={{ maxWidth: 1180, margin: '0 auto', padding: '3rem 1.5rem 2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-fg)' }}>
                  <Landmark size={17} />
                </span>
                <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em', color: 'var(--p-text-1)' }}>AlbanBagbin</span>
              </div>
              <p style={{ color: 'var(--p-text-3)', fontSize: '0.85rem', lineHeight: 1.6, maxWidth: 320, margin: 0 }}>
                A public profile and media archive for Alban Sumana Kingsford Bagbin, Speaker of the Parliament of Ghana.
                Biographical content sourced from Wikipedia under CC BY-SA 4.0.
              </p>
            </div>
            {([
              { title: 'Profile', links: [['#biography', 'Biography'], ['#career', 'Career'], ['#media', 'Media library'], ['#news', 'News']] },
              { title: 'Explore', links: [['/images', 'Images'], ['/videos', 'Videos'], ['/audio', 'Audio'], ['/news', 'News']] },
            ]).map(col => (
              <div key={col.title}>
                <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.9rem' }}>{col.title}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                  {col.links.map(([href, label]) => (
                    <a key={href} href={href} style={{ color: 'var(--p-text-2)', textDecoration: 'none', fontSize: '0.875rem', transition: 'color 0.2s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--p-text-1)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--p-text-2)')}>
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '2.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--p-border)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', color: 'var(--p-text-4)' }}>
            <span>© {new Date().getFullYear()} AlbanBagbin Public Portal</span>
            <span>Speaker of the 8th & 9th Parliament · The Right Honourable Alban S. K. Bagbin</span>
          </div>
        </div>
      </footer>
    </div>
  )
}