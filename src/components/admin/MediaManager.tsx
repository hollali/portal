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
  type LucideIcon,
} from 'lucide-react'
import { Modal, AnimBtn, AnimLink, Toast, SkeletonTable, EmptyState, ConfirmDialog } from '@/components/ui'
import { Pagination } from '@/components/ui/Pagination'
import { localToMediaUrl, isYouTubeUrl, getYouTubeEmbedUrl } from '@/lib/media'

export type MediaType = 'images' | 'videos' | 'news' | 'audio'

export const MEDIA_TYPES: MediaType[] = ['images', 'videos', 'news', 'audio']

export const MEDIA_LABELS: Record<MediaType, string> = {
  images: 'Images',
  videos: 'Videos',
  news: 'News',
  audio: 'Audio',
}

export const MEDIA_ICONS: Record<MediaType, LucideIcon> = {
  images: FileText,
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
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [viewItem, setViewItem] = useState<MediaItem | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('details')
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
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
  const [confirm, setConfirm] = useState<{ title: string; message: ReactNode; onConfirm: () => Promise<void> } | null>(null)
  const confirmBusy = deleting

  const buildParams = useCallback(
    () =>
      new URLSearchParams({
        type,
        page: String(page),
        perPage: '20',
        search,
        source,
        tags,
        dateFrom,
        dateTo,
        sort,
        dir: sortDir,
      }),
    [type, page, search, source, tags, dateFrom, dateTo, sort, sortDir],
  )

  const fetchData = useCallback(async () => {
    const d = await jsonFetch<AdminData>(`/api/admin/${type}?${buildParams()}`)
    if (d) setData(d)
  }, [type, buildParams])

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(() => setLoading(true))
      .then(() => jsonFetch<AdminData>(`/api/admin/${type}?${buildParams()}`))
      .then((d: AdminData | null) => {
        if (active && d) setData(d)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [type, buildParams])

  const filterKey = `${type}|${search}|${source}|${tags}|${dateFrom}|${dateTo}`
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
      setToast({ message: `Deleted ${selected.size} item(s)` })
      setSelected(new Set())
      fetchData()
    } else {
      setToast({ message: 'Failed to delete', type: 'error' })
    }
  }

  const handleDelete = async (id: number) => {
    const formData = new FormData()
    formData.set('action', 'delete_image')
    formData.set('pks', String(id))
    formData.set('type', type)
    const res = await fetch(`/api/admin/${type}`, { method: 'POST', body: formData })
    if (res.ok) {
      setToast({ message: 'Item deleted' })
      setViewItem(null)
      fetchData()
    } else {
      setToast({ message: 'Failed to delete', type: 'error' })
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
      setToast({ message: `Imported ${d.created} record(s), skipped ${d.skipped} duplicate(s)` })
      setShowBulkImport(false)
      fetchData()
    } else {
      setToast({ message: d.error || 'Failed to import', type: 'error' })
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
      setToast({ message: `Deleted ${d.deleted} record(s)` })
      setSelected(new Set())
      fetchData()
    } else {
      setToast({ message: d.error || 'Failed to delete', type: 'error' })
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
      title: `Delete ${selected.size} item(s)?`,
      message: <>This will permanently delete the <strong>{selected.size}</strong> selected {type} record(s). This cannot be undone.</>,
      onConfirm: () => runConfirmed(handleDeleteSelected),
    })
  }

  const askDelete = (id: number) =>
    setConfirm({
      title: 'Delete this item?',
      message: <>This will permanently delete this {singular(type)}. This cannot be undone.</>,
      onConfirm: () => runConfirmed(() => handleDelete(id)),
    })

  const askDeleteFiltered = () => {
    if (!data || data.total === 0) return
    setConfirm({
      title: 'Delete all filtered records?',
      message: <>This will delete ALL <strong>{data.total}</strong> currently filtered {type} record(s). This cannot be undone.</>,
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
      setToast({ message: `Updated tags on ${d.updated} item(s)` })
      setShowBulkOps(false)
      setBulkTagValue('')
      setSelected(new Set())
      fetchData()
    } else {
      setToast({ message: d.error || 'Failed to update tags', type: 'error' })
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
      setToast({ message: `Reassigned source on ${d.updated} item(s)` })
      setShowBulkOps(false)
      setBulkReassignValue('')
      setSelected(new Set())
      fetchData()
    } else {
      setToast({ message: d.error || 'Failed to reassign', type: 'error' })
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
      setToast({
        message: `Imported ${d.created} record(s)${d.failed ? `, ${d.failed} failed` : ''}`,
      })
      setShowCsvImport(false)
      fetchData()
    } else {
      setToast({ message: d.error || 'Failed to import', type: 'error' })
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
    setToast({ message: `Exported ${items.length} selected item(s)` })
  }

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('action', 'add')
    formData.set('type', type)
    const res = await fetch(`/api/admin/${type}`, { method: 'POST', body: formData })
    if (res.ok) {
      setToast({ message: 'Item added' })
      setShowAdd(false)
      fetchData()
    } else {
      setToast({ message: 'Failed to add', type: 'error' })
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
      setToast({ message: `Updated #${viewItem.id}` })
      setViewItem(d.item)
      setViewMode('details')
      fetchData()
    } else {
      const d = await res.json().catch(() => ({}))
      setToast({ message: d.error || 'Failed to update', type: 'error' })
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

  const allIds = data?.items.map(i => i.id) || []
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id))
  const totalPages = data ? Math.ceil(data.total / 20) : 1
  const showManagement = canManage

  return (
    <div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {showManagement && (
          <AnimBtn
            onClick={() => setShowAdd(true)}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--primary)',
              color: 'var(--primary-fg)',
              fontWeight: 600,
              fontSize: '0.875rem',
              gap: '0.375rem',
            }}
          >
            <Plus size={14} /> Add New
          </AnimBtn>
        )}
        {showManagement && (
          <AnimBtn
            onClick={() => setShowBulkImport(true)}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
              fontWeight: 600,
              fontSize: '0.875rem',
              gap: '0.375rem',
            }}
          >
            <ListPlus size={14} /> Bulk Import
          </AnimBtn>
        )}
        {showManagement && (
          <AnimBtn
            onClick={() => setShowCsvImport(true)}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
              fontWeight: 600,
              fontSize: '0.875rem',
              gap: '0.375rem',
            }}
          >
            <FileInput size={14} /> CSV Import
          </AnimBtn>
        )}
        {showManagement && selected.size > 0 && (
          <AnimBtn
            onClick={() => setShowBulkOps(true)}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--primary)',
              fontWeight: 600,
              fontSize: '0.875rem',
              gap: '0.375rem',
            }}
          >
            <Tags size={14} /> Bulk Actions ({selected.size})
          </AnimBtn>
        )}
        {showManagement && data && data.total > 0 && (
          <AnimBtn
            onClick={askDeleteFiltered}
            disabled={deleting}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--danger)',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.875rem',
              gap: '0.375rem',
            }}
          >
            <Trash2 size={14} /> Delete All Filtered ({data.total})
          </AnimBtn>
        )}
        {showManagement && selected.size > 0 && (
          <AnimBtn
            onClick={askDeleteSelected}
            disabled={deleting}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--danger)',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.875rem',
              gap: '0.375rem',
            }}
          >
            <Trash2 size={14} /> Delete ({selected.size})
          </AnimBtn>
        )}
        <div className="flex-1" />
        {selected.size > 0 && (
          <>
            <AnimBtn
              onClick={() => handleExportSelected('json')}
              title="Export only selected rows"
              style={{
                padding: '0.5rem 0.75rem',
                background: 'var(--card)',
                border: '1px solid var(--primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                gap: '0.25rem',
                color: 'var(--primary)',
              }}
            >
              <Download size={12} /> Sel. JSON
            </AnimBtn>
            <AnimBtn
              onClick={() => handleExportSelected('csv')}
              title="Export only selected rows"
              style={{
                padding: '0.5rem 0.75rem',
                background: 'var(--card)',
                border: '1px solid var(--primary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                gap: '0.25rem',
                color: 'var(--primary)',
              }}
            >
              <Download size={12} /> Sel. CSV
            </AnimBtn>
          </>
        )}
        <AnimBtn
          onClick={() => handleExport('json')}
          style={{
            padding: '0.5rem 0.75rem',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            fontSize: '0.75rem',
            fontWeight: 600,
            gap: '0.25rem',
          }}
        >
          <Download size={12} /> JSON
        </AnimBtn>
        <AnimBtn
          onClick={() => handleExport('csv')}
          style={{
            padding: '0.5rem 0.75rem',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            fontSize: '0.75rem',
            fontWeight: 600,
            gap: '0.25rem',
          }}
        >
          <Download size={12} /> CSV
        </AnimBtn>
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
        {(dateFrom || dateTo || tags) && (
          <AnimBtn
            onClick={() => {
              setDateFrom('')
              setDateTo('')
              setTags('')
            }}
            style={{
              padding: '0.4rem 0.75rem',
              background: 'var(--card)',
              border: '1px solid var(--border)',
              fontSize: '0.75rem',
              color: 'var(--danger)',
            }}
          >
            Clear
          </AnimBtn>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState message={`No ${type} found.`} icon={<FileText size={48} />} />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table style={{ minWidth: type === 'images' ? '600px' : '800px' }}>
              <thead>
                <tr>
                  {showManagement && (
                    <th style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="cursor-pointer"
                      />
                    </th>
                  )}
                  <th style={{ width: '50px' }}>
                    <button
                      onClick={() => handleSort('id')}
                      className="flex items-center gap-1 hover:underline"
                    >
                      ID {sort === 'id' && (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                    </button>
                  </th>
                  <th style={{ width: '80px' }}>Preview</th>
                  <th>Details</th>
                  <th style={{ width: '150px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(item => (
                  <tr
                    key={item.id}
                    className="stagger-item"
                    style={{
                      background: selected.has(item.id) ? 'rgba(var(--primary-rgb, 21,61,108), 0.08)' : undefined,
                    }}
                  >
                    {showManagement && (
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="font-semibold">{item.id}</td>
                    <td>
                      {type === 'images' && (
                        <div
                          onClick={() => openView(item)}
                          className="w-16 h-16 rounded-lg overflow-hidden cursor-pointer transition-transform hover:scale-105 hover:shadow-lg"
                          style={{ background: 'var(--muted)' }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getMediaUrl(item) || ''}
                            alt=""
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                            onError={e => {
                              ;(e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        </div>
                      )}
                      {type === 'videos' && (
                        <AnimBtn
                          onClick={() => openView(item)}
                          title="View video"
                          style={{ width: '64px', height: '48px', background: 'var(--muted)', padding: 0 }}
                        >
                          <Play size={20} />
                        </AnimBtn>
                      )}
                      {type === 'audio' && (
                        <AnimBtn
                          onClick={() => openView(item)}
                          title="View audio"
                          style={{ width: '64px', height: '48px', background: 'var(--muted)', padding: 0 }}
                        >
                          <Music size={20} />
                        </AnimBtn>
                      )}
                      {type === 'news' && (
                        <AnimBtn
                          onClick={() => openView(item)}
                          title="View article"
                          style={{ width: '64px', height: '48px', background: 'var(--muted)', padding: 0 }}
                        >
                          <FileText size={20} />
                        </AnimBtn>
                      )}
                    </td>
                    <td className="text-sm leading-relaxed">
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
                          <div
                            className="font-semibold cursor-pointer hover:underline"
                            onClick={() => openView(item)}
                          >
                            {item.title?.slice(0, 80) || 'Untitled'}
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
                          <div
                            className="font-semibold cursor-pointer hover:underline"
                            onClick={() => openView(item)}
                          >
                            {item.title?.slice(0, 80) || 'Untitled'}
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
                          <div
                            className="font-semibold cursor-pointer hover:underline"
                            onClick={() => openView(item)}
                          >
                            {item.title?.slice(0, 80) || 'Untitled'}
                          </div>
                          {item.artist && (
                            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                              Artist: {item.artist}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        <AnimBtn
                          onClick={() => openView(item)}
                          title="View"
                          style={{
                            padding: '0.375rem',
                            background: 'var(--card)',
                            border: '1px solid var(--border)',
                            color: 'var(--foreground)',
                          }}
                        >
                          <Eye size={14} />
                        </AnimBtn>
                        {showManagement && (
                          <>
                            <AnimBtn
                              onClick={() => {
                                setViewItem(item)
                                setViewMode('edit')
                              }}
                              title="Edit"
                              style={{
                                padding: '0.375rem',
                                background: 'var(--card)',
                                border: '1px solid var(--border)',
                                color: 'var(--primary)',
                              }}
                            >
                              <Pencil size={14} />
                            </AnimBtn>
                            <AnimBtn
                              onClick={() => {
                                setViewItem(item)
                                setViewMode('public')
                              }}
                              title="Public preview"
                              style={{
                                padding: '0.375rem',
                                background: 'var(--card)',
                                border: '1px solid var(--border)',
                                color: 'var(--success)',
                              }}
                            >
                              <Monitor size={14} />
                            </AnimBtn>
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
                          <AnimBtn
                            onClick={() => askDelete(item.id)}
                            title="Delete"
                            style={{ padding: '0.375rem', background: 'var(--danger)', color: 'white' }}
                          >
                            <Trash2 size={14} />
                          </AnimBtn>
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
              <AnimBtn
                onClick={() => setShowAdd(false)}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </AnimBtn>
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
              <AnimBtn
                onClick={() => setShowBulkImport(false)}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </AnimBtn>
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
              <AnimBtn
                onClick={() => setShowCsvImport(false)}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </AnimBtn>
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
                <AnimBtn
                  onClick={handleBulkTag}
                  disabled={bulkOperating || !bulkTagValue.trim()}
                  style={{
                    padding: '0.4rem 0.75rem',
                    background: 'var(--primary)',
                    color: 'var(--primary-fg)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  Apply Tags
                </AnimBtn>
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
                <AnimBtn
                  onClick={handleBulkReassign}
                  disabled={bulkOperating || !bulkReassignValue.trim()}
                  style={{
                    padding: '0.4rem 0.75rem',
                    background: 'var(--primary)',
                    color: 'var(--primary-fg)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  Reassign Source
                </AnimBtn>
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
              <EditForm type={type} item={viewItem} onSave={handleEdit} saving={editing} />
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
              <AnimBtn
                onClick={onEdit}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  color: 'var(--primary)',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  gap: '0.375rem',
                }}
              >
                <Pencil size={14} /> Edit
              </AnimBtn>
            )}
            {onDelete && (
              <AnimBtn
                onClick={onDelete}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--danger)',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  gap: '0.375rem',
                }}
              >
                <Trash2 size={14} /> Delete
              </AnimBtn>
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
        <AnimBtn
          onClick={onEdit}
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            color: 'var(--primary)',
            fontWeight: 600,
            fontSize: '0.875rem',
            gap: '0.375rem',
          }}
        >
          <Pencil size={14} /> Edit
        </AnimBtn>
      )}
      {onDelete && (
        <AnimBtn
          onClick={onDelete}
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--danger)',
            color: 'white',
            fontWeight: 600,
            fontSize: '0.875rem',
            gap: '0.375rem',
          }}
        >
          <Trash2 size={14} /> Delete
        </AnimBtn>
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

const EDITABLE_FIELDS: Record<MediaType, string[]> = {
  images: ['source', 'query', 'url', 'faceDetected', 'faceCount', 'faceMatch', 'faceMatchScore', 'faceMatchDistance'],
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