'use client'

/* The hash effect hydrates browser-owned navigation state after mount. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileSearch,
  FileText,
  Globe2,
  History,
  Info,
  Landmark,
  Layers,
  Library,
  Link2,
  Mic,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/kit'
import type { PageHeroData } from '@/lib/content'

export interface PublicSource {
  recordId: string
  title: string
  originalUrl: string
  downloadUrl: string | null
  publicationDate: string | null
  sittingDate: string | null
  accessedDate: string
  documentType: string
  termOrSession: string | null
  persons: string[]
  locator: string | null
  summary: string
  relevance: string
  verificationStatus: string
  notes: string | null
}

export interface PublicEvent {
  eventId: string
  startDate: string | null
  endDate: string | null
  type: string
  description: string
  attribution: string
  evidenceStatus: string
  notes: string | null
  sourceLinks: Array<Pick<PublicSource, 'recordId' | 'title' | 'originalUrl' | 'verificationStatus'>>
  newsLinks: Array<{ id: number; title: string | null; url: string | null; sourceName: string | null }>
}

type View = 'timeline' | 'sources'
type SortKey = 'chrono-asc' | 'chrono-desc' | 'az'

const PAGE_SIZE_OPTIONS = [10, 20, 50]
const ALL = 'All'

/* ── Taxonomy ─────────────────────────────────────────── */

function eventCategory(event: PublicEvent) {
  const value = `${event.type} ${event.description}`.toLowerCase()
  if (/election|parliamentary entry|speaker tenure|historical leadership|minority leader|majority leader|deputy speaker/.test(value)) return 'Career & representation'
  if (/committee|bill|legislation|standing order|parliamentary report/.test(value)) return 'Committees & legislation'
  if (/ruling|admissib|court|formal communication|interpretation/.test(value)) return 'Speaker decisions'
  if (/ipu|apnac|cos[p]?al|african group|diplomatic|international|g itfic|gitfic|parliamentary union|assembly|bilateral/.test(value)) return 'International & diplomatic'
  if (/speech|address|lecture|statement|forum|press freedom/.test(value)) return 'Speeches & policy'
  return 'Public & community engagement'
}

function sourceCategory(source: PublicSource) {
  const value = `${source.documentType} ${source.title} ${source.originalUrl}`.toLowerCase()
  if (/election/.test(value)) return 'Elections & representation'
  if (/committee|bill|hansard|order paper|votes|proceedings|report/.test(value)) return 'Parliamentary records'
  if (/speech|address|lecture|remarks|communication/.test(value)) return 'Speeches & communications'
  if (/parliament\.gh\/news|news release|press release/.test(value)) return 'Parliament news'
  if (/ipu|cpa|united nations|african group|apnac|gna|graphic|citinewsroom|ghana news|3news/.test(value)) return 'External institutions & media'
  return 'Institutional & historical sources'
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Career & representation': Landmark,
  'Committees & legislation': Layers,
  'Speaker decisions': Scale,
  'International & diplomatic': Globe2,
  'Speeches & policy': Mic,
  'Public & community engagement': Users,
  'Elections & representation': BadgeCheck,
  'Parliamentary records': Library,
  'Speeches & communications': Mic,
  'Parliament news': FileText,
  'External institutions & media': Globe2,
  'Institutional & historical sources': History,
}

/* ── Evidence tiers: the trust system, made legible ──── */

type EvidenceTier = 'verified' | 'official' | 'indexed'

function evidenceTier(status: string): EvidenceTier {
  const s = status.toLowerCase()
  if (/direct/.test(s)) return 'verified'
  if (/official|hansard|attribution/.test(s)) return 'official'
  return 'indexed'
}

const TIER_META: Record<EvidenceTier, { label: string; tone: 'success' | 'info' | 'warning'; Icon: LucideIcon; hint: string }> = {
  verified: { label: 'Directly verified', tone: 'success', Icon: ShieldCheck, hint: 'Opened and inspected first-hand' },
  official: { label: 'Official / attributed', tone: 'info', Icon: BadgeCheck, hint: 'Parliament or office record, attributed' },
  indexed: { label: 'Index lead', tone: 'warning', Icon: ShieldAlert, hint: 'Found in search index, not yet opened' },
}

function sourceTier(source: PublicSource): EvidenceTier {
  const s = source.verificationStatus.toLowerCase()
  if (/directly_inspected/.test(s)) return 'verified'
  if (/unavailable/.test(s)) return 'indexed'
  return 'indexed'
}

function yearOf(value: string | null): string {
  if (!value) return 'Undated'
  const m = value.match(/\d{4}/)
  return m ? m[0] : 'Undated'
}

function dateLabel(event: PublicEvent): string {
  if (!event.startDate) return 'Date not established'
  if (event.endDate && event.endDate !== event.startDate) return `${event.startDate} – ${event.endDate}`
  return event.startDate
}

function isKeyMoment(event: PublicEvent): boolean {
  return /speaker tenure|speaker \/ new parliament|parliamentary entry|general election/i.test(event.type)
}

/* ── Component ────────────────────────────────────────── */

