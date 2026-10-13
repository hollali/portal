import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowUpRight } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getSectionData } from '@/lib/libraryQueries'
import type { PageHeroData } from '@/lib/content'
import PublicHeader from '@/components/PublicHeader'
import PublicFooter from '@/components/PublicFooter'

// CMS image URLs may come from arbitrary editor-configured hosts, so use a
// native image element rather than Next's host-restricted image optimizer.
/* eslint-disable @next/next/no-img-element */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Timeline · AlbanBagbin',
  description: 'A chronological view of the life and public career of Rt. Hon. Alban Bagbin.',
}

const CATEGORY_LABEL: Record<string, string> = {
  'early-life': 'Early Life',
  education: 'Education',
  career: 'Career & Politics',
  parliament: 'Parliament',
  national: 'National Service',
}

// Temporary local illustrations for key entries until editors add milestone-
// specific images in the CMS. CMS values always take precedence.
const TIMELINE_IMAGE_FALLBACKS: Record<string, { src: string; alt: string }> = {
  'University of Ghana, Legon': {
    src: '/media/alumni-spotlight/alban-bagbin-spotlight.jpeg',
    alt: 'Alban Bagbin at a University of Ghana Alumni Association event; illustrative image.',
  },
  'Elected to Parliament': {
    src: '/images/bagbin-speaker.jpg',
    alt: 'Portrait of Alban Bagbin; illustrative image for his first election to Parliament.',
  },
  'Speaker of the 8th Parliament': {
    src: '/images/bagbin-speaker.jpg',
    alt: 'Portrait of Alban Bagbin; illustrative image for his election as Speaker.',
  },
}

export default async function TimelinePage() {
  const rows = await prisma.milestone.findMany({
    where: { status: 'published' },
    orderBy: [{ year: 'asc' }, { order: 'asc' }],
  })

  const entries = rows.map(r => {
    const fallback = TIMELINE_IMAGE_FALLBACKS[r.title]
    return {
      ...r,
      period: r.period || r.year,
      label: CATEGORY_LABEL[r.category || 'career'] || 'Career',
      imageUrl: r.imageUrl || fallback?.src,
      imageAlt: r.imageAlt || fallback?.alt || r.title,
    }
  })

  const firstYear = entries[0]?.year || '1957'
  const lastYear = entries[entries.length - 1]?.year || '2025'
  const hero = await getSectionData<PageHeroData>('hero_timeline')

  return (
    <div className="timeline-page">
      <PublicHeader />

      <main id="content">
        <section className="timeline-hero">
          <div className="timeline-hero-grid" aria-hidden="true" />
          <div className="timeline-hero-inner">
            <div className="timeline-hero-copy">
              <span className="timeline-eyebrow">{hero.eyebrow}</span>
              <h1>{hero.titleA} <span className="p-serif">{hero.titleAccent}</span></h1>
              <p>
                {hero.lede}
              </p>
              <div className="timeline-hero-meta" aria-label={`${entries.length} milestones from ${firstYear} to ${lastYear}`}>
                <div className="timeline-hero-stat">
                  <strong>{entries.length}</strong>
                  <span>milestones</span>
                </div>
                <span className="timeline-hero-divider" aria-hidden="true" />
                <div className="timeline-hero-stat">
                  <strong>{firstYear}—{lastYear}</strong>
                  <span>in public life</span>
                </div>
              </div>
              <Link className="timeline-hero-link" href="/archives/milestones">
                Explore the milestones archive <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>

            <figure className="timeline-hero-portrait">
              <img
                src="/images/bagbin-speaker.jpg"
                alt="Portrait of Rt. Hon. Alban Bagbin"
                fetchPriority="high"
                decoding="async"
              />
              <figcaption>
                <span className="timeline-portrait-mark" aria-hidden="true" />
                <span><strong>Rt. Hon. Alban S. K. Bagbin</strong><small>Speaker of the Parliament of Ghana</small></span>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="timeline-section" aria-labelledby="timeline-heading">
          <header className="timeline-section-heading">
            <div>
              <span className="timeline-eyebrow">The journey</span>
              <h2 id="timeline-heading">Milestones through the years</h2>
            </div>
            <p>Each chapter is part of a larger story of service, leadership and parliamentary life.</p>
          </header>

          {entries.length === 0 ? (
            <div className="timeline-empty">
              <span className="timeline-empty-year">1957—</span>
              <h3>The timeline is taking shape</h3>
              <p>Published milestones will appear here as they are added to the archive.</p>
              <Link href="/archives/milestones">Visit the milestones archive <ArrowUpRight size={15} aria-hidden="true" /></Link>
            </div>
          ) : (
            <ol className="timeline-list">
              {entries.map(e => (
                <li key={e.id} className="timeline-item">
                  <div className="timeline-marker" aria-hidden="true" />
                  <article className={`timeline-card${e.imageUrl ? ' has-image' : ''}`}>
                    <div className="timeline-card-copy">
                      <div className="timeline-card-meta">
                        <time className="timeline-year">{e.period}</time>
                        <span className="timeline-category">{e.label}</span>
                      </div>
                      <h3>{e.title}</h3>
                      {e.description && <p>{e.description}</p>}
                    </div>
                    {e.imageUrl && (
                      <figure className="timeline-card-image">
                        <img
                          src={e.imageUrl}
                          alt={e.imageAlt || e.title}
                          loading="lazy"
                          decoding="async"
                        />
                      </figure>
                    )}
                  </article>
                </li>
              ))}
            </ol>
          )}

          {entries.length > 0 && (
            <footer className="timeline-section-footer">
              <span>Explore the records behind these milestones</span>
              <Link href="/archives/milestones">Browse all milestones <ArrowUpRight size={15} aria-hidden="true" /></Link>
            </footer>
          )}
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
