import type { Metadata } from 'next'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'
import AskConsole from '@/components/AskConsole'
import { Sparkles } from 'lucide-react'

/**
 * /ask is a server component. The page owns the route metadata and the hero —
 * both of which a `"use client"` page cannot have, which is why this route used
 * to ship with the site-wide title and a hero that only existed in the client
 * bundle. The interactive half is `<AskConsole />`, imported as a client island.
 */

export const metadata: Metadata = {
  title: 'Ask the Archive · AlbanBagbin',
  description:
    'Question the Alban Bagbin digital library in plain language. Every answer is drawn from the published speeches, letters, papers, milestones and testimonials held in the archive, and links back to the item it came from.',
  alternates: { canonical: '/ask' },
}

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  // An answer is shareable: /ask?q=… reopens the page on that question, which is
  // also the only way back to it after a reload. Read on the server so the
  // question is in the first HTML response rather than arriving after hydration.
  const raw = (await searchParams).q
  const initialQuery = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 500) || null

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PublicHeader />

      <section
        id="content"
        style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)' }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(color-mix(in srgb, var(--p-text-1) 7%, transparent) 1px, transparent 1.6px)',
            backgroundSize: '26px 26px',
            maskImage: 'radial-gradient(900px 420px at 50% 0%, black, transparent 78%)',
            WebkitMaskImage: 'radial-gradient(900px 420px at 50% 0%, black, transparent 78%)',
          }}
        />
        <div
          style={{
            position: 'relative',
            maxWidth: 860,
            margin: '0 auto',
            padding: 'clamp(1.75rem, 3.5vw, 2.75rem) 1.5rem clamp(1.5rem, 3vw, 2rem)',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: '0.6875rem',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--primary)',
              border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)',
              background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
              padding: '0.375rem 0.75rem',
              borderRadius: 999,
            }}
          >
            <Sparkles size={12} aria-hidden /> Ask the archive
          </span>
          <h1
            style={{
              fontFamily: 'var(--font-display), sans-serif',
              fontSize: 'clamp(1.9rem, 4vw, 2.6rem)',
              letterSpacing: '-0.03em',
              lineHeight: 1.08,
              margin: '0.85rem 0 0.6rem',
              color: 'var(--p-text-1)',
            }}
          >
            Ask <span className="p-serif">the archive</span>
          </h1>
          <p
            style={{
              fontSize: '0.975rem',
              lineHeight: 1.6,
              color: 'var(--p-text-2)',
              maxWidth: '38rem',
              margin: 0,
            }}
          >
            Question the library — every answer is drawn from the speeches, letters,
            papers, milestones and testimonials held in this archive.
          </p>
        </div>
      </section>

      <AskConsole initialQuery={initialQuery} />

      <PublicFooter />
    </div>
  )
}