export default function SpeakerResearchExplorer({
  sources,
  events,
  hero,
  accessedDate,
  cutoffDate,
  pagesInspected,
  indexOnlySources,
  scopeStatement,
}: {
  sources: PublicSource[]
  events: PublicEvent[]
  hero: PageHeroData
  accessedDate: string
  cutoffDate: string
  pagesInspected: number
  indexOnlySources: number
  scopeStatement: string
}) {
  const [view, setView] = useState<View>('timeline')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(ALL)
  const [tier, setTier] = useState<EvidenceTier | typeof ALL>(ALL)
  const [sort, setSort] = useState<SortKey>('chrono-asc')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [legendOpen, setLegendOpen] = useState(false)
  const hashHandled = useRef(false)

  // A citation from /ask links straight to one source or event. The explorer is
  // paginated, so the target can be on a page the default view never renders;
  // honour the hash by switching to the right tab and page before scrolling.
  useEffect(() => {
    if (hashHandled.current) return;
    const raw = window.location.hash.slice(1);
    if (!raw) return;
    let id: string;
    try {
      id = decodeURIComponent(raw);
    } catch {
      return;
    }
    const isSource = id.startsWith('source-');
    const isEvent = id.startsWith('event-');
    if (!isSource && !isEvent) return;
    hashHandled.current = true;

    const list: Array<{ recordId: string } | { eventId: string }> = isSource ? sources : events;
    const key = isSource ? 'recordId' : 'eventId';
    const index = list.findIndex(item => `${isSource ? 'source' : 'event'}-${(item as Record<string, string>)[key]}` === id);
    setView(isSource ? 'sources' : 'timeline');
    setSearch('');
    setCategory(ALL);
    setTier(ALL);
    setSort('chrono-asc');
    if (index >= 0) setPage(Math.floor(index / perPage) + 1);

    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'center' });
    }, 60);
    return () => window.clearTimeout(timer);
  }, [events, sources, perPage])

  const categories = useMemo(() => {
    const labels = view === 'timeline' ? events.map(eventCategory) : sources.map(sourceCategory)
    return [ALL, ...Array.from(new Set(labels)).sort()]
  }, [events, sources, view])

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    const pool = view === 'timeline' ? events.map(e => eventCategory(e)) : sources.map(s => sourceCategory(s))
    for (const c of pool) map.set(c, (map.get(c) ?? 0) + 1)
    return map
  }, [events, sources, view])

  const term = search.trim().toLowerCase()
  const hasFilters = term !== '' || category !== ALL || tier !== ALL

  const filteredEvents = useMemo(() => {
    const out = events.filter(event => {
      if (category !== ALL && eventCategory(event) !== category) return false
      if (tier !== ALL && evidenceTier(event.evidenceStatus) !== tier) return false
      if (!term) return true
      return [event.eventId, event.type, event.description, event.attribution, event.evidenceStatus, yearOf(event.startDate),
        ...event.sourceLinks.map(l => `${l.recordId} ${l.title}`),
        ...event.newsLinks.map(l => l.title || '')].some(v => v.toLowerCase().includes(term))
    })
    return [...out].sort((a, b) => {
      if (sort === 'az') return a.type.localeCompare(b.type)
      const ya = yearOf(a.startDate); const yb = yearOf(b.startDate)
      if (ya === yb) return a.eventId.localeCompare(b.eventId)
      if (ya === 'Undated') return 1
      if (yb === 'Undated') return -1
      return sort === 'chrono-asc' ? ya.localeCompare(yb) : yb.localeCompare(ya)
    })
  }, [events, category, tier, term, sort])

  const filteredSources = useMemo(() => {
    const rank: Record<EvidenceTier, number> = { verified: 0, official: 1, indexed: 2 }
    const out = sources.filter(source => {
      if (category !== ALL && sourceCategory(source) !== category) return false
      if (tier !== ALL && sourceTier(source) !== tier) return false
      if (!term) return true
      return [source.recordId, source.title, source.originalUrl, source.documentType, source.summary, source.relevance, source.verificationStatus, ...source.persons]
        .some(v => (v || '').toLowerCase().includes(term))
    })
    return [...out].sort((a, b) => {
      if (sort === 'az') return a.title.localeCompare(b.title)
      const ta = rank[sourceTier(a)]; const tb = rank[sourceTier(b)]
      if (ta !== tb) return ta - tb
      return (b.publicationDate || '').localeCompare(a.publicationDate || '')
    })
  }, [sources, category, tier, term, sort])

  const records = view === 'timeline' ? filteredEvents : filteredSources
  const totalPages = Math.max(1, Math.ceil(records.length / perPage))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * perPage
  const visible = records.slice(pageStart, pageStart + perPage)

  const groupedYears = useMemo(() => {
    if (view !== 'timeline') return []
    const groups = new Map<string, PublicEvent[]>()
    for (const r of visible as PublicEvent[]) {
      const y = yearOf(r.startDate)
      if (!groups.has(y)) groups.set(y, [])
      groups.get(y)!.push(r)
    }
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === 'Undated') return 1
      if (b === 'Undated') return -1
      return sort === 'chrono-asc' ? a.localeCompare(b) : b.localeCompare(a)
    })
  }, [visible, view, sort])

  const resetAll = () => { setSearch(''); setCategory(ALL); setTier(ALL); setSort('chrono-asc'); setPage(1) }
  const changeView = (next: View) => { setView(next); setCategory(ALL); setTier(ALL); setPage(1) }

  const verifiedCount = sources.filter(s => sourceTier(s) === 'verified').length

  return (
    <>
      <style>{`
        .sr-toolbar { position: static; z-index: auto; }
        .sr-toolbar-inner { max-width: 1180px; margin: 0 auto; padding: 0.8rem 1.5rem; display: flex; flex-direction: column; gap: 0.7rem; }
        .sr-row-top { display: flex; flex-wrap: wrap; gap: 0.7rem; align-items: center; justify-content: space-between; }
        .sr-viewswitch { display: inline-flex; padding: 4px; gap: 4px; border: 1px solid var(--p-border); border-radius: 12px; background: var(--p-surface); }
        .sr-searchrow { display: flex; gap: 0.55rem; align-items: center; flex-wrap: wrap; flex: 1 1 auto; justify-content: flex-end; }
        .sr-searchwrap { position: relative; flex: 1 1 240px; max-width: 380px; min-width: 0; }
        .sr-chiprow { scrollbar-width: thin; -webkit-overflow-scrolling: touch; }
        .sr-chiprow::-webkit-scrollbar { height: 6px; }
        .sr-filters-row { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; justify-content: space-between; }
        .sr-grid-sources { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
        .sr-year-head { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.9rem; }
        .sr-timeline-item { position: relative; padding-left: 2.1rem; }
        .sr-proof-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 34ch; }
        .sr-source-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0.55rem 1rem; margin: 0.4rem 0 0; padding-top: 0.75rem; border-top: 1px solid var(--p-border); font-size: 0.76rem; color: var(--p-text-3); }
        .sr-source-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.25rem; align-items: center; }
        .sr-pager { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.75rem; margin-top: 1.5rem; padding-top: 1.1rem; border-top: 1px solid var(--p-border); color: var(--p-text-3); font-size: 0.78rem; }
        .sr-pager-controls { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
        .sr-hero-inner { position: relative; max-width: 1180px; margin: 0 auto; padding: clamp(2.5rem,5vw,3.75rem) 1.5rem 2rem; }
        @media (max-width: 900px) {
          .sr-grid-sources { grid-template-columns: 1fr; }
          .sr-hero-stats { grid-template-columns: 1fr 1fr !important; }
        }
        .sr-results { max-width: 1180px; margin: 0 auto; }
        .sr-method-wrap { max-width: 1180px; margin: 0 auto; }
        @media (max-width: 760px) {
          .sr-toolbar-inner { padding: 0.7rem 1rem; gap: 0.6rem; }
          .sr-hero-inner { padding: 2rem 1rem 1.5rem; }
          .sr-row-top { flex-direction: column; align-items: stretch; }
          .sr-viewswitch { display: grid; grid-template-columns: 1fr 1fr; width: 100%; }
          .sr-viewswitch button { justify-content: center; }
          .sr-searchrow { width: 100%; justify-content: stretch; }
          .sr-searchwrap { flex: 1 1 100%; max-width: none; width: 100%; }
          .sr-searchrow select { flex: 1 1 100%; width: 100%; min-height: 42px; }
          .sr-filters-row { flex-direction: column; align-items: stretch; }
          .sr-chiprow { flex: 1 1 100%; width: 100%; margin: 0 -1rem; padding: 2px 1rem 6px; }
          .sr-chiprow button { min-height: 40px; }
          .sr-filters-side { display: flex; gap: 0.5rem; width: 100%; }
          .sr-filters-side select { flex: 1 1 auto; min-width: 0; min-height: 42px; }
          .sr-year-head { position: static; }
          .sr-timeline-item { padding-left: 1.7rem; }
          .sr-proof-label { max-width: none; white-space: normal; }
          .sr-source-meta { grid-template-columns: 1fr; }
          .sr-source-actions a { flex: 1 1 auto; justify-content: center; }
          .sr-pager { flex-direction: column; align-items: stretch; text-align: center; }
          .sr-pager-controls { justify-content: center; width: 100%; }
          .sr-results { padding: 1.25rem 1rem 0.75rem !important; }
          .sr-method-wrap { padding: 0 1rem 2rem !important; }
          .sr-timeline-card { padding: 0.95rem !important; }
        }
        @media (max-width: 560px) {
          .sr-hero-stats { grid-template-columns: 1fr 1fr !important; gap: 0.6rem !important; }
          .sr-stat { padding: 0.7rem 0.75rem !important; }
        }
        @media (max-width: 400px) {
          .sr-hero-stats { grid-template-columns: 1fr !important; }
          .sr-pager-controls select { flex: 1 1 100%; width: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sr-chiprow { scroll-behavior: auto; }
        }
      `}</style>

      {/* ── Breadcrumb + hero ─────────────────────────── */}
      <section id="content" style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--p-border)' }}>
        
        <div className="sr-hero-inner">
          <nav aria-label="Breadcrumb" style={{ marginBottom: '1rem', fontSize: '0.78rem', color: 'var(--p-text-4)' }}>
            <Link href="/archives" style={{ color: 'var(--p-text-3)', textDecoration: 'none' }}>Archives</Link>
            <span aria-hidden="true" style={{ margin: '0 0.45rem' }}>›</span>
            <span aria-current="page" style={{ color: 'var(--p-text-1)', fontWeight: 600 }}>Speaker Record</span>
          </nav>

          <p style={{ margin: 0, fontFamily: 'var(--font-mono),monospace', fontSize: '0.6875rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--primary)' }}>
            {hero.eyebrow}
          </p>
          <h1 style={{ fontFamily: 'var(--font-display),sans-serif', fontSize: 'clamp(2.1rem,5vw,3.1rem)', letterSpacing: '-0.03em', lineHeight: 1.05, margin: '0.7rem 0 0.9rem', maxWidth: '20ch' }}>
            {hero.titleA} <span className="p-serif">{hero.titleAccent}</span>
          </h1>
          <p style={{ fontSize: '1rem', lineHeight: 1.65, color: 'var(--p-text-2)', maxWidth: '46rem', margin: 0 }}>
            {hero.lede}
          </p>

          {/* Trust strip */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem 1rem', alignItems: 'center', marginTop: '1.1rem', fontSize: '0.78rem', color: 'var(--p-text-3)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <CalendarDays size={13} aria-hidden="true" /> Cut-off {cutoffDate} · Accessed {accessedDate}
            </span>
            <button
              type="button"
              onClick={() => setLegendOpen(o => !o)}
              aria-expanded={legendOpen}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: 'none', border: '1px solid var(--p-border)', borderRadius: 999, padding: '0.3rem 0.7rem', color: 'var(--p-text-2)', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600 }}
            >
              <Info size={13} aria-hidden="true" /> How to read evidence
            </button>
            <a href="https://www.parliament.gh/gen?CM" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
              Official Speaker history <ExternalLink size={13} aria-hidden="true" />
            </a>
          </div>

          {legendOpen && (
            <div role="region" aria-label="Evidence guide" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '0.7rem', marginTop: '1rem', padding: '1rem', border: '1px solid var(--p-border)', borderRadius: 12, background: 'var(--p-surface)' }}>
              {(Object.keys(TIER_META) as EvidenceTier[]).map(k => {
                const m = TIER_META[k]
                return (
                  <div key={k} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                    <span style={{ width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--p-surface-2)', border: '1px solid var(--p-border)', color: 'var(--primary)', flexShrink: 0 }}>
                      <m.Icon size={16} aria-hidden="true" />
                    </span>
                    <span>
                      <strong style={{ display: 'block', fontSize: '0.82rem' }}>{m.label}</strong>
                      <span style={{ fontSize: '0.76rem', color: 'var(--p-text-3)', lineHeight: 1.5 }}>{m.hint}.</span>
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Stat band */}
          <div className="sr-hero-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.75rem', marginTop: '1.5rem' }}>
            <Stat icon={History} value={events.length} label="Timeline events" sub="1993 → present" />
            <Stat icon={Library} value={sources.length} label="Source records" sub={`${verifiedCount} directly inspected`} />
            <Stat icon={ShieldCheck} value={pagesInspected} label="Pages inspected" sub="First-hand" />
            <Stat icon={FileSearch} value={indexOnlySources} label="Index-only leads" sub="Flagged, not asserted" />
          </div>
        </div>
      </section>

      {/* ── Sticky research toolbar ───────────────────── */}
      <div className="sr-toolbar" style={{ background: 'color-mix(in srgb, var(--p-bg) 88%, transparent)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--p-border)' }}>
        <div className="sr-toolbar-inner">
          <div className="sr-row-top">
            {/* View switch */}
            <div role="tablist" aria-label="Research views" className="sr-viewswitch" style={{ background: 'var(--p-surface)' }}>
              {(['timeline', 'sources'] as const).map(item => {
                const active = view === item
                const n = item === 'timeline' ? filteredEvents.length : filteredSources.length
                return (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => changeView(item)}
                    style={{
                      border: 0, borderRadius: 8, padding: '0.5rem 0.85rem', cursor: 'pointer', minHeight: 40,
                      color: active ? 'var(--primary-fg)' : 'var(--p-text-2)',
                      background: active ? 'var(--primary)' : 'transparent',
                      fontWeight: 700, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                    }}
                  >
                    {item === 'timeline' ? <CalendarDays size={15} aria-hidden="true" /> : <FileText size={15} aria-hidden="true" />}
                    {item === 'timeline' ? 'Timeline' : 'Sources'}
                    <span aria-label={`${n} results`} style={{ fontSize: '0.72rem', fontVariantNumeric: 'tabular-nums', opacity: active ? 0.85 : 0.7, background: active ? 'rgba(0,0,0,0.18)' : 'var(--p-surface-2)', borderRadius: 999, padding: '0.05rem 0.45rem', border: '1px solid transparent' }}>{n}</span>
                  </button>
                )
              })}
            </div>

            {/* Search */}
            <div className="sr-searchrow">
              <div className="sr-searchwrap">
                <Search size={15} aria-hidden="true" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--p-text-4)', pointerEvents: 'none' }} />
                <label className="sr-only" htmlFor="sr-search">Search the {view === 'timeline' ? 'timeline' : 'source library'}</label>
                <input
                  id="sr-search"
                  type="search"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  onKeyDown={e => { if (e.key === 'Escape') { setSearch(''); setPage(1) } }}
                  placeholder={view === 'timeline' ? 'Search events, rulings, speeches…' : 'Search titles, document types…'}
                  autoComplete="off"
                  style={{
                    width: '100%', minHeight: 42, padding: '0.55rem 2.2rem 0.55rem 2.3rem',
                    border: '1px solid var(--p-border-3)', borderRadius: 10,
                    background: 'var(--p-surface)', color: 'var(--p-text-1)', fontSize: '0.87rem',
                  }}
                />
                {search && (
                  <button type="button" onClick={() => { setSearch(''); setPage(1) }} aria-label="Clear search"
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'var(--p-surface-2)', color: 'var(--p-text-2)', borderRadius: 7, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
              <label className="sr-only" htmlFor="sr-sort">Sort results</label>
              <select id="sr-sort" value={sort} onChange={e => { setSort(e.target.value as SortKey); setPage(1) }} aria-label="Sort results" style={controlStyle}>
                <option value="chrono-asc">Oldest first</option>
                <option value="chrono-desc">Newest first</option>
                <option value="az">{view === 'timeline' ? 'Type A–Z' : 'Title A–Z'}</option>
              </select>
            </div>
          </div>

          {/* Category chips + evidence filter */}
          <div className="sr-filters-row">
            <div className="sr-chiprow" role="group" aria-label="Filter by category" style={{ display: 'flex', gap: '0.45rem', overflowX: 'auto', paddingBottom: 2, flex: '1 1 auto' }}>
              {categories.map(c => {
                const active = category === c
                const Icon = c === ALL ? Layers : (CATEGORY_ICONS[c] ?? BookOpen)
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={active}
                    onClick={() => { setCategory(c); setPage(1) }}
                    title={c === ALL ? 'Show everything' : `${counts.get(c) ?? 0} records`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap',
                      minHeight: 34, padding: '0.35rem 0.7rem', borderRadius: 999, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                      border: active ? '1px solid var(--primary)' : '1px solid var(--p-border)',
                      background: active ? 'color-mix(in srgb, var(--primary) 14%, var(--p-surface))' : 'var(--p-surface)',
                      color: active ? 'var(--p-text-1)' : 'var(--p-text-3)',
                    }}
                  >
                    <Icon size={13} aria-hidden="true" style={{ color: active ? 'var(--primary)' : 'inherit' }} />
                    {c === ALL ? 'All' : c}
                    <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.75, fontSize: '0.7rem' }}>{c === ALL ? records.length : (counts.get(c) ?? 0)}</span>
                  </button>
                )
              })}
            </div>
            <div className="sr-filters-side" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <label className="sr-only" htmlFor="sr-tier">Filter by evidence strength</label>
              <select id="sr-tier" value={tier} onChange={e => { setTier(e.target.value as EvidenceTier | typeof ALL); setPage(1) }} style={controlStyle}>
                <option value={ALL}>All evidence</option>
                <option value="verified">Directly verified</option>
                <option value="official">Official / attributed</option>
                <option value="indexed">Index leads</option>
              </select>
              {hasFilters && (
                <button type="button" onClick={resetAll} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', minHeight: 38, padding: '0 0.75rem', borderRadius: 8, border: '1px solid var(--p-border)', background: 'transparent', color: 'var(--p-text-2)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 650 }}>
                  <RotateCcw size={13} aria-hidden="true" /> Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Results ───────────────────────────────────── */}
      <main className="sr-results" style={{ maxWidth: 1180, margin: '0 auto', padding: '1.75rem 1.5rem 1rem' }}>
        <p aria-live="polite" style={{ margin: '0 0 1.1rem', fontSize: '0.82rem', color: 'var(--p-text-3)' }}>
          Showing <strong style={{ color: 'var(--p-text-1)' }}>{records.length ? `${pageStart + 1}–${Math.min(pageStart + perPage, records.length)}` : '0'}</strong> of{' '}
          <strong style={{ color: 'var(--p-text-1)' }}>{records.length}</strong> {view === 'timeline' ? 'events' : 'sources'}
          {hasFilters && <> matching your filters</>}
          {category !== ALL && <> in <strong style={{ color: 'var(--p-text-1)' }}>{category}</strong></>}.
        </p>

        {view === 'timeline' ? (
          groupedYears.length === 0 ? (
            <Empty message="No timeline events match those filters." onReset={resetAll} showReset={hasFilters} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
              {groupedYears.map(([year, items]) => (
                <section key={year} aria-labelledby={`year-${year}`}>
                  <div className="sr-year-head">
                    <h2 id={`year-${year}`} style={{ margin: 0, fontFamily: 'var(--font-mono),monospace', fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.06em', background: 'var(--primary)', color: 'var(--primary-fg)', borderRadius: 8, padding: '0.25rem 0.7rem' }}>
                      {year}
                    </h2>
                    <span aria-hidden="true" style={{ flex: 1, height: 1, background: 'var(--p-border)' }} />
                    <span style={{ fontSize: '0.72rem', color: 'var(--p-text-4)', fontVariantNumeric: 'tabular-nums' }}>{items.length} event{items.length === 1 ? '' : 's'}</span>
                  </div>
                  <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.8rem', position: 'relative' }}>
                    <span aria-hidden="true" style={{ position: 'absolute', left: 9, top: 10, bottom: 10, width: 2, borderRadius: 2, background: 'var(--p-border)' }} />
                    {items.map(event => <TimelineCard key={event.eventId} event={event} />)}
                  </ol>
                </section>
              ))}
            </div>
          )
        ) : visible.length === 0 ? (
          <Empty message="No sources match those filters." onReset={resetAll} showReset={hasFilters} />
        ) : (
          <div className="sr-grid-sources">
            {(visible as PublicSource[]).map(source => <SourceCard key={source.recordId} source={source} />)}
          </div>
        )}

        {/* Pagination */}
        <div className="sr-pager">
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>Page {currentPage} of {totalPages}</span>
          <div className="sr-pager-controls">
            <label className="sr-only" htmlFor="sr-perpage">Records per page</label>
            <select id="sr-perpage" value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1) }} style={controlStyle}>
              {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size} / page</option>)}
            </select>
            <PageNumbers current={currentPage} total={totalPages} onGo={setPage} />
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}
              aria-label="Previous page" style={{ ...pagerStyle, opacity: currentPage <= 1 ? 0.45 : 1 }}>
              <ChevronLeft size={14} aria-hidden="true" /> Prev
            </button>
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              aria-label="Next page" style={{ ...pagerStyle, opacity: currentPage >= totalPages ? 0.45 : 1 }}>
              Next <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </main>

      {/* ── Methodology footer ────────────────────────── */}
      <section aria-labelledby="sr-method" className="sr-method-wrap" style={{ maxWidth: 1180, margin: '0 auto', padding: '0 1.5rem 3rem' }}>
        <div id="sr-method" style={{ marginTop: '1.5rem', border: '1px solid var(--p-border)', borderRadius: 16, background: 'var(--p-surface)', padding: 'clamp(1.25rem,3vw,2rem)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '1.5rem' }}>
          <div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', fontFamily: 'var(--font-display),sans-serif', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <BookOpen size={16} aria-hidden="true" style={{ color: 'var(--primary)' }} /> Research scope
            </h2>
            <p style={{ margin: 0, fontSize: '0.83rem', lineHeight: 1.65, color: 'var(--p-text-2)' }}>{scopeStatement}</p>
            <p style={{ margin: '0.6rem 0 0', fontSize: '0.76rem', color: 'var(--p-text-4)' }}>Cut-off {cutoffDate} · Accessed {accessedDate}</p>
          </div>
          <div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', fontFamily: 'var(--font-display),sans-serif', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <ShieldCheck size={16} aria-hidden="true" style={{ color: 'var(--primary)' }} /> What the labels mean
            </h2>
            <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.83rem', lineHeight: 1.65, color: 'var(--p-text-2)' }}>
              <li><strong>Directly verified</strong> — the document was opened and read.</li>
              <li><strong>Official / attributed</strong> — Parliament or office record, cited as such.</li>
              <li><strong>Index lead</strong> — found but not yet opened; treat as a lead, not proof.</li>
            </ul>
          </div>
          <div>
            <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', fontFamily: 'var(--font-display),sans-serif', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <ArrowUpRight size={16} aria-hidden="true" style={{ color: 'var(--primary)' }} /> Keep exploring
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
              <Link href="/timeline" style={{ textDecoration: 'none', fontWeight: 600 }}>Life &amp; career timeline →</Link>
              <Link href="/archives/milestones" style={{ textDecoration: 'none', fontWeight: 600 }}>Milestones archive →</Link>
              <Link href="/ask" style={{ textDecoration: 'none', fontWeight: 600 }}>Ask about this record →</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

/* ── Cards ────────────────────────────────────────────── */

function TimelineCard({ event }: { event: PublicEvent }) {
  const [open, setOpen] = useState(false)
  const tier = evidenceTier(event.evidenceStatus)
  const meta = TIER_META[tier]
  const cat = eventCategory(event)
  const CatIcon = CATEGORY_ICONS[cat] ?? BookOpen
  const key = isKeyMoment(event)
  return (
    <li className="sr-timeline-item" id={`event-${event.eventId}`}>
      <span aria-hidden="true" style={{
        position: 'absolute', left: 2, top: 22, width: 16, height: 16, borderRadius: 999,
        background: key ? 'var(--primary)' : 'var(--p-surface)',
        border: key ? '3px solid color-mix(in srgb, var(--primary) 30%, transparent)' : '3px solid var(--p-border-3)',
        boxShadow: key ? '0 0 0 3px color-mix(in srgb, var(--primary) 22%, transparent)' : 'none',
      }} />
      <article
        aria-labelledby={`${event.eventId}-title`}
        className="sr-timeline-card"
        style={{
          border: key ? '1px solid color-mix(in srgb, var(--primary) 45%, var(--p-border))' : '1px solid var(--p-border)',
          background: 'var(--p-surface)', borderRadius: 14, padding: '1.1rem 1.2rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center', marginBottom: '0.6rem' }}>
          {key && <Badge tone="brand">Key moment</Badge>}
          <Badge tone="neutral" icon={<CatIcon size={12} aria-hidden="true" />}>{cat}</Badge>
          <Badge tone={meta.tone} icon={<meta.Icon size={12} aria-hidden="true" />} title={meta.hint}>{meta.label}</Badge>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', color: 'var(--p-text-3)', fontVariantNumeric: 'tabular-nums' }}>
            <CalendarDays size={12} aria-hidden="true" />
            <time>{dateLabel(event)}</time>
          </span>
        </div>

        <h3 id={`${event.eventId}-title`} style={{ margin: '0 0 0.4rem', fontSize: '1.08rem', lineHeight: 1.35, fontFamily: 'var(--font-display),sans-serif', letterSpacing: '-0.01em' }}>
          {event.type}
        </h3>
        <p style={{ margin: '0 0 0.6rem', fontSize: '0.9rem', lineHeight: 1.65, color: 'var(--p-text-2)', maxWidth: '62ch' }}>{event.description}</p>
        <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--p-text-4)' }}>
          Attribution: <span style={{ color: 'var(--p-text-3)' }}>{event.attribution}</span>
          <span aria-hidden="true" style={{ margin: '0 0.4rem' }}>·</span>
          <span style={{ fontFamily: 'var(--font-mono),monospace' }}>{event.eventId}</span>
        </p>

        {(event.sourceLinks.length > 0 || event.newsLinks.length > 0) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginTop: '0.85rem' }}>
            {event.sourceLinks.map(({ recordId, title, originalUrl, verificationStatus }) => (
              <a key={recordId} href={originalUrl} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', maxWidth: '100%', fontSize: '0.76rem', fontWeight: 600, color: 'var(--p-text-1)', background: 'var(--p-surface-2)', border: '1px solid var(--p-border)', borderRadius: 9, padding: '0.42rem 0.6rem', textDecoration: 'none', minWidth: 0 }}
                title={`${title} — ${verificationStatus.replaceAll('_', ' ')}`}>
                <Link2 size={12} aria-hidden="true" style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span className="sr-proof-label">{recordId} · {title}</span>
                <ExternalLink size={11} aria-hidden="true" style={{ flexShrink: 0, opacity: 0.7 }} />
              </a>
            ))}
            {event.newsLinks.map(news => news.url ? (
              <a key={`news-${news.id}`} href={news.url} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', maxWidth: '100%', fontSize: '0.76rem', fontWeight: 600, color: 'var(--p-text-1)', background: 'transparent', border: '1px dashed var(--p-border-3)', borderRadius: 9, padding: '0.42rem 0.6rem', textDecoration: 'none', minWidth: 0 }}>
                <span className="sr-proof-label">{news.sourceName || 'Press'} · {news.title || `Article #${news.id}`}</span>
                <ExternalLink size={11} aria-hidden="true" style={{ flexShrink: 0, opacity: 0.7 }} />
              </a>
            ) : (
              <Badge key={`news-${news.id}`} tone="neutral">Press record #{news.id}</Badge>
            ))}
          </div>
        )}

        {event.notes && (
          <div style={{ marginTop: '0.7rem' }}>
            <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
              style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)' }}>
              {open ? 'Hide researcher note' : 'Read researcher note'}
            </button>
            {open && <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', lineHeight: 1.6, color: 'var(--p-text-3)', borderLeft: '2px solid var(--primary)', paddingLeft: '0.7rem' }}>{event.notes}</p>}
          </div>
        )}
      </article>
    </li>
  )
}

