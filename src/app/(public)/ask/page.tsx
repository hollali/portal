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
    <div className="ask-page-root">
      <PublicHeader />

      <div id="content" className="ask-page-main">
        <header className="ask-page-heading">
          <p className="ask-page-kicker"><Sparkles size={14} aria-hidden /> Archive research</p>
          <h1>Ask the archive</h1>
          <p>Search in plain language. Every answer links back to published records.</p>
        </header>
        <AskConsole initialQuery={initialQuery} />
      </div>

      <PublicFooter />
    </div>
  )
}
