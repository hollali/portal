import type { Metadata } from 'next'
import PublicHeader from '@/components/PublicHeader'

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
      <main style={{ maxWidth: 1180, margin: '0 auto', padding: '2rem 1.5rem 4rem' }} className="p-section">
        {children}
      </main>
      <footer style={{ borderTop: '1px solid var(--p-border)', background: 'var(--p-surface-2)' }}>
        <div className="p-section" style={{ maxWidth: 1180, margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--p-text-3)' }}>
            © {new Date().getFullYear()} AlbanBagbin · Public profile & media archive
          </span>
        </div>
      </footer>
    </div>
  )
}