function SourceCard({ source }: { source: PublicSource }) {
  const [open, setOpen] = useState(false)
  const tier = sourceTier(source)
  const meta = TIER_META[tier]
  const cat = sourceCategory(source)
  const CatIcon = CATEGORY_ICONS[cat] ?? FileText
  return (
    <article id={`source-${source.recordId}`} aria-labelledby={`${source.recordId}-title`}
      style={{ border: '1px solid var(--p-border)', background: 'var(--p-surface)', borderRadius: 14, padding: '1.1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem' }}>
        <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--p-surface-2)', border: '1px solid var(--p-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
          <CatIcon size={17} aria-hidden="true" />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center', marginBottom: '0.35rem' }}>
            <Badge tone={meta.tone} icon={<meta.Icon size={12} aria-hidden="true" />} title={meta.hint}>{meta.label}</Badge>
            <Badge tone="neutral">{cat}</Badge>
          </div>
          <h3 id={`${source.recordId}-title`} style={{ margin: 0, fontSize: '0.98rem', lineHeight: 1.4, fontFamily: 'var(--font-display),sans-serif' }}>{source.title}</h3>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.72rem', color: 'var(--p-text-4)', fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ fontFamily: 'var(--font-mono),monospace' }}>{source.recordId}</span>
            <span aria-hidden="true" style={{ margin: '0 0.4rem' }}>·</span>
            {source.publicationDate ? `Published ${source.publicationDate}` : 'Publication date not established'}
            {source.termOrSession ? ` · ${source.termOrSession}` : ''}
          </p>
        </div>
      </div>

      <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--p-text-2)' }}>{source.summary}</p>
      <p style={{ margin: 0, fontSize: '0.78rem', lineHeight: 1.55, color: 'var(--p-text-3)' }}>
        <strong style={{ color: 'var(--p-text-2)', fontWeight: 650 }}>Why it matters: </strong>{source.relevance}
      </p>

      <div className="sr-source-actions">
        <a href={source.originalUrl} target="_blank" rel="noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 700, background: 'var(--primary)', color: 'var(--primary-fg)', borderRadius: 9, padding: '0.5rem 0.8rem', textDecoration: 'none', minHeight: 36 }}>
          Open original <ExternalLink size={13} aria-hidden="true" />
        </a>
        {source.downloadUrl && (
          <a href={source.downloadUrl} target="_blank" rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', fontWeight: 650, background: 'transparent', color: 'var(--p-text-1)', border: '1px solid var(--p-border-3)', borderRadius: 9, padding: '0.5rem 0.8rem', textDecoration: 'none', minHeight: 36 }}>
            Document file
          </a>
        )}
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls={`${source.recordId}-meta`}
          style={{ marginLeft: 'auto', background: 'none', border: 0, cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700, color: 'var(--p-text-3)', minHeight: 36 }}>
          {open ? 'Hide details' : 'Details'}
        </button>
      </div>

      {open && (
        <dl id={`${source.recordId}-meta`} className="sr-source-meta">
          <Meta label="Document type" value={source.documentType} />
          <Meta label="People" value={source.persons.join(', ') || 'Not specified'} />
          <Meta label="Exact locator" value={source.locator || 'Not specified'} />
          <Meta label="Accessed" value={source.accessedDate} />
          {source.sittingDate && <Meta label="Parliamentary date" value={source.sittingDate} />}
          {source.notes && <Meta label="Research notes" value={source.notes} wide />}
        </dl>
      )}
    </article>
  )
}

