import type { Metadata } from 'next'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'
import AskConsole from '@/components/AskConsole'
import { Sparkles } from 'lucide-react'
import { GUIDE_LABEL } from '@/lib/guideLines'
import { guideEnabled } from '@/lib/askGuide'

/**
 * /ask is a server component. The page owns the route metadata and the hero —
 * both of which a `"use client"` page cannot have, which is why this route used
 * to ship with the site-wide title and a hero that only existed in the client
 * bundle. The interactive half is `<AskConsole />`, imported as a client island.
 *
 * It also owns one decision the client must not: whether the animated guide
 * exists at all. That is a setting an administrator can change, and reading it
 * here means a request for the likeness to be removed takes effect on the next
 * page load rather than the next deploy.
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

  const guide = await guideEnabled()
  // The photograph stays off until the Speaker's office approves it in writing.
  // Set ASK_PORTRAIT=on in the environment only after that approval is on file.
  const portrait = process.env.ASK_PORTRAIT === 'on'

  return (
    <div style={{ background: 'var(--p-bg)', color: 'var(--p-text-1)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PublicHeader />

      <section
        id="content"
        className="ask-research-header"
        style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)' }}
      >
        <div
          className="ask-research-header-inner"
        >
          <div className="ask-research-kicker">
            <Sparkles size={13} aria-hidden /> Digital archive / Research desk
          </div>
          <div className="ask-research-heading">
            <div>
              <h1>Ask <span className="p-serif">the archive.</span></h1>
              <p>Search the published record in plain language. Every answer stays connected to the evidence that supports it.</p>
            </div>
            <div className="ask-research-meta" aria-label="Archive search principles">
              <span><b>01</b> Search published records</span>
              <span><b>02</b> Review the strongest matches</span>
              <span><b>03</b> Open the source</span>
            </div>
          </div>
          {guide && <p className="ask-research-disclosure">{GUIDE_LABEL}</p>}
        </div>
      </section>

      <AskConsole initialQuery={initialQuery} guide={guide} portrait={portrait} />

      <PublicFooter />
    </div>
  )
}
