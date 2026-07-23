'use client'

import { useEffect, useState, useCallback, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Trash2, ExternalLink, Plus, Download, Music, Play, FileText, Search, Filter, ChevronDown } from 'lucide-react'
import { Modal, AnimBtn, AnimLink, Toast, SkeletonTable, EmptyState } from '@/components/ui'
import { Pagination } from '@/components/ui/Pagination'

interface AdminData {
  items: any[]
  total: number
  page: number
  perPage: number
  sources: string[]
}

function getMediaUrl(item: { localPath?: string | null; url?: string | null }): string | null {
  if (item.localPath) {
    const rel = item.localPath.replace('/home/hollali/Projects/portal/public', '')
    return rel
  }
  return item.url || null
}

function isYouTubeUrl(url: string): boolean {
  return /(youtube\.com|youtu\.be)/i.test(url)
}

function getYouTubeEmbedUrl(url: string): string {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : url
}

export default function AdminPage() {
  const router = useRouter()
  const [data, setData] = useState<AdminData | null>(null)
  const [tab, setTab] = useState<'images' | 'videos' | 'news' | 'audio'>('images')
  const [page, setPage] = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [viewItem, setViewItem] = useState<any | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [search, setSearch] = useState('')
  const [source, setSource] = useState('')
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState('id')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const fetchData = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      type: tab, page: String(page), perPage: '20',
      search, source, sort, dir: sortDir,
    })
    const res = await fetch(`/api/admin/${tab}?${params}`)
    const d = await res.json()
    setData(d)
    setLoading(false)
  }, [tab, page, search, source, sort, sortDir])

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (!d.isAdmin) { router.push('/login'); return }
      setIsAdmin(true)
    })
  }, [router])

  useEffect(() => {
    if (isAdmin) fetchData()
  }, [isAdmin, fetchData])

  useEffect(() => {
    setPage(1)
    setSelected(new Set())
  }, [tab, search, source])

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
    const currentIds = data.items.map((i: any) => i.id)
    const allSelected = currentIds.every((id: number) => selected.has(id))
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        currentIds.forEach((id: number) => next.delete(id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        currentIds.forEach((id: number) => next.add(id))
        return next
      })
    }
  }

  const handleDeleteSelected = async () => {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} selected item(s)?`)) return
    setDeleting(true)
    const formData = new FormData()
    formData.set('action', 'delete_image')
    formData.set('pks', Array.from(selected).join(','))
    formData.set('type', tab)
    const res = await fetch(`/api/admin/${tab}`, { method: 'POST', body: formData })
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
    if (!confirm('Delete this item?')) return
    const formData = new FormData()
    formData.set('action', 'delete_image')
    formData.set('pks', String(id))
    formData.set('type', tab)
    const res = await fetch(`/api/admin/${tab}`, { method: 'POST', body: formData })
    if (res.ok) {
      setToast({ message: 'Item deleted' })
      fetchData()
    } else {
      setToast({ message: 'Failed to delete', type: 'error' })
    }
  }

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('action', 'add')
    formData.set('type', tab)
    const res = await fetch(`/api/admin/${tab}`, { method: 'POST', body: formData })
    if (res.ok) {
      setToast({ message: 'Item added' })
      setShowAdd(false)
      fetchData()
    } else {
      setToast({ message: 'Failed to add', type: 'error' })
    }
  }

  const handleExport = (format: 'json' | 'csv') => {
    const params = new URLSearchParams({ type: tab, export: format, search, source })
    window.open(`/api/admin/${tab}?${params}`, '_blank')
  }

  const handleSort = (field: string) => {
    if (sort === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSort(field)
      setSortDir('desc')
    }
  }

  const allIds = data?.items.map((i: any) => i.id) || []
  const allSelected = allIds.length > 0 && allIds.every((id: number) => selected.has(id))
  const totalPages = data ? Math.ceil(data.total / 20) : 1

  if (!isAdmin) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <SkeletonTable rows={5} cols={5} />
    </div>
  )

  return (
    <div className="page-enter">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold mb-1">Admin Panel</h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Manage all collected media — view, preview, add, and delete records.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AnimBtn onClick={() => handleExport('json')} style={{ padding: '0.5rem 0.75rem', background: 'var(--card)', border: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: 600, gap: '0.25rem' }}>
            <Download size={12} /> JSON
          </AnimBtn>
          <AnimBtn onClick={() => handleExport('csv')} style={{ padding: '0.5rem 0.75rem', background: 'var(--card)', border: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: 600, gap: '0.25rem' }}>
            <Download size={12} /> CSV
          </AnimBtn>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['images', 'videos', 'news', 'audio'] as const).map(t => (
          <AnimBtn key={t} onClick={() => setTab(t)} style={{
            padding: '0.5rem 1rem',
            background: tab === t ? 'var(--primary)' : 'var(--card)',
            color: tab === t ? 'white' : 'var(--foreground)',
            fontWeight: 600, fontSize: '0.875rem',
            border: tab === t ? 'none' : '1px solid var(--border)',
          }}>
            {t.charAt(0).toUpperCase() + t.slice(1)} ({data?.total || 0})
          </AnimBtn>
        ))}
        <AnimBtn onClick={() => setShowAdd(true)} style={{ padding: '0.5rem 1rem', background: 'var(--primary)', color: 'white', fontWeight: 600, fontSize: '0.875rem', gap: '0.375rem' }}>
          <Plus size={14} /> Add New
        </AnimBtn>
        {selected.size > 0 && (
          <AnimBtn onClick={handleDeleteSelected} disabled={deleting} style={{
            padding: '0.5rem 1rem', background: 'var(--danger)', color: 'white',
            fontWeight: 600, fontSize: '0.875rem', gap: '0.375rem',
          }}>
            <Trash2 size={14} /> Delete ({selected.size})
          </AnimBtn>
        )}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm transition-colors focus:ring-2 focus:ring-[var(--primary)]"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
        </div>
        {data?.sources && data.sources.length > 0 && (
          <div className="relative">
            <select
              value={source}
              onChange={e => setSource(e.target.value)}
              className="appearance-none rounded-lg border py-2 pl-3 pr-8 text-sm cursor-pointer"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            >
              <option value="">All Sources</option>
              {data.sources.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState message={`No ${tab} found.`} icon={<FileText size={48} />} />
      ) : (
        <>
          <div className="card overflow-x-auto">
            <table style={{ minWidth: tab === 'images' ? '600px' : '800px' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="cursor-pointer" />
                  </th>
                  <th style={{ width: '50px' }}>
                    <button onClick={() => handleSort('id')} className="flex items-center gap-1 hover:underline">
                      ID {sort === 'id' && (sortDir === 'asc' ? '↑' : '↓')}
                    </button>
                  </th>
                  <th style={{ width: '80px' }}>Preview</th>
                  <th>Details</th>
                  <th style={{ width: '80px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item: any) => (
                  <tr key={item.id} className="stagger-item" style={{
                    background: selected.has(item.id) ? 'rgba(var(--primary-rgb, 21,61,108), 0.08)' : undefined,
                  }}>
                    <td>
                      <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} className="cursor-pointer" />
                    </td>
                    <td className="font-semibold">{item.id}</td>
                    <td>
                      {tab === 'images' && (
                        <div onClick={() => setViewItem(item)} className="w-16 h-16 rounded-lg overflow-hidden cursor-pointer transition-transform hover:scale-105 hover:shadow-lg" style={{ background: 'var(--muted)' }}>
                          <img src={getMediaUrl(item) || ''} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        </div>
                      )}
                      {tab === 'videos' && (
                        <AnimBtn onClick={() => setViewItem(item)} title="View video" style={{ width: '64px', height: '48px', background: 'var(--muted)', padding: 0 }}>
                          <Play size={20} />
                        </AnimBtn>
                      )}
                      {tab === 'audio' && (
                        <AnimBtn onClick={() => setViewItem(item)} title="View audio" style={{ width: '64px', height: '48px', background: 'var(--muted)', padding: 0 }}>
                          <Music size={20} />
                        </AnimBtn>
                      )}
                      {tab === 'news' && (
                        <AnimBtn onClick={() => setViewItem(item)} title="View article" style={{ width: '64px', height: '48px', background: 'var(--muted)', padding: 0 }}>
                          <FileText size={20} />
                        </AnimBtn>
                      )}
                    </td>
                    <td className="text-sm leading-relaxed">
                      {tab === 'images' && (
                        <div>
                          <div className="font-semibold">Source: {item.source || '-'}</div>
                          <div className="text-xs truncate max-w-[250px]" style={{ color: 'var(--muted-foreground)' }}>
                            {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] no-underline">{item.url.slice(0, 60)}...</a> : '-'}
                          </div>
                          {item.query && <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Query: {item.query}</div>}
                        </div>
                      )}
                      {tab === 'videos' && (
                        <div>
                          <div className="font-semibold cursor-pointer hover:underline" onClick={() => setViewItem(item)}>{item.title?.slice(0, 80) || 'Untitled'}</div>
                          <div style={{ color: 'var(--muted-foreground)' }}>
                            {item.channel && <span>Channel: {item.channel}</span>}
                            {item.views != null && <span> · {item.views.toLocaleString()} views</span>}
                            {item.duration ? <span> · {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, '0')}</span> : ''}
                          </div>
                        </div>
                      )}
                      {tab === 'news' && (
                        <div>
                          <div className="font-semibold cursor-pointer hover:underline" onClick={() => setViewItem(item)}>{item.title?.slice(0, 80) || 'Untitled'}</div>
                          {item.sourceName && <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{item.sourceName}</div>}
                          {item.snippet && <div className="text-xs truncate max-w-[250px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>{item.snippet.replace(/<[^>]*>/g, '').slice(0, 100)}...</div>}
                        </div>
                      )}
                      {tab === 'audio' && (
                        <div>
                          <div className="font-semibold cursor-pointer hover:underline" onClick={() => setViewItem(item)}>{item.title?.slice(0, 80) || 'Untitled'}</div>
                          {item.artist && <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Artist: {item.artist}</div>}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        <AnimBtn onClick={() => setViewItem(item)} title="View" style={{ padding: '0.375rem', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                          <Eye size={14} />
                        </AnimBtn>
                        {item.url && (
                          <AnimLink href={item.url} target="_blank" rel="noopener noreferrer" title="Source" style={{ padding: '0.375rem', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--primary)' }}>
                            <ExternalLink size={14} />
                          </AnimLink>
                        )}
                        <AnimBtn onClick={() => handleDelete(item.id)} title="Delete" style={{ padding: '0.375rem', background: 'var(--danger)', color: 'white' }}>
                          <Trash2 size={14} />
                        </AnimBtn>
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
          <h2 className="text-lg font-bold mb-4">Add New {tab.slice(0, -1)}</h2>
          <form onSubmit={handleAdd}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {['source', 'query', 'url', ...(tab === 'videos' ? ['platform', 'title', 'channel', 'duration', 'views'] : []),
                ...(tab === 'news' ? ['title', 'sourceName', 'date', 'snippet'] : []),
                ...(tab === 'audio' ? ['title', 'artist', 'duration'] : []),
                ...(tab === 'images' ? [] : []),
              ].filter((v, i, a) => a.indexOf(v) === i).map(f => (
                <div key={f}>
                  <label className="block text-xs font-semibold mb-1">{f.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</label>
                  <input name={f} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <AnimBtn onClick={() => setShowAdd(false)} style={{ padding: '0.5rem 1rem', background: 'var(--card)', border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.875rem' }}>
                Cancel
              </AnimBtn>
              <button type="submit" className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: 'var(--primary)', cursor: 'pointer', border: 'none' }}>
                <Plus size={14} /> Add Item
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal open={!!viewItem} onClose={() => setViewItem(null)} maxWidth="900px">
        {viewItem && (
          <div>
            {tab === 'images' && (
              <div>
                <div className="flex items-center justify-center min-h-[300px]" style={{ background: 'var(--muted)' }}>
                  <img src={getMediaUrl(viewItem) || ''} alt="" className="w-full max-h-[60vh] object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                </div>
                <div className="p-6">
                  <h2 className="text-lg font-bold mb-3">Image Details</h2>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><strong>ID:</strong> {viewItem.id}</div>
                    <div><strong>Source:</strong> {viewItem.source || '-'}</div>
                    <div className="col-span-2"><strong>URL:</strong> {viewItem.url ? <a href={viewItem.url} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)]">{viewItem.url.slice(0, 80)}...</a> : '-'}</div>
                    {viewItem.query && <div className="col-span-2"><strong>Query:</strong> {viewItem.query}</div>}
                    {viewItem.collectedAt && <div className="col-span-2"><strong>Collected:</strong> {viewItem.collectedAt}</div>}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <a href={getMediaUrl(viewItem) || '#'} download className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-white no-underline" style={{ background: 'var(--primary)' }}>
                      <Download size={14} /> Download
                    </a>
                    <AnimBtn onClick={() => handleDelete(viewItem.id)} style={{ padding: '0.5rem 1rem', background: 'var(--danger)', color: 'white', fontWeight: 600, fontSize: '0.875rem', gap: '0.375rem' }}>
                      <Trash2 size={14} /> Delete
                    </AnimBtn>
                  </div>
                </div>
              </div>
            )}

            {tab === 'videos' && (
              <div>
                <div className="w-full aspect-video bg-black flex items-center justify-center">
                  {getMediaUrl(viewItem) && isYouTubeUrl(getMediaUrl(viewItem) || '') ? (
                    <iframe src={getYouTubeEmbedUrl(getMediaUrl(viewItem) || '')} className="w-full h-full border-none" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  ) : getMediaUrl(viewItem) ? (
                    <video src={getMediaUrl(viewItem) || ''} controls autoPlay className="w-full h-full" />
                  ) : (
                    <div className="text-white p-8">No video source available</div>
                  )}
                </div>
                <div className="p-6">
                  <h2 className="text-lg font-bold mb-2">{viewItem.title || 'Untitled'}</h2>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><strong>ID:</strong> {viewItem.id}</div>
                    <div><strong>Platform:</strong> {viewItem.platform || '-'}</div>
                    <div><strong>Channel:</strong> {viewItem.channel || '-'}</div>
                    <div><strong>Views:</strong> {viewItem.views?.toLocaleString() || '-'}</div>
                  </div>
                  <div className="mt-4">
                    <AnimBtn onClick={() => handleDelete(viewItem.id)} style={{ padding: '0.5rem 1rem', background: 'var(--danger)', color: 'white', fontWeight: 600, fontSize: '0.875rem', gap: '0.375rem' }}>
                      <Trash2 size={14} /> Delete
                    </AnimBtn>
                  </div>
                </div>
              </div>
            )}

            {tab === 'news' && (
              <div className="p-6">
                <h2 className="text-lg font-bold mb-1">{viewItem.title || 'Untitled'}</h2>
                <div className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>{viewItem.sourceName} · {viewItem.date}</div>
                {viewItem.snippet && (
                  <div className="p-4 rounded-lg text-sm leading-relaxed mb-4" style={{ background: 'var(--muted)' }} dangerouslySetInnerHTML={{ __html: viewItem.snippet }} />
                )}
                <div className="flex gap-2">
                  {viewItem.url && (
                    <a href={viewItem.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-white no-underline" style={{ background: 'var(--primary)' }}>
                      <ExternalLink size={14} /> Open Article
                    </a>
                  )}
                  <AnimBtn onClick={() => handleDelete(viewItem.id)} style={{ padding: '0.5rem 1rem', background: 'var(--danger)', color: 'white', fontWeight: 600, fontSize: '0.875rem', gap: '0.375rem' }}>
                    <Trash2 size={14} /> Delete
                  </AnimBtn>
                </div>
              </div>
            )}

            {tab === 'audio' && (
              <div>
                <div className="flex flex-col items-center justify-center py-12 px-8" style={{ background: 'var(--muted)' }}>
                  <Music size={48} className="mb-4 opacity-50" />
                  {getMediaUrl(viewItem) ? (
                    <audio src={getMediaUrl(viewItem) || ''} controls autoPlay className="w-full max-w-md" />
                  ) : (
                    <div style={{ color: 'var(--muted-foreground)' }}>No audio source</div>
                  )}
                </div>
                <div className="p-6">
                  <h2 className="text-lg font-bold mb-2">{viewItem.title || 'Untitled'}</h2>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><strong>ID:</strong> {viewItem.id}</div>
                    <div><strong>Artist:</strong> {viewItem.artist || '-'}</div>
                    <div><strong>Source:</strong> {viewItem.source || '-'}</div>
                    {viewItem.duration && <div><strong>Duration:</strong> {viewItem.duration}s</div>}
                  </div>
                  <div className="flex gap-2 mt-4">
                    {getMediaUrl(viewItem) && (
                      <a href={getMediaUrl(viewItem) || '#'} download className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-white no-underline" style={{ background: 'var(--primary)' }}>
                        <Download size={14} /> Download
                      </a>
                    )}
                    <AnimBtn onClick={() => handleDelete(viewItem.id)} style={{ padding: '0.5rem 1rem', background: 'var(--danger)', color: 'white', fontWeight: 600, fontSize: '0.875rem', gap: '0.375rem' }}>
                      <Trash2 size={14} /> Delete
                    </AnimBtn>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