/* ── Primitives ───────────────────────────────────────── */

const controlStyle: React.CSSProperties = {
  minHeight: 38,
  padding: '0.45rem 0.65rem',
  border: '1px solid var(--p-border-3)',
  borderRadius: 9,
  background: 'var(--p-surface)',
  color: 'var(--p-text-1)',
  fontSize: '0.8rem',
  fontWeight: 600,
}

const pagerStyle: React.CSSProperties = {
  ...controlStyle,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
}

function Stat({ icon: Icon, value, label, sub }: { icon: LucideIcon; value: number; label: string; sub: string }) {
  return (
    <div className="sr-stat" style={{ border: '1px solid var(--p-border)', borderRadius: 14, padding: '0.9rem 1rem', background: 'color-mix(in srgb, var(--p-surface) 82%, transparent)', display: 'flex', gap: '0.7rem', alignItems: 'flex-start', minWidth: 0 }}>
      <span style={{ width: 34, height: 34, borderRadius: 10, background: 'color-mix(in srgb, var(--primary) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <span>
        <strong style={{ display: 'block', fontSize: '1.35rem', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>{value}</strong>
        <span style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700 }}>{label}</span>
        <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--p-text-4)' }}>{sub}</span>
      </span>
    </div>
  )
}

function PageNumbers({ current, total, onGo }: { current: number; total: number; onGo: (p: number) => void }) {
  if (total <= 1) return null
  const pages: (number | '…')[] = []
  const want = new Set([1, 2, current - 1, current, current + 1, total - 1, total].filter(p => p >= 1 && p <= total))
  let last = 0
  for (const p of [...want].sort((a, b) => a - b)) {
    if (p - last > 1) pages.push('…')
    pages.push(p)
    last = p
  }
  return (
    <span role="group" aria-label="Page numbers" style={{ display: 'inline-flex', gap: '0.3rem', alignItems: 'center' }}>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} aria-hidden="true" style={{ color: 'var(--p-text-4)', fontSize: '0.78rem' }}>…</span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onGo(p)}
            aria-label={`Go to page ${p}`}
            aria-current={p === current ? 'page' : undefined}
            style={{
              minWidth: 34, minHeight: 34, borderRadius: 8, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums',
              border: p === current ? '1px solid var(--primary)' : '1px solid var(--p-border)',
              background: p === current ? 'var(--primary)' : 'transparent',
              color: p === current ? 'var(--primary-fg)' : 'var(--p-text-2)',
            }}
          >
            {p}
          </button>
        ),
      )}
    </span>
  )
}

