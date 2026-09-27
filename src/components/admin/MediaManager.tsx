'use client'

import { useEffect, useState, useCallback, FormEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { jsonFetch } from '@/lib/jsonFetch'
import {
  Eye,
  Trash2,
  ExternalLink,
  Plus,
  Download,
  Music,
  Play,
  FileText,
  Search,
  ChevronDown,
  ChevronUp,
  Pencil,
  Monitor,
  Save,
  ListPlus,
  Tags,
  FileInput,
  Image,
  ImageOff,
  type LucideIcon,
} from 'lucide-react'
import { Modal, AnimLink, SkeletonTable, EmptyState, ConfirmDialog } from '@/components/ui'
import { Button, useToast } from '@/components/ui/kit'
import { Pagination } from '@/components/ui/Pagination'
import { localToMediaUrl, isYouTubeUrl, getYouTubeEmbedUrl } from '@/lib/media'

export type MediaType = 'images' | 'videos' | 'news' | 'audio'

const PER_PAGE = 20
const SEARCH_DEBOUNCE_MS = 300

export const MEDIA_TYPES: MediaType[] = ['images', 'videos', 'news', 'audio']

export const MEDIA_LABELS: Record<MediaType, string> = {
  images: 'Images',
  videos: 'Videos',
  news: 'News',
  audio: 'Audio',
}

export const MEDIA_ICONS: Record<MediaType, LucideIcon> = {
  images: Image,
  videos: Play,
  news: FileText,
  audio: Music,
}

interface MediaItem {
  id: number
  source?: string
  query?: string
  url?: string
  src?: string
  localPath?: string | null
  title?: string
  channel?: string
  platform?: string
  views?: number | null
  duration?: number | null
  artist?: string
  sourceName?: string
  date?: string
  snippet?: string
  faceCount?: number | null
  faceMatch?: number | null
  collectedAt?: string | null
  [key: string]: unknown
}

interface AdminData {
  items: MediaItem[]
  total: number
  page: number
  perPage: number
  sources: string[]
}

type ViewMode = 'details' | 'edit' | 'public'

function getMediaUrl(item: { src?: string | null; localPath?: string | null; url?: string | null }): string | null {
  return item.src || localToMediaUrl(item.localPath) || item.url || null
}

function formatDuration(duration?: number | null): string {
  if (!duration) return ''
  const m = Math.floor(duration / 60)
  const s = duration % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function singular(type: MediaType): string {
  if (type === 'images') return 'Image'
  if (type === 'news') return 'News'
  return type.slice(0, -1)
}

/**
 * The thumbnail is the primary way into a record, so it is a real button with
 * an accessible name. The image inside is decorative — the button's own label
 * carries the identification — and a load failure falls back to a visible
 * placeholder instead of silently collapsing the box.
 */
function MediaThumb({ item, onOpen }: { item: MediaItem; onOpen: () => void }) {
  const [failed, setFailed] = useState(false)
  const src = getMediaUrl(item)
  const label = item.title?.slice(0, 60) || item.source || `Image #${item.id}`

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`View ${label}`}
      aria-label={`View details for ${label}`}
      style={{
        width: 64,
        height: 64,
        borderRadius: '0.5rem',
        overflow: 'hidden',
        cursor: 'pointer',
        background: 'var(--muted)',
        border: '1px solid var(--border)',
        padding: 0,
        display: 'block',
      }}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={64}
          height={64}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          aria-hidden
          className="flex w-full h-full items-center justify-center"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <ImageOff size={18} />
        </span>
      )}
    </button>
  )
}

/** A record's title, doubling as the keyboard-operable way to open it. */
function TitleButton({ children, onOpen }: { children: ReactNode; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        fontWeight: 600,
        textAlign: 'left',
        cursor: 'pointer',
        color: 'inherit',
        padding: 0,
        border: 'none',
        background: 'none',
        textDecoration: 'underline',
        textDecorationColor: 'transparent',
        textUnderlineOffset: '2px',
      }}
      onMouseEnter={e => { e.currentTarget.style.textDecorationColor = 'currentColor' }}
      onMouseLeave={e => { e.currentTarget.style.textDecorationColor = 'transparent' }}
      onFocus={e => { e.currentTarget.style.textDecorationColor = 'currentColor' }}
      onBlur={e => { e.currentTarget.style.textDecorationColor = 'transparent' }}
    >
      {children}
    </button>
  )
}

