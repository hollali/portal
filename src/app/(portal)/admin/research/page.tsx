'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpen, CalendarDays, ExternalLink, FileSearch, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import { Badge, Button, Field, Input, PageHeader, Select, Tabs, Textarea } from '@/components/ui/kit'
import { EmptyState, SkeletonTable } from '@/components/ui'
import { jsonFetch } from '@/lib/jsonFetch'

type ResearchTab = 'timeline' | 'sources'
type Editor = { recordType: 'source'; item?: Source } | { recordType: 'event'; item?: ResearchEvent }

interface Source {
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

interface EventSource {
  source: Pick<Source, 'recordId' | 'title' | 'originalUrl' | 'downloadUrl' | 'verificationStatus'>
}

interface NewsCandidate {
  id: number
  title: string | null
  url: string | null
  date: string | null
  sourceName: string | null
}

interface EventNews {
  news: NewsCandidate
}

interface ResearchEvent {
  eventId: string
  startDate: string | null
  endDate: string | null
  type: string
  description: string
  attribution: string
  evidenceStatus: string
  notes: string | null
  sourceLinks: EventSource[]
  newsLinks: EventNews[]
}

interface Dataset {
  id: string
  title: string
  accessedDate: string
  cutoffDate: string
  subject: {
    official_name_as_rendered_by_office_page?: string
    current_role?: string
    role_start_date?: string
    current_as_of_cutoff?: boolean
    unresolved_profile_fields?: string[]
  }
  coverage: {
    unique_source_urls_catalogued?: number
    pages_or_items_directly_inspected?: number
    additional_search_index_only_sources?: number
    downloadable_files_identified?: number
    files_downloaded_and_full_text_processed?: number
    event_records?: number
    scope_statement?: string
  }
  sources: Source[]
  events: ResearchEvent[]
  newsCandidates: NewsCandidate[]
}

const DATA_TABS = [
  { value: 'timeline' as const, label: 'Timeline', icon: <CalendarDays size={15} /> },
  { value: 'sources' as const, label: 'Sources', icon: <FileSearch size={15} /> },
]

function pretty(value: string) {
  return value.replaceAll('_', ' ')
}

function evidenceTone(status: string): 'success' | 'warning' | 'neutral' {
  if (status.includes('direct') || status.includes('official')) return 'success'
  if (status.includes('index') || status.includes('attribution')) return 'warning'
  return 'neutral'
}

function formatDate(date: string | null) {
  if (!date) return 'Date not established'
  return date
}

export default function SpeakerResearchPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [tab, setTab] = useState<ResearchTab>('timeline')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [mutationError, setMutationError] = useState('')
  const [editor, setEditor] = useState<Editor | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchDataset = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/research', { cache: 'no-store' })
      const body = await response.json().catch(() => null) as { dataset?: Dataset; error?: string } | null
      if (!response.ok) {
        return { error: body?.error || `Research request failed (${response.status}).` }
      }
      if (!body?.dataset) return { error: 'The research endpoint returned no dataset.' }
      return body
    } catch {
      return { error: 'Could not connect to the research endpoint. Check your connection and retry.' }
    }
  }, [])

  const loadDataset = useCallback(async () => {
    setLoading(true)
    const response = await fetchDataset()
    if (response?.dataset) {
      setDataset(response.dataset)
      setError('')
    } else {
      setError(response?.error || 'Could not load the research dataset.')
    }
    setLoading(false)
  }, [fetchDataset])

  useEffect(() => {
    let active = true
    jsonFetch<{ role?: string }>('/api/me').then(user => {
      if (!active) return
      if (user?.role !== 'admin' && user?.role !== 'editor') {
        router.push('/admin')
        return
      }
      setAuthorized(true)
    })
    return () => { active = false }
  }, [router])

  useEffect(() => {
    if (!authorized) return
    let active = true
    fetchDataset().then(response => {
      if (!active) return
      if (response?.dataset) {
        setDataset(response.dataset)
        setError('')
      } else {
        setError(response?.error || 'Could not load the research dataset.')
      }
      setLoading(false)
    })
    return () => { active = false }
  }, [authorized, fetchDataset])

  const sources = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!dataset || !normalized) return dataset?.sources ?? []
    return dataset.sources.filter(source => [
      source.recordId,
      source.title,
      source.originalUrl,
      source.documentType,
      source.summary,
      source.relevance,
      source.verificationStatus,
      ...(Array.isArray(source.persons) ? source.persons : []),
    ].some(value => String(value).toLowerCase().includes(normalized)))
  }, [dataset, query])

  const events = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!dataset || !normalized) return dataset?.events ?? []
    return dataset.events.filter(event => [event.eventId, event.type, event.description, event.attribution, event.evidenceStatus]
      .some(value => String(value).toLowerCase().includes(normalized)))
  }, [dataset, query])

  const totalPages = Math.max(1, Math.ceil((tab === 'sources' ? sources.length : events.length) / perPage))
  const currentPage = Math.min(page, totalPages)
  const pageStart = (currentPage - 1) * perPage
  const visibleSources = sources.slice(pageStart, pageStart + perPage)
  const visibleEvents = events.slice(pageStart, pageStart + perPage)

  const saveRecord = async (recordType: 'source' | 'event', values: Record<string, unknown>) => {
    setSaving(true)
    setMutationError('')
    try {
      const response = await fetch('/api/admin/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upsert', mode: editor?.item ? 'update' : 'create', recordType, ...values }),
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(result?.error || `Save failed (${response.status}).`)
      setEditor(null)
      setPage(1)
      await loadDataset()
    } catch (saveError) {
      setMutationError(saveError instanceof Error ? saveError.message : 'Could not save the record.')
    } finally {
      setSaving(false)
    }
  }

  const deleteRecord = async (recordType: 'source' | 'event', recordId: string, title: string) => {
    if (!window.confirm(`Delete “${title}” (${recordId})? This cannot be undone.`)) return
    setSaving(true)
    setMutationError('')
    try {
      const response = await fetch('/api/admin/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', recordType, recordId }),
      })
      const result = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) throw new Error(result?.error || `Delete failed (${response.status}).`)
      setPage(1)
      await loadDataset()
    } catch (deleteError) {
      setMutationError(deleteError instanceof Error ? deleteError.message : 'Could not delete the record.')
    } finally {
      setSaving(false)
    }
  }

  const changeTab = (value: ResearchTab) => { setTab(value); setPage(1); setMutationError('') }
  const changeQuery = (value: string) => { setQuery(value); setPage(1) }

  if (!authorized) return <SkeletonTable rows={5} cols={4} />

  return (
    <div className="page-enter">
      <PageHeader
        title="Speaker Research"
        icon={<BookOpen size={22} />}
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Speaker Research' }]}
        description="Parliament of Ghana source inventory and linked parliamentary timeline for Alban Sumana Kingsford Bagbin."
        meta={dataset ? <Badge tone="brand">Accessed {dataset.accessedDate}</Badge> : undefined}
      />

      {loading ? <SkeletonTable rows={6} cols={4} /> : error ? (
        <div className="card p-5" role="alert">
          <p className="mb-3">{error}</p>
          <Button variant="secondary" onClick={() => void loadDataset()} iconLeft={<RefreshCw size={15} />}>Retry</Button>
        </div>
      ) : dataset ? (
        <>
          <section className="card mb-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="m-0 text-xs uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>Current office</p>
                <h2 className="mt-1 mb-1 text-xl font-bold">{dataset.subject.official_name_as_rendered_by_office_page}</h2>
                <p className="m-0 text-sm" style={{ color: 'var(--muted-foreground)' }}>
                  {dataset.subject.current_role} · since {dataset.subject.role_start_date}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="success">Current at research cut-off</Badge>
                <a href="https://www.parliament.gh/gen?CM" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm">
                  Official Speaker profile <ExternalLink size={13} />
                </a>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Sources" value={dataset.sources.length} />
              <Metric label="Timeline events" value={dataset.events.length} />
              <Metric label="Pages inspected" value={dataset.coverage.pages_or_items_directly_inspected ?? 0} />
              <Metric label="Index-only records" value={dataset.coverage.additional_search_index_only_sources ?? 0} />
            </div>
            <p className="mt-4 mb-0 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {dataset.coverage.scope_statement} Research cut-off: {dataset.cutoffDate}.
            </p>
          </section>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <Tabs items={DATA_TABS} value={tab} onChange={changeTab} label="Research view" />
            <div className="flex flex-wrap items-center gap-2">
              <Field label="Search research" hideLabel className="min-w-56">
                <Input value={query} onChange={event => changeQuery(event.target.value)} placeholder="Search titles, names, evidence…" aria-label="Search research records" />
              </Field>
              <Button variant="secondary" size="sm" onClick={() => void loadDataset()} iconLeft={<RefreshCw size={14} />}>Refresh</Button>
            </div>
          </div>

          {mutationError && <p className="card mb-4 p-3 text-sm" role="alert" style={{ color: 'var(--danger)' }}>{mutationError}</p>}

          {tab === 'sources' ? (
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="m-0 text-sm" style={{ color: 'var(--muted-foreground)' }}>{sources.length} source records</p>
                <Button onClick={() => { setMutationError(''); setEditor({ recordType: 'source' }) }} iconLeft={<Plus size={15} />}>Add source</Button>
              </div>
              <div className="flex flex-col gap-3">
              {visibleSources.length ? visibleSources.map(source => (
                <article key={source.recordId} className="card p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">{source.recordId}</Badge>
                        <Badge tone={evidenceTone(source.verificationStatus)}>{pretty(source.verificationStatus)}</Badge>
                        <Badge tone="neutral">{source.documentType}</Badge>
                      </div>
                      <h3 className="m-0 text-base font-semibold">{source.title}</h3>
                      <p className="mt-1 mb-0 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {source.publicationDate ? `Published ${source.publicationDate}` : 'Publication date not recorded'}
                        {source.termOrSession ? ` · ${source.termOrSession}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm">
                      <SourceLink href={source.originalUrl} label="Original page" />
                      {source.downloadUrl && <SourceLink href={source.downloadUrl} label="Document" />}
                      <Button size="xs" variant="secondary" disabled={saving} onClick={() => { setMutationError(''); setEditor({ recordType: 'source', item: source }) }} iconLeft={<Pencil size={13} />}>Edit</Button>
                      <Button size="xs" variant="danger" disabled={saving} onClick={() => void deleteRecord('source', source.recordId, source.title)} iconLeft={<Trash2 size={13} />}>Delete</Button>
                    </div>
                  </div>
                  <p className="mt-3 mb-1 text-sm">{source.summary}</p>
                  <p className="m-0 text-sm" style={{ color: 'var(--muted-foreground)' }}>{source.relevance}</p>
                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer font-semibold">Record metadata</summary>
                    <dl className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                      <Meta label="Sitting / event date" value={source.sittingDate || 'Not recorded'} />
                      <Meta label="Accessed" value={source.accessedDate} />
                      <Meta label="People" value={Array.isArray(source.persons) ? source.persons.join(', ') : 'Not recorded'} />
                      <Meta label="Exact locator" value={source.locator || 'Not recorded'} />
                      {source.notes && <Meta label="Notes" value={source.notes} />}
                    </dl>
                  </details>
                </article>
              )) : <EmptyState message="Add a source or change your search." title="No sources match" />}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="m-0 text-sm" style={{ color: 'var(--muted-foreground)' }}>{events.length} timeline events</p>
                <Button onClick={() => { setMutationError(''); setEditor({ recordType: 'event' }) }} iconLeft={<Plus size={15} />}>Add event</Button>
              </div>
              <div className="relative flex flex-col gap-3">
              {visibleEvents.length ? visibleEvents.map(event => (
                <article key={event.eventId} className="card p-4 md:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge tone="brand">{formatDate(event.startDate)}{event.endDate ? ` – ${event.endDate}` : ''}</Badge>
                      <Badge tone="neutral">{event.eventId}</Badge>
                      <Badge tone={evidenceTone(event.evidenceStatus)}>{pretty(event.evidenceStatus)}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="xs" variant="secondary" disabled={saving} onClick={() => { setMutationError(''); setEditor({ recordType: 'event', item: event }) }} iconLeft={<Pencil size={13} />}>Edit</Button>
                      <Button size="xs" variant="danger" disabled={saving} onClick={() => void deleteRecord('event', event.eventId, event.type)} iconLeft={<Trash2 size={13} />}>Delete</Button>
                    </div>
                  </div>
                  <h3 className="m-0 text-base font-semibold">{event.type}</h3>
                  <p className="mt-2 mb-2 text-sm">{event.description}</p>
                  <p className="m-0 text-xs" style={{ color: 'var(--muted-foreground)' }}>Role / attribution: {event.attribution}</p>
                  {event.notes && <p className="mt-2 mb-0 text-xs" style={{ color: 'var(--muted-foreground)' }}>Note: {event.notes}</p>}
                  {!!event.sourceLinks.length && (
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                      {event.sourceLinks.map(({ source }) => (
                        <SourceLink key={source.recordId} href={source.originalUrl} label={`${source.recordId}: ${source.title}`} />
                      ))}
                    </div>
                  )}
                  {!!event.newsLinks.length && (
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                      {event.newsLinks.map(({ news }) => news.url ? (
                        <SourceLink key={news.id} href={news.url} label={`Existing News #${news.id}: ${news.title || news.sourceName || 'Untitled'}`} />
                      ) : (
                        <Badge key={news.id} tone="neutral">Existing News #{news.id}: {news.title || 'Untitled'}</Badge>
                      ))}
                    </div>
                  )}
                </article>
              )) : <EmptyState message="Add an event or change your search." title="No events match" />}
              </div>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-xs" style={{ color: 'var(--muted-foreground)' }}>
              Showing {Math.min(pageStart + 1, tab === 'sources' ? sources.length : events.length)}–{Math.min(pageStart + perPage, tab === 'sources' ? sources.length : events.length)} of {tab === 'sources' ? sources.length : events.length} {tab === 'sources' ? 'sources' : 'events'}.
              {' '}Evidence labels distinguish inspected records from indexed results and attributed summaries.
            </p>
            <div className="flex items-center gap-2">
              <Field label="Rows per page" hideLabel>
                <Select aria-label="Rows per page" value={perPage} onChange={event => { setPerPage(Number(event.target.value)); setPage(1) }} style={{ width: 86 }}>
                  {[5, 10, 20].map(size => <option key={size} value={size}>{size} / page</option>)}
                </Select>
              </Field>
              <Button size="sm" variant="secondary" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
              <span className="whitespace-nowrap text-xs" style={{ color: 'var(--muted-foreground)' }}>Page {currentPage} / {totalPages}</span>
              <Button size="sm" variant="secondary" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Next</Button>
            </div>
          </div>
        </>
      ) : null}

      {editor && (
        <ResearchEditor
          key={`${editor.recordType}-${editor.item ? ('recordId' in editor.item ? editor.item.recordId : editor.item.eventId) : 'new'}`}
          recordType={editor.recordType}
          initial={editor.item}
          sourceOptions={dataset?.sources ?? []}
          newsOptions={dataset?.newsCandidates ?? []}
          onCancel={() => setEditor(null)}
          onSave={values => saveRecord(editor.recordType, values)}
          saving={saving}
          error={mutationError}
        />
      )}
    </div>
  )
}

