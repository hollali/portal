import type { Metadata } from 'next'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'

export const metadata: Metadata = {
  title: {
    default: 'Media Library',
    template: '%s · AlbanBagbin',
  },
}

export default function MediaLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh' }}>
      <PublicHeader />
      <main id="content" style={{ maxWidth: 1180, margin: '0 auto', padding: '2rem 1.5rem 4rem' }} className="p-section">
        {children}
      </main>
      {/* Not a bare copyright line: on mobile the header collapses into the
          drawer, so this footer is one of the few permanently visible places
          to reach the rest of the library from /videos, /news or /search. */}
      <PublicFooter />
    </div>
  )
}
