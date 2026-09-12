import type { Metadata } from 'next'
import Link from 'next/link'
import { Clapperboard, FileAudio, ImageIcon, Landmark, Mic, Newspaper, Radio as RadioIcon, Video as VideoIcon, ArrowUpRight, Play, AudioLines, Globe2 } from 'lucide-react'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'
import { SOCIAL_LINKS } from '@/lib/man'

export const metadata: Metadata = {
  title: 'Media & Social',
  description: 'Photos, video, audio, news clippings and the social channels that connect the Speaker to Ghana and the world.',
}

export const dynamic = 'force-dynamic'

interface SocialLink {
  label: string
  href: string
  handle: string
  verified: boolean
  icon: (size: number) => React.ReactNode
}

const BRAND_PATHS: Record<string, string> = {
  facebook: 'M24 12.07C24 5.41 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z',
  x: 'M18.24 2.25h3.31l-7.23 8.26 7.6 10.24h-5.94l-4.66-6.1-5.33 6.1H3.7l7.9-9.03L4.37 2.25h6.1l4.36 5.77 4.9-5.77z',
  instagram: 'M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 01-1.38-.9 3.72 3.72 0 01-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63a5.9 5.9 0 00-2.13 1.38A5.9 5.9 0 00.63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.78.71 1.44 1.38 2.13a5.9 5.9 0 002.13 1.38c.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.9 5.9 0 002.13-1.38 5.9 5.9 0 001.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 00-1.38-2.13A5.9 5.9 0 0019.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1012 18.16 6.16 6.16 0 0012 5.84zm0 10.15a4 4 0 110-8 4 4 0 010 8zm7.85-10.4a1.44 1.44 0 11-2.88 0 1.44 1.44 0 012.88 0z',
  youtube: 'M23.5 6.19a3.02 3.02 0 00-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 00.5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 002.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 002.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z',
}

function BrandIcon({ paths, size }: { paths: string; size: number }) {
  const isMulti = paths.includes('zM') && paths.split('zM').length > 4
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {isMulti ? (
        <path d={paths} />
      ) : (
        <path d={paths} fillRule="evenodd" clipRule="evenodd" />
      )}
    </svg>
  )
}

function brandIcon(label: string, size: number): React.ReactNode {
  const key = label.trim().toLowerCase()
  if (key === 'x (twitter)' || key.includes('twitter')) return <BrandIcon paths={BRAND_PATHS.x} size={size} />
  if (key.includes('facebook')) return <BrandIcon paths={BRAND_PATHS.facebook} size={size} />
  if (key.includes('instagram')) return <BrandIcon paths={BRAND_PATHS.instagram} size={size} />
  if (key.includes('youtube')) return <BrandIcon paths={BRAND_PATHS.youtube} size={size} />
  return <Globe2 size={size} />
}

const SOCIAL_CARDS: SocialLink[] = [
  { label: 'Facebook', href: 'https://www.facebook.com/askbagbin', handle: 'Alban Bagbin', verified: true, icon: s => <BrandIcon paths={BRAND_PATHS.facebook} size={s} /> },
  { label: 'X (Twitter)', href: 'https://twitter.com/askbagbin', handle: '@askbagbin', verified: true, icon: s => <BrandIcon paths={BRAND_PATHS.x} size={s} /> },
  { label: 'Instagram', href: 'https://www.instagram.com/askbagbin', handle: 'askbagbin', verified: true, icon: s => <BrandIcon paths={BRAND_PATHS.instagram} size={s} /> },
  { label: 'YouTube', href: 'https://www.youtube.com/@askbagbin', handle: 'Alban Bagbin', verified: true, icon: s => <BrandIcon paths={BRAND_PATHS.youtube} size={s} /> },
]

const MEDIA_CARDS = [
  { href: '/archives/photos', label: 'Photo Library', note: 'Official and historical photographs, curated by year, event and theme.', icon: ImageIcon, countLabel: 'Collection' },
  { href: '/videos', label: 'Videos', note: 'Speeches, interviews and parliamentary moments captured on camera.', icon: VideoIcon, countLabel: 'Trusted clips' },
  { href: '/audio', label: 'Audio', note: 'Radio engagements, interviews and audio recordings.', icon: AudioLines, countLabel: 'Recordings' },
  { href: '/news', label: 'News', note: 'Press clippings and coverage across Ghanaian and international media.', icon: Newspaper, countLabel: 'Clippings' },
]

export default function MediaPage() {
  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh' }}>
      <PublicHeader />

      {/* ── Hero ── */}
      <section style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)' }}>
        <div className="grid-bg" style={{ position: 'absolute', inset: 0 }} />
        <div style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: 'clamp(3rem, 5vw, 4.5rem) 1.5rem' }}>
          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>Media & Social</span>
          <h1 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(2.25rem, 5vw, 3.25rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.75rem 0 1rem' }}>
            The moving record, heard and seen
          </h1>
          <p style={{ fontSize: '1rem', lineHeight: 1.6, color: 'var(--p-text-2)', maxWidth: '38rem', margin: 0 }}>
            Photographs, film, sound and the clippings of public conversation — gathered here so the legacy can be watched, listened to and read, not just listed.
          </p>
        </div>
      </section>

      <main style={{ maxWidth: 1180, margin: '0 auto', padding: 'clamp(2.5rem, 5vw, 4rem) 1.5rem' }}>
        {/* Media collection tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))', gap: '1rem', marginBottom: '3rem' }}>
          {MEDIA_CARDS.map(c => (
            <Link key={c.href} href={c.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="p-card-lift" style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 16, padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <span style={{ width: 42, height: 42, borderRadius: 12, background: 'color-mix(in srgb, var(--primary) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                    <c.icon size={19} />
                  </span>
                  <ArrowUpRight size={16} style={{ color: 'var(--p-text-3)' }} />
                </div>
                <div style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-display), sans-serif', color: 'var(--p-text-1)', marginBottom: '0.4rem' }}>{c.label}</div>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--p-text-3)', lineHeight: 1.55, flex: 1 }}>{c.note}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Social channels */}
        <section className="p-connector-card" style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 16, padding: '2rem', marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <Globe2 size={16} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono), monospace', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>On the platforms</span>
          </div>
          <h2 style={{ fontFamily: 'var(--font-display), sans-serif', fontSize: 'clamp(1.5rem, 3vw, 2rem)', margin: '0.5rem 0' }}>Follow the official channels</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--p-text-3)', maxWidth: '38rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
            The digital library mirrors the public record of these accounts. Official statements and announcements first appear here on the verified channels.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))', gap: '0.75rem' }}>
            {SOCIAL_CARDS.map(s => (
              <a key={s.href} href={s.href} target="_blank" rel="noopener noreferrer"
                className="p-card-lift"
                style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', textDecoration: 'none', color: 'var(--p-text-2)', border: '1px solid var(--p-border)', background: 'var(--p-surface-2)', borderRadius: 12, padding: '0.85rem 1rem' }}>
                <span style={{ width: 32, height: 32, borderRadius: 999, background: 'var(--p-surface-3)', border: '1px solid var(--p-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                  {s.icon(15)}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{s.label}</span>
              </a>
            ))}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
