import type { Metadata } from 'next'
import PublicHeader from '@/components/PublicHeader'
import AskConsole from '@/components/AskConsole'
import { getSectionData } from '@/lib/libraryQueries'
import type { PageHeroData } from '@/lib/content'
import { Sparkles } from 'lucide-react'

/**
 * /ask is a server component. The page owns the route metadata and the hero —
 * both of which a `"use client"` page cannot have, which is why this route used
 * to ship with the site-wide title and a hero that only existed in the client
 * bundle. The interactive half is `<AskConsole />`, imported as a client island.
 */

export const metadata: Metadata = {
  title: 'Ask about the man · AlbanBagbin',
  description:
    'A database-backed conversation about Rt. Hon. Alban Bagbin — his life, education, career, ideas, Speakership and public record. Answers link back to the source they came from.',
  alternates: { canonical: '/ask' },
}

export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const raw = (await searchParams).q
  const initialQuery = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 500) || null
  const hero = await getSectionData<PageHeroData>('hero_ask')

  return (
    <div className="ask-page-root">
      <PublicHeader />

      <main id="content" className="ask-page-main">
        <div className="ask-page-heading">
          <span className="ask-page-avatar" aria-hidden>
            <Sparkles size={24} />
          </span>
          <p className="ask-page-kicker">{hero.eyebrow}</p>
          <h1>{hero.titleA} <span className="p-serif">{hero.titleAccent}</span></h1>
          {hero.lede ? <p>{hero.lede}</p> : null}
        </div>
        <AskConsole initialQuery={initialQuery} />
      </main>
    </div>
  )
}