type SourceFormValues = {
  recordId: string
  title: string
  originalUrl: string
  downloadUrl: string
  publicationDate: string
  sittingDate: string
  accessedDate: string
  documentType: string
  termOrSession: string
  persons: string
  locator: string
  summary: string
  relevance: string
  verificationStatus: string
  notes: string
}

type EventFormValues = {
  eventId: string
  startDate: string
  endDate: string
  type: string
  description: string
  attribution: string
  evidenceStatus: string
  sourceRecordIds: string
  newsRecordIds: string
  notes: string
}

function ResearchEditor({
  recordType,
  initial,
  sourceOptions,
  newsOptions,
  onCancel,
  onSave,
  saving,
  error,
}: {
  recordType: 'source' | 'event'
  initial?: Source | ResearchEvent
  sourceOptions: Source[]
  newsOptions: NewsCandidate[]
  onCancel: () => void
  onSave: (values: Record<string, unknown>) => Promise<void>
  saving: boolean
  error: string
}) {
  const editing = Boolean(initial)
  const [sourceForm, setSourceForm] = useState<SourceFormValues>(() => {
    const source = recordType === 'source' ? initial as Source | undefined : undefined
    return {
      recordId: source?.recordId ?? '', title: source?.title ?? '', originalUrl: source?.originalUrl ?? '',
      downloadUrl: source?.downloadUrl ?? '', publicationDate: source?.publicationDate ?? '', sittingDate: source?.sittingDate ?? '',
      accessedDate: source?.accessedDate ?? new Date().toISOString().slice(0, 10), documentType: source?.documentType ?? '',
      termOrSession: source?.termOrSession ?? '', persons: Array.isArray(source?.persons) ? source.persons.join(', ') : '',
      locator: source?.locator ?? '', summary: source?.summary ?? '', relevance: source?.relevance ?? '',
      verificationStatus: source?.verificationStatus ?? 'directly_inspected', notes: source?.notes ?? '',
    }
  })
  const [eventForm, setEventForm] = useState<EventFormValues>(() => {
    const event = recordType === 'event' ? initial as ResearchEvent | undefined : undefined
    return {
      eventId: event?.eventId ?? '', startDate: event?.startDate ?? '', endDate: event?.endDate ?? '',
      type: event?.type ?? '', description: event?.description ?? '', attribution: event?.attribution ?? '',
      evidenceStatus: event?.evidenceStatus ?? 'direct_repository_metadata',
      sourceRecordIds: event?.sourceLinks.map(link => link.source.recordId).join(', ') ?? '', notes: event?.notes ?? '',
      newsRecordIds: event?.newsLinks.map(link => String(link.news.id)).join(', ') ?? '',
    }
  })

  const updateSource = (key: keyof SourceFormValues, value: string) => setSourceForm(current => ({ ...current, [key]: value }))
  const updateEvent = (key: keyof EventFormValues, value: string) => setEventForm(current => ({ ...current, [key]: value }))
  const field = (label: string, key: keyof SourceFormValues, required = false, hint?: string) => (
    <Field key={key} label={label} required={required} hint={hint}>
      <Input value={sourceForm[key]} onChange={event => updateSource(key, event.target.value)} />
    </Field>
  )
  const textarea = (label: string, key: keyof SourceFormValues, required = false) => (
    <Field key={key} label={label} required={required}>
      <Textarea value={sourceForm[key]} onChange={event => updateSource(key, event.target.value)} rows={3} />
    </Field>
  )

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (recordType === 'source') {
      void onSave({
        recordId: sourceForm.recordId, title: sourceForm.title, originalUrl: sourceForm.originalUrl,
        downloadUrl: sourceForm.downloadUrl, publicationDate: sourceForm.publicationDate, sittingDate: sourceForm.sittingDate,
        accessedDate: sourceForm.accessedDate, documentType: sourceForm.documentType, termOrSession: sourceForm.termOrSession,
        persons: sourceForm.persons.split(/[\n,]/).map(person => person.trim()).filter(Boolean), locator: sourceForm.locator,
        summary: sourceForm.summary, relevance: sourceForm.relevance, verificationStatus: sourceForm.verificationStatus, notes: sourceForm.notes,
      })
    } else {
      void onSave({
        eventId: eventForm.eventId, startDate: eventForm.startDate, endDate: eventForm.endDate, type: eventForm.type,
        description: eventForm.description, attribution: eventForm.attribution, evidenceStatus: eventForm.evidenceStatus,
        sourceRecordIds: eventForm.sourceRecordIds.split(/[\n,]/).map(id => id.trim()).filter(Boolean), notes: eventForm.notes,
        newsIds: eventForm.newsRecordIds.split(/[\n,]/).map(id => Number(id.trim())).filter(id => Number.isInteger(id) && id > 0),
      })
    }
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 p-3 md:p-6" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onCancel() }}>
      <section role="dialog" aria-modal="true" aria-labelledby="research-editor-title" className="mx-auto my-4 w-full max-w-4xl rounded-xl border p-5 shadow-xl md:p-7" style={{ background: 'var(--background)', borderColor: 'var(--border)' }}>
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 id="research-editor-title" className="m-0 text-xl font-bold">{editing ? 'Edit' : 'Add'} {recordType === 'source' ? 'source record' : 'timeline event'}</h2>
            <p className="mt-1 mb-0 text-sm" style={{ color: 'var(--muted-foreground)' }}>Changes are saved directly to the research database.</p>
          </div>
          <Button iconOnly aria-label="Close editor" onClick={onCancel} disabled={saving}><X size={17} /></Button>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {recordType === 'source' ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Record ID" required hint="Stable identifier such as SRC-033."><Input value={sourceForm.recordId} disabled={editing} onChange={event => updateSource('recordId', event.target.value)} /></Field>
                {field('Title', 'title', true)}
                {field('Original source URL', 'originalUrl', true)}
                {field('Download URL', 'downloadUrl')}
                {field('Publication date', 'publicationDate', false, 'Use YYYY-MM-DD, YYYY-MM, or YYYY when known.')}
                {field('Sitting / event date', 'sittingDate')}
                {field('Accessed date', 'accessedDate', true)}
                {field('Document type', 'documentType', true)}
                {field('Parliament term / session', 'termOrSession')}
                {field('People mentioned', 'persons', false, 'Separate multiple names with commas.')}
                {field('Exact locator', 'locator')}
                {field('Verification status', 'verificationStatus', true)}
              </div>
              {textarea('Extract / summary', 'summary', true)}
              {textarea('Relevance', 'relevance', true)}
              {textarea('Research notes', 'notes')}
            </>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Event ID" required hint="Stable identifier such as EVT-020."><Input value={eventForm.eventId} disabled={editing} onChange={event => updateEvent('eventId', event.target.value)} /></Field>
                <Field label="Event type" required><Input value={eventForm.type} onChange={event => updateEvent('type', event.target.value)} /></Field>
                <Field label="Start date" hint="Use YYYY-MM-DD, YYYY-MM, or YYYY; leave blank if unknown."><Input value={eventForm.startDate} onChange={event => updateEvent('startDate', event.target.value)} /></Field>
                <Field label="End date"><Input value={eventForm.endDate} onChange={event => updateEvent('endDate', event.target.value)} /></Field>
                <Field label="Role / attribution" required><Input value={eventForm.attribution} onChange={event => updateEvent('attribution', event.target.value)} /></Field>
                <Field label="Evidence status" required><Input value={eventForm.evidenceStatus} onChange={event => updateEvent('evidenceStatus', event.target.value)} /></Field>
                <Field label="Linked source IDs" hint={`Available: ${sourceOptions.map(source => source.recordId).join(', ')}`}>
                  <Input value={eventForm.sourceRecordIds} onChange={event => updateEvent('sourceRecordIds', event.target.value)} placeholder="SRC-001, SRC-017" />
                </Field>
                <Field label="Existing News record IDs" hint={`Examples: ${newsOptions.slice(0, 8).map(item => `#${item.id} ${item.title || item.sourceName || ''}`).join(' · ')}`}>
                  <Input value={eventForm.newsRecordIds} onChange={event => updateEvent('newsRecordIds', event.target.value)} placeholder="49, 55" />
                </Field>
              </div>
              <Field label="Event description" required><Textarea value={eventForm.description} onChange={event => updateEvent('description', event.target.value)} rows={4} /></Field>
              <Field label="Research notes"><Textarea value={eventForm.notes} onChange={event => updateEvent('notes', event.target.value)} rows={2} /></Field>
            </>
          )}
          {error && <p className="m-0 text-sm" role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
          <div className="flex justify-end gap-2 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
            <Button type="submit" loading={saving}>{editing ? 'Save changes' : 'Add record'}</Button>
          </div>
        </form>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <strong className="block text-xl">{value.toLocaleString()}</strong>
      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{label}</span>
    </div>
  )
}

function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-sm underline underline-offset-2">
      <span className="truncate">{label}</span><ExternalLink size={12} className="shrink-0" />
    </a>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold" style={{ color: 'var(--muted-foreground)' }}>{label}</dt>
      <dd className="m-0 break-words">{value}</dd>
    </div>
  )
}
