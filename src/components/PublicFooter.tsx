import Link from 'next/link'
import { Landmark } from 'lucide-react'
import { SOCIAL_LINKS } from '@/lib/man'

const FOOTER_COLS: { title: string; links: [string, string][] }[] = [
  {
    title: 'The Man',
    links: [
      ['/the-man#early-life', 'Early Life'],
      ['/the-man#education', 'Education'],
      ['/the-man#professional-life', 'Professional Life'],
      ['/the-man#values', 'Personal Values'],
    ],
  },
  {
    title: 'Archives',
    links: [
      ['/archives/speeches', 'Speeches'],
      ['/archives/papers', 'Public Papers'],
      ['/archives/interviews', 'Interviews'],
      ['/archives/notes', 'Notes & Correspondence'],
      ['/archives/milestones', 'Milestones'],
      ['/archives/testimonials', 'Testimonials'],
      ['/archives/photos', 'Photo Library'],
    ],
  },
  {
    title: 'Explore',
    links: [
      ['/timeline', 'Timeline'],
      ['/videos', 'Videos'],
      ['/audio', 'Audio'],
      ['/news', 'News Clippings'],
      ['/search', 'Search'],
    ],
  },
]

function FacebookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

function YoutubeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z" />
    </svg>
  )
}

export default function PublicFooter() {
  const icon = (label: string) => {
    switch (label) {
      case 'Facebook': return <FacebookIcon />
      case 'X (Twitter)': return <XIcon />
      case 'Instagram': return <InstagramIcon />
      case 'YouTube': return <YoutubeIcon />
      default: return null
    }
  }
  const social = SOCIAL_LINKS.filter(s => icon(s.label))

  return (
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
            <p style={{ color: 'var(--p-text-3)', fontSize: '0.85rem', lineHeight: 1.6, maxWidth: 320, margin: '0 0 1.25rem' }}>
              The digital library of Rt. Hon. Alban Sumana Kingsford Bagbin — Speaker of the Parliament of Ghana. Speeches, papers, correspondence, photographs and milestones from a thirty-year public career.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {social.map(s => (
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                  className="p-chip"
                  style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--p-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--p-text-3)', textDecoration: 'none' }}>
                  {icon(s.label)}
                </a>
              ))}
            </div>
          </div>
          {FOOTER_COLS.map(col => (
            <div key={col.title}>
              <div style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.9rem' }}>{col.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {col.links.map(([href, label]) => (
                  <Link key={href} href={href} className="p-link-strong" style={{ color: 'var(--p-text-2)', textDecoration: 'none', fontSize: '0.875rem' }}>
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '2.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--p-border)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '1rem', fontFamily: 'var(--font-mono), monospace', fontSize: '0.6875rem', color: 'var(--p-text-4)' }}>
          <span>© {new Date().getFullYear()} AlbanBagbin Digital Library</span>
          <span>Rt. Hon. Alban S. K. Bagbin · Speaker, Parliament of Ghana</span>
        </div>
      </div>
    </footer>
  )
}