function Meta({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <dt style={{ fontWeight: 700, color: 'var(--p-text-2)', marginBottom: '0.1rem' }}>{label}</dt>
      <dd style={{ margin: 0, overflowWrap: 'anywhere', lineHeight: 1.55 }}>{value}</dd>
    </div>
  )
}

function Empty({ message, onReset, showReset }: { message: string; onReset: () => void; showReset: boolean }) {
  return (
    <div style={{ border: '1px dashed var(--p-border-3)', borderRadius: 14, padding: '2.5rem 1.5rem', textAlign: 'center', background: 'var(--p-surface)' }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--p-surface-2)', border: '1px solid var(--p-border)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--p-text-3)' }}>
        <FileSearch size={20} aria-hidden="true" />
      </span>
      <h2 style={{ margin: '0.8rem 0 0.35rem', fontSize: '1.05rem', fontFamily: 'var(--font-display),sans-serif' }}>Nothing found</h2>
      <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--p-text-3)' }}>{message} Try a broader term, or clear the filters.</p>
      {showReset && (
        <button type="button" onClick={onReset} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', minHeight: 40, padding: '0.5rem 1rem', borderRadius: 9, border: '1px solid var(--primary)', background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--p-text-1)', cursor: 'pointer', fontSize: '0.83rem', fontWeight: 700 }}>
          <RotateCcw size={14} aria-hidden="true" /> Clear all filters
        </button>
      )}
    </div>
  )
}