export default function MediaManager({
  type,
  canManage,
}: {
  type: MediaType
  canManage: boolean
}) {
  const [data, setData] = useState<AdminData | null>(null)
  const [page, setPage] = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const { toast } = useToast()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [viewItem, setViewItem] = useState<MediaItem | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('details')
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [source, setSource] = useState('')
  const [tags, setTags] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('id')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [editing, setEditing] = useState(false)
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [bulkImporting, setBulkImporting] = useState(false)
  const [showCsvImport, setShowCsvImport] = useState(false)
  const [csvImporting, setCsvImporting] = useState(false)
  const [showBulkOps, setShowBulkOps] = useState(false)
  const [bulkTagMode, setBulkTagMode] = useState<'add' | 'remove'>('add')
  const [bulkTagValue, setBulkTagValue] = useState('')
  const [bulkReassignValue, setBulkReassignValue] = useState('')
  const [bulkOperating, setBulkOperating] = useState(false)
  const [confirm, setConfirm] = useState<{
    title: string
    message: ReactNode
    onConfirm: () => Promise<void>
    /** When set, the user must type this exactly to arm the confirm button. */
    requireTyped?: string
  } | null>(null)
  const confirmBusy = deleting

  const buildParams = useCallback(
    (searchTerm: string) =>
      new URLSearchParams({
        type,
        page: String(page),
        perPage: String(PER_PAGE),
        search: searchTerm,
        source,
        tags,
        dateFrom,
        dateTo,
        sort,
        dir: sortDir,
      }),
    [type, page, source, tags, dateFrom, dateTo, sort, sortDir],
  )

  const fetchData = useCallback(async () => {
    const d = await jsonFetch<AdminData>(`/api/admin/${type}?${buildParams(debouncedSearch)}`)
    if (d) setData(d)
  }, [type, buildParams, debouncedSearch])

  useEffect(() => {
    // Typing should not fire a request per keystroke: wait for a pause in input.
    const timer = window.setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    Promise.resolve()
      .then(() => {
        if (cancelled) return null
        setRefreshing(true)
        setLoading(data === null)
        return jsonFetch<AdminData>(`/api/admin/${type}?${buildParams(debouncedSearch)}`, {
          signal: controller.signal,
        })
      })
      .then((d: AdminData | null) => {
        if (!cancelled && d) setData(d)
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      })
    return () => {
      cancelled = true
      controller.abort()
    }
    // `data` is read for the initial-load distinction only; excluded to avoid a refetch loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, buildParams, debouncedSearch])

  const filterKey = `${type}|${debouncedSearch}|${source}|${tags}|${dateFrom}|${dateTo}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey)
    setPage(1)
    setSelected(new Set())
  }

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (!data) return
    const currentIds = data.items.map(i => i.id)
    const allSelected = currentIds.every(id => selected.has(id))
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        currentIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        currentIds.forEach(id => next.add(id))
        return next
      })
    }
  }

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return
    setDeleting(true)
    const formData = new FormData()
    formData.set('action', 'delete_image')
    formData.set('pks', Array.from(selected).join(','))
    formData.set('type', type)
    const res = await fetch(`/api/admin/${type}`, { method: 'POST', body: formData })
    setDeleting(false)
    if (res.ok) {
      toast(`Deleted ${selected.size} item(s)`)
      setSelected(new Set())
      fetchData()
    } else {
      toast('Failed to delete', { tone: 'error' })
    }
  }

  const handleDelete = async (id: number) => {
    const formData = new FormData()
    formData.set('action', 'delete_image')
    formData.set('pks', String(id))
    formData.set('type', type)
    const res = await fetch(`/api/admin/${type}`, { method: 'POST', body: formData })
    if (res.ok) {
      toast('Item deleted')
      setViewItem(null)
      fetchData()
    } else {
      toast('Failed to delete', { tone: 'error' })
    }
  }

  const handleBulkImport = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBulkImporting(true)
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('action', 'bulk_import')
    formData.set('type', type)
    const res = await fetch(`/api/admin/${type}`, { method: 'POST', body: formData })
    const d = await res.json().catch(() => ({}))
    setBulkImporting(false)
    if (res.ok) {
      toast(`Imported ${d.created} record(s), skipped ${d.skipped} duplicate(s)`)
      setShowBulkImport(false)
      fetchData()
    } else {
      toast(d.error || 'Failed to import', { tone: 'error' })
    }
  }

  const handleDeleteFiltered = async () => {
    if (!data || data.total === 0) return
    setDeleting(true)
    const formData = new FormData()
    formData.set('action', 'delete_filtered')
    formData.set('type', type)
    formData.set('search', search)
    formData.set('source', source)
    formData.set('tags', tags)
    formData.set('dateFrom', dateFrom)
    formData.set('dateTo', dateTo)
    const res = await fetch(`/api/admin/${type}`, { method: 'POST', body: formData })
    const d = await res.json().catch(() => ({}))
    setDeleting(false)
    if (res.ok) {
      toast(`Deleted ${d.deleted} record(s)`)
      setSelected(new Set())
      fetchData()
    } else {
      toast(d.error || 'Failed to delete', { tone: 'error' })
    }
  }

  const runConfirmed = async (fn: () => Promise<void>) => {
    try {
      await fn()
    } finally {
      setConfirm(null)
    }
  }

  const askDeleteSelected = () => {
    if (selected.size === 0) return
    setConfirm({
      title: `Delete ${selected.size} selected item(s)?`,
      message: (
        <>
          This will permanently delete <strong>{selected.size}</strong> {type} record(s) you selected, and
          remove their files from disk. It cannot be undone.
        </>
      ),
      onConfirm: () => runConfirmed(handleDeleteSelected),
    })
  }

  const askDelete = (id: number) =>
    setConfirm({
      title: 'Delete this item?',
      message: <>This will permanently delete this {singular(type)}. This cannot be undone.</>,
      onConfirm: () => runConfirmed(() => handleDelete(id)),
    })

  /** Human summary of the filters in force, so the confirm text is concrete. */
  const activeFilterSummary = () => {
    const parts: string[] = []
    if (debouncedSearch.trim()) parts.push(`search “${debouncedSearch.trim()}”`)
    if (source) parts.push(`source “${source}”`)
    if (tags.trim()) parts.push(`tags “${tags.trim()}”`)
    if (dateFrom) parts.push(`from ${dateFrom}`)
    if (dateTo) parts.push(`to ${dateTo}`)
    return parts.length > 0 ? parts.join(', ') : 'no filter (the entire table)'
  }

  const askDeleteFiltered = () => {
    if (!data || data.total === 0) return
    setConfirm({
      title: 'Delete all filtered records?',
      message: (
        <>
          This will permanently delete <strong>{data.total}</strong> {type} record(s) matching{' '}
          <strong>{activeFilterSummary()}</strong>, and remove their files from disk. It cannot be undone.
        </>
      ),
      requireTyped: `delete ${data.total}`,
      onConfirm: () => runConfirmed(handleDeleteFiltered),
    })
  }

  const handleBulkTag = async () => {
    if (selected.size === 0 || !bulkTagValue.trim()) return
    setBulkOperating(true)
    const formData = new FormData()
    formData.set('action', 'bulk_tag')
    formData.set('type', type)
    formData.set('pks', Array.from(selected).join(','))
    formData.set('tags', bulkTagValue)
    formData.set('mode', bulkTagMode)
    const res = await fetch(`/api/admin/${type}`, { method: 'POST', body: formData })
    const d = await res.json().catch(() => ({}))
    setBulkOperating(false)
    if (res.ok) {
      toast(`Updated tags on ${d.updated} item(s)`)
      setShowBulkOps(false)
      setBulkTagValue('')
      setSelected(new Set())
      fetchData()
    } else {
      toast(d.error || 'Failed to update tags', { tone: 'error' })
    }
  }

  const handleBulkReassign = async () => {
    if (selected.size === 0 || !bulkReassignValue.trim()) return
    setBulkOperating(true)
    const formData = new FormData()
    formData.set('action', 'bulk_reassign')
    formData.set('type', type)
    formData.set('pks', Array.from(selected).join(','))
    formData.set('source', bulkReassignValue)
    const res = await fetch(`/api/admin/${type}`, { method: 'POST', body: formData })
    const d = await res.json().catch(() => ({}))
    setBulkOperating(false)
    if (res.ok) {
      toast(`Reassigned source on ${d.updated} item(s)`)
      setShowBulkOps(false)
      setBulkReassignValue('')
      setSelected(new Set())
      fetchData()
    } else {
      toast(d.error || 'Failed to reassign', { tone: 'error' })
    }
  }

  const handleCsvImport = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCsvImporting(true)
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('action', 'csv_import')
    formData.set('type', type)
    const res = await fetch(`/api/admin/${type}`, { method: 'POST', body: formData })
    const d = await res.json().catch(() => ({}))
    setCsvImporting(false)
    if (res.ok) {
      toast(`Imported ${d.created} record(s)${d.failed ? `, ${d.failed} failed` : ''}`)
      setShowCsvImport(false)
      fetchData()
    } else {
      toast(d.error || 'Failed to import', { tone: 'error' })
    }
  }

  const handleExportSelected = (format: 'json' | 'csv') => {
    if (selected.size === 0) return
    const items = (data?.items || []).filter(i => selected.has(i.id))
    let blob: Blob
    if (format === 'json') {
      blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' })
    } else {
      const fields = Object.keys(items[0] || {})
      const rows = [
        fields.join(','),
        ...items.map(it =>
          fields.map(f => `"${String(it[f] ?? '').replace(/"/g, '""')}"`).join(','),
        ),
      ]
      blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${type}_selected_${Date.now()}.${format}`
    a.click()
    URL.revokeObjectURL(url)
    toast(`Exported ${items.length} selected item(s)`)
  }

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('action', 'add')
    formData.set('type', type)
    const res = await fetch(`/api/admin/${type}`, { method: 'POST', body: formData })
    if (res.ok) {
      toast('Item added')
      setShowAdd(false)
      fetchData()
    } else {
      toast('Failed to add', { tone: 'error' })
    }
  }

  const handleEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!viewItem) return
    setEditing(true)
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('action', 'edit')
    formData.set('type', type)
    formData.set('id', String(viewItem.id))
    const res = await fetch(`/api/admin/${type}`, { method: 'POST', body: formData })
    setEditing(false)
    if (res.ok) {
      const d = await res.json().catch(() => ({}))
      toast(`Updated #${viewItem.id}`)
      setViewItem(d.item)
      setViewMode('details')
      fetchData()
    } else {
      const d = await res.json().catch(() => ({}))
      toast(d.error || 'Failed to update', { tone: 'error' })
    }
  }

  const handleExport = (format: 'json' | 'csv') => {
    const params = new URLSearchParams({ type, export: format, search, source, tags, dateFrom, dateTo })
    window.open(`/api/admin/${type}?${params}`, '_blank')
  }

  const handleSort = (field: string) => {
    if (sort === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(field)
      setSortDir('desc')
    }
  }

  const openView = (item: MediaItem) => {
    setViewItem(item)
    setViewMode('details')
  }

  const hasFilters = Boolean(search || source || tags || dateFrom || dateTo)
  const clearFilters = () => {
    setSearch('')
    setSource('')
    setTags('')
    setDateFrom('')
    setDateTo('')
  }
  const allIds = data?.items.map(i => i.id) || []
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id))
  const totalPages = data ? Math.ceil(data.total / PER_PAGE) : 1
  const showManagement = canManage

  return (
    <div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {showManagement && (
          <Button variant="primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add New
          </Button>
        )}
        {showManagement && (
          <Button variant="secondary" onClick={() => setShowBulkImport(true)}>
            <ListPlus size={14} /> Bulk Import
          </Button>
        )}
        {showManagement && (
          <Button variant="secondary" onClick={() => setShowCsvImport(true)}>
            <FileInput size={14} /> CSV Import
          </Button>
        )}
        {showManagement && selected.size > 0 && (
          <Button variant="secondary" style={{ color: 'var(--primary)' }} onClick={() => setShowBulkOps(true)}>
            <Tags size={14} /> Bulk Actions ({selected.size})
          </Button>
        )}
        {showManagement && data && data.total > 0 && (
          <Button variant="danger" onClick={askDeleteFiltered}
            disabled={deleting}>
            <Trash2 size={14} /> Delete All Filtered ({data.total})
          </Button>
        )}
        {showManagement && selected.size > 0 && (
          <Button variant="danger" onClick={askDeleteSelected}
            disabled={deleting}>
            <Trash2 size={14} /> Delete ({selected.size})
          </Button>
        )}
        <div className="flex-1" />
        {selected.size > 0 && (
          <>
            <Button variant="secondary" size="xs" style={{ color: 'var(--primary)' }} onClick={() => handleExportSelected('json')}
              title="Export only selected rows">
              <Download size={12} /> Sel. JSON
            </Button>
            <Button variant="secondary" size="xs" style={{ color: 'var(--primary)' }} onClick={() => handleExportSelected('csv')}
              title="Export only selected rows">
              <Download size={12} /> Sel. CSV
            </Button>
          </>
        )}
        <Button variant="secondary" size="xs" onClick={() => handleExport('json')}>
          <Download size={12} /> JSON
        </Button>
        <Button variant="secondary" size="xs" onClick={() => handleExport('csv')}>
          <Download size={12} /> CSV
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-50 max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50"
          />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm transition-colors"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          />
        </div>
        {data?.sources && data.sources.length > 0 && (
          <div className="relative">
            <select
              value={source}
              onChange={e => setSource(e.target.value)}
              className="appearance-none rounded-lg border py-2 pl-3 pr-8 text-sm cursor-pointer"
              style={{
                background: 'var(--card)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
            >
              <option value="">All Sources</option>
              {data.sources.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"
            />
          </div>
        )}
        {type !== 'images' && (
          <input
            type="text"
            placeholder="Tags (comma separated)"
            value={tags}
            onChange={e => setTags(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm max-w-52"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
              color: 'var(--foreground)',
            }}
          />
        )}
        <input
          type="date"
          value={dateFrom}
          onChange={e => setDateFrom(e.target.value)}
          title="Collected from"
          className="rounded-lg border px-3 py-2 text-sm"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
        />
        <span className="self-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
          to
        </span>
        <input
          type="date"
          value={dateTo}
          onChange={e => setDateTo(e.target.value)}
          title="Collected to"
          className="rounded-lg border px-3 py-2 text-sm"
          style={{
            background: 'var(--card)',
            borderColor: 'var(--border)',
            color: 'var(--foreground)',
          }}
        />
        {hasFilters && (
          <Button variant="secondary" size="xs" style={{ color: 'var(--danger)' }} onClick={clearFilters}>
            Clear
          </Button>
        )}
      </div>

      {/* Result summary */}
      {!loading && data && data.items.length > 0 && (
        <p
          aria-live="polite"
          className="mb-3 text-xs"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {refreshing
            ? 'Updating…'
            : `Showing ${data.items.length} of ${data.total} ${type}${
                data.total > data.items.length ? ` · page ${page} of ${totalPages}` : ''
              }`}
        </p>
      )}

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          message={hasFilters ? `No ${type} match these filters.` : `No ${type} found.`}
          icon={<FileText size={48} />}
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="card table-wrap table-cards">
            <table className="media-table" style={{ '--table-min': type === 'images' ? '600px' : '800px' } as React.CSSProperties}>
              <caption className="sr-only">
                {MEDIA_LABELS[type]} records,{' '}
                {data.total === 0
                  ? 'none'
                  : `page ${page} of ${totalPages}, ${data.total} total`}
              </caption>
              <thead>
                <tr>
                  {showManagement && (
                    <th scope="col" style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        aria-label={
                          allSelected
                            ? `Deselect all ${type} on this page`
                            : `Select all ${type} on this page`
                        }
                        className="cursor-pointer"
                      />
                    </th>
                  )}
                  <th
                    scope="col"
                    style={{ width: '50px' }}
                    aria-sort={
                      sort === 'id' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                    }
                  >
                    <button
                      onClick={() => handleSort('id')}
                      className="flex items-center gap-1 hover:underline"
                    >
                      ID <span className="sr-only">— click to sort</span>
                      {sort === 'id' &&
                        (sortDir === 'asc' ? (
                          <ChevronUp size={14} aria-hidden />
                        ) : (
                          <ChevronDown size={14} aria-hidden />
                        ))}
                    </button>
                  </th>
                  <th scope="col" style={{ width: '80px' }}>Preview</th>
                  <th scope="col">Details</th>
                  <th scope="col" style={{ width: '150px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(item => (
                  <tr
                    key={item.id}
                    className="stagger-item"
                    style={{
                      background: selected.has(item.id) ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : undefined,
                    }}
                  >
                    {showManagement && (
                      <td className="select-cell">
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          aria-label={`Select record #${item.id}`}
                          className="cursor-pointer"
                        />
                      </td>
                    )}
                    <td data-label="ID" className="font-semibold">{item.id}</td>
                    <td data-label="Preview">
                      {type === 'images' && (
                        <MediaThumb item={item} onOpen={() => openView(item)} />
                      )}
                      {type === 'videos' && (
                        <Button variant="secondary" iconOnly style={{ width: '64px', height: '48px' }} onClick={() => openView(item)}
                          title="View video"
                          aria-label={`View video ${item.title?.slice(0, 60) || `#${item.id}`}`}>
                          <Play size={20} />
                        </Button>
                      )}
                      {type === 'audio' && (
                        <Button variant="secondary" iconOnly style={{ width: '64px', height: '48px' }} onClick={() => openView(item)}
                          title="View audio"
                          aria-label={`View audio ${item.title?.slice(0, 60) || `#${item.id}`}`}>
                          <Music size={20} />
                        </Button>
                      )}
                      {type === 'news' && (
                        <Button variant="secondary" iconOnly style={{ width: '64px', height: '48px' }} onClick={() => openView(item)}
                          title="View article"
                          aria-label={`View article ${item.title?.slice(0, 60) || `#${item.id}`}`}>
                          <FileText size={20} />
                        </Button>
                      )}
                    </td>
                    <td data-label="Details" className="text-sm leading-relaxed">
                      {type === 'images' && (
                        <div>
                          <div className="font-semibold">Source: {item.source || '-'}</div>
                          <div className="text-xs truncate max-w-62.5" style={{ color: 'var(--muted-foreground)' }}>
                            {item.url ? (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-(--primary) no-underline"
                              >
                                {item.url.slice(0, 60)}...
                              </a>
                            ) : (
                              '-'
                            )}
                          </div>
                          {item.query && (
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                              Query: {item.query}
                            </div>
                          )}
                        </div>
                      )}
                      {type === 'videos' && (
                        <div>
                          <div className="font-semibold">
                            <TitleButton onOpen={() => openView(item)}>
                              {item.title?.slice(0, 80) || 'Untitled'}
                            </TitleButton>
                          </div>
                          <div style={{ color: 'var(--muted-foreground)' }}>
                            {item.channel && <span>Channel: {item.channel}</span>}
                            {item.views != null && (
                              <span> · {item.views.toLocaleString()} views</span>
                            )}
                            {item.duration ? <span> · {formatDuration(item.duration)}</span> : ''}
                          </div>
                        </div>
                      )}
                      {type === 'news' && (
                        <div>
                          <div className="font-semibold">
                            <TitleButton onOpen={() => openView(item)}>
                              {item.title?.slice(0, 80) || 'Untitled'}
                            </TitleButton>
                          </div>
                          {item.sourceName && (
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                              {item.sourceName}
                            </div>
                          )}
                          {item.snippet && (
                            <div
                              className="text-xs truncate max-w-62.5 mt-0.5"
                              style={{ color: 'var(--muted-foreground)' }}
                            >
                              {item.snippet.replace(/<[^>]*>/g, '').slice(0, 100)}...
                            </div>
                          )}
                        </div>
                      )}
                      {type === 'audio' && (
                        <div>
                          <div className="font-semibold">
                            <TitleButton onOpen={() => openView(item)}>
                              {item.title?.slice(0, 80) || 'Untitled'}
                            </TitleButton>
                          </div>
                          {item.artist && (
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                              Artist: {item.artist}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td data-label="Actions" data-wide>
                      <div className="flex gap-1 justify-end">
                        <Button variant="secondary" iconOnly onClick={() => openView(item)}
                          title="View"
                          aria-label={`View record #${item.id}`}>
                          <Eye size={14} />
                        </Button>
                        {showManagement && (
                          <>
                            <Button variant="secondary" iconOnly style={{ color: 'var(--primary)' }} onClick={() => {
                                setViewItem(item)
                                setViewMode('edit')
                              }}
                              title="Edit"
                              aria-label={`Edit record #${item.id}`}>
                              <Pencil size={14} />
                            </Button>
                            <Button variant="secondary" iconOnly style={{ color: 'var(--success)' }} onClick={() => {
                                setViewItem(item)
                                setViewMode('public')
                              }}
                              title="Public preview"
                              aria-label={`Public preview of record #${item.id}`}>
                              <Monitor size={14} />
                            </Button>
                          </>
                        )}
                        {item.url && (
                          <AnimLink
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Source"
                            style={{
                              padding: '0.375rem',
                              background: 'var(--card)',
                              border: '1px solid var(--border)',
                              color: 'var(--primary)',
                            }}
                          >
                            <ExternalLink size={14} />
                          </AnimLink>
                        )}
                        {showManagement && (
                          <Button variant="danger" iconOnly onClick={() => askDelete(item.id)}
                            title="Delete"
                            aria-label={`Delete record #${item.id}`}>
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} maxWidth="600px">
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4">Add New {singular(type)}</h2>
          <form onSubmit={handleAdd}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {[
                'source',
                'query',
                'url',
                ...(type === 'videos' ? ['platform', 'title', 'channel', 'duration', 'views'] : []),
                ...(type === 'news' ? ['title', 'sourceName', 'date', 'snippet'] : []),
                ...(type === 'audio' ? ['title', 'artist', 'duration'] : []),
              ]
                .filter((v, i, a) => a.indexOf(v) === i)
                .map(f => (
                  <div key={f}>
                    <label className="block text-xs font-semibold mb-1">
                      {f === 'url'
                        ? 'URL (optional if file uploaded)'
                        : f.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                    </label>
                    <input
                      name={f}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      style={{
                        background: 'var(--background)',
                        borderColor: 'var(--border)',
                        color: 'var(--foreground)',
                      }}
                    />
                  </div>
                ))}
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1">
                Upload file from computer
              </label>
              <input
                type="file"
                name="file"
                accept={
                  type === 'images'
                    ? 'image/*'
                    : type === 'videos'
                    ? 'video/*'
                    : type === 'audio'
                    ? 'audio/*'
                    : undefined
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
              <p className="text-xs mt-1 opacity-60">
                If you upload a file, it will be stored locally and used instead of a link.
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold"
                style={{
                  background: 'var(--primary)',
                  color: 'var(--primary-fg)',
                  cursor: 'pointer',
                  border: 'none',
                }}
              >
                <Plus size={14} /> Add Item
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Bulk Import (URL) Modal */}
      <Modal open={showBulkImport} onClose={() => setShowBulkImport(false)} maxWidth="600px">
        <div className="p-6">
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
            <ListPlus size={16} /> Bulk Import by URL
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
            Paste one URL per line. Duplicates are automatically skipped.
          </p>
          <form onSubmit={handleBulkImport}>
            <div className="grid grid-cols-1 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Source</label>
                <input
                  name="source"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    background: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Query (optional)</label>
                <input
                  name="query"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    background: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">URLs</label>
                <textarea
                  name="urls"
                  rows={8}
                  placeholder={'https://example.com/one.jpg\nhttps://example.com/two.jpg'}
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                  style={{
                    background: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                  required
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowBulkImport(false)}>
                Cancel
              </Button>
              <button
                type="submit"
                disabled={bulkImporting}
                className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold"
                style={{
                  background: 'var(--primary)',
                  color: 'var(--primary-fg)',
                  cursor: bulkImporting ? 'not-allowed' : 'pointer',
                  border: 'none',
                }}
              >
                <ListPlus size={14} /> {bulkImporting ? 'Importing...' : 'Import'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* CSV Import Modal */}
      <Modal open={showCsvImport} onClose={() => setShowCsvImport(false)} maxWidth="600px">
        <div className="p-6">
          <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
            <FileInput size={16} /> CSV Import
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--muted-foreground)' }}>
            One row per line. Columns: <strong>url, title, notes, tags</strong>. Duplicate URLs are
            skipped.
          </p>
          <form onSubmit={handleCsvImport}>
            <div className="grid grid-cols-1 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Source (applies to all rows)
                </label>
                <input
                  name="source"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    background: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">CSV Data</label>
                <textarea
                  name="csv"
                  rows={8}
                  placeholder={
                    'https://example.com/a.jpg,Title A,note,tag1\nhttps://example.com/b.jpg,Title B,,tag2'
                  }
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                  style={{
                    background: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                  required
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowCsvImport(false)}>
                Cancel
              </Button>
              <button
                type="submit"
                disabled={csvImporting}
                className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold"
                style={{
                  background: 'var(--primary)',
                  color: 'var(--primary-fg)',
                  cursor: csvImporting ? 'not-allowed' : 'pointer',
                  border: 'none',
                }}
              >
                <FileInput size={14} /> {csvImporting ? 'Importing...' : 'Import'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Bulk Operations Modal */}
      <Modal open={showBulkOps} onClose={() => setShowBulkOps(false)} maxWidth="500px">
        <div className="p-6">
          <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
            <Tags size={16} /> Bulk Actions
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
            Apply to <strong>{selected.size}</strong> selected {type} record(s).
          </p>
          <div className="space-y-4">
            <div>
              <div className="flex gap-2 items-center mb-1">
                <label className="block text-xs font-semibold">Tags</label>
                <select
                  value={bulkTagMode}
                  onChange={e => setBulkTagMode(e.target.value as 'add' | 'remove')}
                  className="rounded-lg border px-2 py-1 text-xs cursor-pointer"
                  style={{
                    background: 'var(--card)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                >
                  <option value="add">Add</option>
                  <option value="remove">Remove</option>
                </select>
              </div>
              <input
                value={bulkTagValue}
                onChange={e => setBulkTagValue(e.target.value)}
                placeholder="Comma separated tags"
                className="w-full rounded-lg border px-3 py-2 text-sm mb-1"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
              <div className="flex justify-end">
                <Button variant="primary" onClick={handleBulkTag}
                  disabled={bulkOperating || !bulkTagValue.trim()}>
                  Apply Tags
                </Button>
              </div>
            </div>
            <div className="border-t" style={{ borderColor: 'var(--border)', paddingTop: '1rem' }}>
              <label className="block text-xs font-semibold mb-1">Reassign Source</label>
              <input
                value={bulkReassignValue}
                onChange={e => setBulkReassignValue(e.target.value)}
                placeholder="New source value"
                className="w-full rounded-lg border px-3 py-2 text-sm mb-1"
                style={{
                  background: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
              <div className="flex justify-end">
                <Button variant="primary" onClick={handleBulkReassign}
                  disabled={bulkOperating || !bulkReassignValue.trim()}>
                  Reassign Source
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* View / Edit / Public Modal */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} maxWidth="900px">
        {viewItem && (
          <div>
            {/* Mode tabs */}
            <div className="flex items-center gap-2 px-6 pt-5 border-b" style={{ borderColor: 'var(--border)' }}>
              <ModeTab
                active={viewMode === 'details'}
                onClick={() => setViewMode('details')}
                label="Details"
                icon={<Eye size={14} />}
              />
              {showManagement && (
                <ModeTab
                  active={viewMode === 'edit'}
                  onClick={() => setViewMode('edit')}
                  label="Edit"
                  icon={<Pencil size={14} />}
                />
              )}
              <ModeTab
                active={viewMode === 'public'}
                onClick={() => setViewMode('public')}
                label="Public Preview"
                icon={<Monitor size={14} />}
              />
              <div className="flex-1" />
              <AnimLink
                href={`/${type}/${viewItem.id}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open public page"
                style={{
                  padding: '0.375rem 0.5rem',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  color: 'var(--primary)',
                  marginBottom: '0.5rem',
                }}
              >
                <ExternalLink size={14} /> Open page
              </AnimLink>
            </div>

            {viewMode === 'edit' ? (
              // `key` remounts the form when the record changes, so its local
              // field state can never show a previous item's values.
              <EditForm
                key={viewItem.id}
                type={type}
                item={viewItem}
                onSave={handleEdit}
                saving={editing}
              />
            ) : viewMode === 'public' ? (
              <div className="p-6">
                <PublicPreview type={type} item={viewItem} />
              </div>
            ) : (
              <DetailsView
                type={type}
                item={viewItem}
                getMediaUrl={getMediaUrl}
                isYouTubeUrl={isYouTubeUrl}
                getYouTubeEmbedUrl={getYouTubeEmbedUrl}
                onDelete={showManagement ? () => askDelete(viewItem.id) : undefined}
                onEdit={showManagement ? () => setViewMode('edit') : undefined}
              />
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title || 'Confirm delete'}
        message={confirm?.message}
        busy={confirmBusy}
        requireTyped={confirm?.requireTyped}
        onConfirm={() => confirm?.onConfirm()}
        onClose={() => setConfirm(null)}
      />
    </div>
  )
}

function ModeTab({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean
  onClick: () => void
  label: string
  icon: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 pb-2.5 px-1 font-semibold text-sm"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: active ? 'var(--primary)' : 'var(--muted-foreground)',
        borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
        marginBottom: '-1px',
      }}
    >
      {icon} {label}
    </button>
  )
}

/* ---------- Details view ---------- */

function DetailsView({
  type,
  item,
  getMediaUrl: getUrl,
  isYouTubeUrl: isYT,
  getYouTubeEmbedUrl: getYt,
  onDelete,
  onEdit,
}: {
  type: MediaType
  item: MediaItem
  getMediaUrl: (i: MediaItem) => string | null
  isYouTubeUrl: (u: string) => boolean
  getYouTubeEmbedUrl: (u: string) => string | null
  onDelete?: () => void
  onEdit?: () => void
}) {
  return (
    <div>
      {type === 'images' && (
        <div>
          <div className="flex items-center justify-center min-h-75" style={{ background: 'var(--muted)' }}>
            {getUrl(item) ? (
              <div className="relative w-full max-h-[45vh] h-[45vh]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getUrl(item) || ''}
                  alt=""
                  style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                />
              </div>
            ) : null}
          </div>
          <div className="p-6">
            <h2 className="text-lg font-bold mb-3">Image Details</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><strong>ID:</strong> {item.id}</div>
              <div><strong>Source:</strong> {item.source || '-'}</div>
              <div className="col-span-2">
                <strong>URL:</strong>{' '}
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-(--primary)">
                    {item.url.slice(0, 80)}...
                  </a>
                ) : (
                  '-'
                )}
              </div>
              {item.query && <div className="col-span-2"><strong>Query:</strong> {item.query}</div>}
              {item.faceCount != null && <div><strong>Faces:</strong> {item.faceCount}</div>}
              {item.faceMatch != null && (
                <div><strong>Face match:</strong> {item.faceMatch ? 'Yes' : 'No'}</div>
              )}
              {item.collectedAt && (
                <div className="col-span-2"><strong>Collected:</strong> {item.collectedAt}</div>
              )}
            </div>
            <ModalActions mediaUrl={getUrl(item)} onDelete={onDelete} onEdit={onEdit} />
          </div>
        </div>
      )}

      {type === 'videos' && (
        <div>
          <div className="w-full aspect-video bg-black flex items-center justify-center">
            {getUrl(item) && isYT(getUrl(item)!) ? (
              <iframe
                src={getYt(getUrl(item)!) || undefined}
                className="w-full h-full border-none"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : getUrl(item) ? (
              <video src={getUrl(item) || ''} controls className="w-full h-full" />
            ) : (
              <div className="text-white p-8">No video source available</div>
            )}
          </div>
          <div className="p-6">
            <h2 className="text-lg font-bold mb-2">{item.title || 'Untitled'}</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><strong>ID:</strong> {item.id}</div>
              <div><strong>Platform:</strong> {item.platform || '-'}</div>
              <div><strong>Channel:</strong> {item.channel || '-'}</div>
              <div><strong>Views:</strong> {item.views?.toLocaleString() || '-'}</div>
            </div>
            <ModalActions mediaUrl={getUrl(item)} onDelete={onDelete} onEdit={onEdit} />
          </div>
        </div>
      )}

      {type === 'news' && (
        <div className="p-6">
          <h2 className="text-lg font-bold mb-1">{item.title || 'Untitled'}</h2>
          <div className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
            {item.sourceName} · {item.date}
          </div>
          {item.snippet && (
            <div
              className="p-4 rounded-lg text-sm leading-relaxed mb-4"
              style={{ background: 'var(--muted)', whiteSpace: 'pre-line', wordBreak: 'break-word' }}
            >
              {String(item.snippet).replace(/<[^>]*>/g, ' ')}
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold no-underline"
                style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}
              >
                <ExternalLink size={14} /> Open Article
              </a>
            )}
            {onEdit && (
              <Button variant="secondary" style={{ color: 'var(--primary)' }} onClick={onEdit}>
                <Pencil size={14} /> Edit
              </Button>
            )}
            {onDelete && (
              <Button variant="danger" onClick={onDelete}>
                <Trash2 size={14} /> Delete
              </Button>
            )}
          </div>
        </div>
      )}

      {type === 'audio' && (
        <div>
          <div
            className="flex flex-col items-center justify-center py-12 px-8"
            style={{ background: 'var(--muted)' }}
          >
            <Music size={48} className="mb-4 opacity-50" />
            {getUrl(item) ? (
              <audio src={getUrl(item) || ''} controls className="w-full max-w-md" />
            ) : (
              <div style={{ color: 'var(--muted-foreground)' }}>No audio source</div>
            )}
          </div>
          <div className="p-6">
            <h2 className="text-lg font-bold mb-2">{item.title || 'Untitled'}</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><strong>ID:</strong> {item.id}</div>
              <div><strong>Artist:</strong> {item.artist || '-'}</div>
              <div><strong>Source:</strong> {item.source || '-'}</div>
              {item.duration && <div><strong>Duration:</strong> {item.duration}s</div>}
            </div>
            <ModalActions mediaUrl={getUrl(item)} onDelete={onDelete} onEdit={onEdit} />
          </div>
        </div>
      )}
    </div>
  )
}

function ModalActions({
  mediaUrl,
  onDelete,
  onEdit,
}: {
  mediaUrl: string | null
  onDelete?: () => void
  onEdit?: () => void
}) {
  return (
    <div className="flex gap-2 mt-4 flex-wrap">
      {mediaUrl && (
        <a
          href={mediaUrl}
          download
          className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold no-underline"
          style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}
        >
          <Download size={14} /> Download
        </a>
      )}
      {onEdit && (
        <Button variant="secondary" style={{ color: 'var(--primary)' }} onClick={onEdit}>
          <Pencil size={14} /> Edit
        </Button>
      )}
      {onDelete && (
        <Button variant="danger" onClick={onDelete}>
          <Trash2 size={14} /> Delete
        </Button>
      )}
    </div>
  )
}

/* ---------- Public preview ---------- */

function PublicPreview({ type, item }: { type: MediaType; item: MediaItem }) {
  const mediaUrl = getMediaUrl(item)

  return (
    <div>
      <div
        className="text-xs font-semibold uppercase tracking-wide mb-3"
        style={{ color: 'var(--muted-foreground)' }}
      >
        Public preview — how visitors see this on the site
      </div>

      {type === 'images' && (
        <div
          className="grid"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}
        >
          <div className="card" style={{ cursor: 'default', padding: '0.75rem' }}>
            <div
              style={{
                width: '100%',
                height: '160px',
                overflow: 'hidden',
                borderRadius: '0.25rem',
                marginBottom: '0.5rem',
                background: 'var(--background)',
              }}
            >
              {mediaUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </>
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--muted)',
                    fontSize: '0.75rem',
                  }}
                >
                  No preview
                </div>
              )}
            </div>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--muted)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>{item.source || 'Unknown'}</span>
              <span>#{item.id}</span>
            </div>
            {item.faceMatch ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
                Face match
              </div>
            ) : null}
          </div>
        </div>
      )}

      {type === 'videos' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, background: '#000' }}>
            {mediaUrl && isYouTubeUrl(mediaUrl) ? (
              <iframe
                src={getYouTubeEmbedUrl(mediaUrl) || undefined}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
                allowFullScreen
                allow="autoplay"
              />
            ) : mediaUrl ? (
              <video
                controls
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              >
                <source src={mediaUrl} />
              </video>
            ) : (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  padding: '1rem',
                  textAlign: 'center',
                }}
              >
                No video source available
              </div>
            )}
          </div>
          <div className="p-4">
            <h3 className="font-semibold mb-1">{item.title || 'Untitled'}</h3>
            <div className="text-xs text-(--muted-foreground) space-y-0.5" style={{ color: 'var(--muted-foreground)' }}>
              {item.channel && <div>Channel: {item.channel}</div>}
              {item.views != null && <div>{item.views.toLocaleString()} views</div>}
              {item.duration ? <div>Duration: {formatDuration(item.duration)}</div> : null}
            </div>
          </div>
        </div>
      )}

      {type === 'news' && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <h2 className="text-xl font-bold mb-1">{item.title || `News #${item.id}`}</h2>
          <div className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
            {item.sourceName || 'Unknown source'}
            {item.date ? ` · ${item.date}` : ''}
          </div>
          {item.snippet && (
            <div
              className="p-4 rounded-lg text-sm leading-relaxed"
              style={{ background: 'var(--background)', lineHeight: 1.6 }}
            >
              {item.snippet}
            </div>
          )}
          {item.url && (
            <div className="mt-3 text-sm">
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                Open source URL <ExternalLink size={13} />
              </a>
            </div>
          )}
        </div>
      )}

      {type === 'audio' && (
        <div className="card" style={{ padding: '1.5rem' }}>
          <h2 className="text-lg font-bold mb-3">{item.title || `Audio #${item.id}`}</h2>
          {item.artist && (
            <div className="text-sm mb-3" style={{ color: 'var(--muted-foreground)' }}>
              {item.artist}
            </div>
          )}
          {mediaUrl ? (
            <audio controls style={{ width: '100%' }}>
              <source src={mediaUrl} />
            </audio>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
              No audio available for playback
            </div>
          )}
          {item.url && (
            <div className="mt-3 text-sm">
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                Open source URL <ExternalLink size={13} />
              </a>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-center mt-4">
        <Link
          href={`/${type}/${item.id}`}
          target="_blank"
          className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold no-underline"
          style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}
        >
          <ExternalLink size={14} /> Open live public page
        </Link>
      </div>
    </div>
  )
}

/* ---------- Edit form ---------- */

/**
 * Derived provenance values computed by the ingest pipeline. They are shown in
 * the editor for context but are not hand-editable — letting an editor retype a
 * face-match score would silently corrupt the record.
 */
const READONLY_FIELDS: Record<MediaType, string[]> = {
  images: ['faceDetected', 'faceCount', 'faceMatch', 'faceMatchScore', 'faceMatchDistance'],
  videos: [],
  news: [],
  audio: [],
}

const EDITABLE_FIELDS: Record<MediaType, string[]> = {
  images: ['source', 'query', 'url'],
  videos: ['source', 'platform', 'title', 'url', 'channel', 'duration', 'views', 'category', 'caption', 'date', 'year', 'event', 'location', 'theme', 'featured', 'status'],
  news: ['source', 'query', 'title', 'url', 'sourceName', 'date', 'snippet'],
  audio: ['source', 'query', 'title', 'url', 'artist', 'duration', 'category', 'caption', 'date', 'year', 'event', 'location', 'theme', 'featured', 'status'],
}

function EditForm({
  type,
  item,
  onSave,
  saving,
}: {
  type: MediaType
  item: MediaItem
  onSave: (e: FormEvent<HTMLFormElement>) => void
  saving: boolean
}) {
  const fields = EDITABLE_FIELDS[type]
  const readOnly = READONLY_FIELDS[type].filter(f => item[f] !== null && item[f] !== undefined && item[f] !== '')
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const f of fields) init[f] = item[f] === null || item[f] === undefined ? '' : String(item[f])
    return init
  })

  return (
    <div className="p-6">
      <h2 className="text-lg font-bold mb-1">
        Edit {singular(type)} #{item.id}
      </h2>
      <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
        Update the fields below and save. Changes are reflected immediately.
      </p>
      <form onSubmit={onSave}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {fields.map(f => (
            <div key={f}>
              <label className="block text-xs font-semibold mb-1">
                {f === 'videoUrl' || f === 'audioUrl' || f === 'photoUrl' ? f.replace(/Url$/, ' URL').replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()) : f.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
              </label>
              {f === 'snippet' || f === 'caption' ? (
                <textarea
                  name={f}
                  value={values[f] || ''}
                  onChange={e => setValues(v => ({ ...v, [f]: e.target.value }))}
                  rows={f === 'snippet' ? 4 : 3}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    background: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              ) : f === 'status' ? (
                <select
                  name={f}
                  value={values[f] || 'published'}
                  onChange={e => setValues(v => ({ ...v, [f]: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  {['published', 'draft', 'archived'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : f === 'featured' ? (
                <select
                  name={f}
                  value={values[f] === 'true' ? 'true' : 'false'}
                  onChange={e => setValues(v => ({ ...v, [f]: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              ) : (
                <input
                  name={f}
                  type={f === 'year' ? 'number' : 'text'}
                  value={values[f] || ''}
                  onChange={e => setValues(v => ({ ...v, [f]: e.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    background: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {readOnly.length > 0 && (
          <fieldset
            disabled
            className="mb-4 rounded-lg border p-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <legend className="px-1 text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
              Derived by the ingest pipeline — not editable
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {readOnly.map(f => (
                <div key={f} className="flex items-baseline gap-2 text-xs">
                  <span style={{ color: 'var(--muted-foreground)' }}>
                    {f.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                  </span>
                  <span className="font-mono" style={{ color: 'var(--foreground)' }}>
                    {String(item[f])}
                  </span>
                </div>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold"
            style={{
              background: 'var(--primary)',
              color: 'var(--primary-fg)',
              cursor: saving ? 'not-allowed' : 'pointer',
              border: 'none',
            }}
          >
            {saving ? (
              <>
                <Save size={14} /> Saving...
              </>
            ) : (
              <>
                <Save size={14} /> Save Changes
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}