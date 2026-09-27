'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText, Save, Trash2, Plus, Pencil, Eye,
  Award, Milestone as MilestoneIcon, Upload, ListFilter,
} from 'lucide-react'
import { Modal, Skeleton, EmptyState, ConfirmDialog } from '@/components/ui'
import {
  Button, Field, Input, Textarea, Select, StatusBadge, PageHeader, Tabs, useToast,
} from '@/components/ui/kit'
import { jsonFetch } from '@/lib/jsonFetch'
import { KIND_CONFIG, DOCUMENT_KINDS, FACET_LABELS, type ArchiveKind } from '@/lib/library'

type Tab = 'archive' | 'milestones' | 'testimonials'

interface ArchiveRow { id: number; kind: string; title: string; slug: string; date: string | null; year: number | null; event: string | null; location: string | null; person: string | null; institution: string | null; parliament: string | null; theme: string | null; venue: string | null; occasion: string | null; excerpt: string | null; body: string | null; filePath: string | null; fileName: string | null; source: string | null; sourceUrl: string | null; videoUrl: string | null; audioUrl: string | null; photoUrl: string | null; featured: boolean; status: string; updatedAt: string }
interface MilestoneRow { id: number; year: string; period: string | null; title: string; description: string | null; category: string; order: number; status: string }
interface TestimonialRow { id: number; author: string; role: string | null; quote: string; source: string | null; year: number | null; photoUrl: string | null; sortOrder: number; status: string }

function PaginationBar({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-2 mt-4">
      <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(Math.max(1, page - 1))}>
        Prev
      </Button>
      <span className="text-xs" style={{ color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono), monospace' }}>
        Page {page} of {totalPages}
      </span>
      <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onChange(Math.min(totalPages, page + 1))}>
        Next
      </Button>
    </nav>
  )
}

export default function ArchiveAdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('archive')
  const [role, setRole] = useState('')
  const [loaded, setLoaded] = useState(false)

  const [archive, setArchive] = useState<ArchiveRow[]>([])
  const [milestones, setMilestones] = useState<MilestoneRow[]>([])
  const [testimonials, setTestimonialRows] = useState<TestimonialRow[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [kindFilter, setKindFilter] = useState('')

  const [docModal, setDocModal] = useState<{ mode: 'create' | 'edit'; row?: ArchiveRow } | null>(null)
  const [docForm, setDocForm] = useState<Record<string, string>>({})
  const [docFile, setDocFile] = useState<File | null>(null)

  const [mileModal, setMileModal] = useState<{ mode: 'create' | 'edit'; row?: MilestoneRow } | null>(null)
  const [mileForm, setMileForm] = useState<Record<string, string>>({})

  const [testiModal, setTestiModal] = useState<{ mode: 'create' | 'edit'; row?: TestimonialRow } | null>(null)
  const [testiForm, setTestiForm] = useState<Record<string, string>>({})

  const load = async (t: Tab) => {
    const params = new URLSearchParams({ type: t })
    if (search) params.set('q', search)
    if (t === 'archive' && kindFilter) params.set('kind', kindFilter)
    params.set('page', String(Math.max(1, page)))
    const d = await jsonFetch<{ items?: ArchiveRow[] | MilestoneRow[] | TestimonialRow[]; total?: number; perPage?: number }>(`/api/admin/library?${params.toString()}`)
    if (t === 'archive') setArchive((d?.items || []) as ArchiveRow[])
    else if (t === 'milestones') setMilestones((d?.items || []) as MilestoneRow[])
    else setTestimonialRows((d?.items || []) as TestimonialRow[])
    setTotalPages(Math.max(1, Math.ceil((d?.total || 0) / (d?.perPage || 20))))
    setLoaded(true)
  }

  useEffect(() => {
    jsonFetch<{ role?: string }>('/api/me').then(d => {
      if (d?.role !== 'admin' && d?.role !== 'editor') { router.push('/login'); return }
      setRole(d.role)
    })
  }, [router])

  useEffect(() => {
    if (!role) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, tab, search, page, kindFilter])

  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState<{ title: string; message: React.ReactNode; onConfirm: () => Promise<void> } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const switchTab = (t: Tab) => {
    setTab(t)
    setPage(1)
    setSearch('')
    setKindFilter('')
  }

  const { toast } = useToast()
  const notify = (message: string, type: 'success' | 'error' = 'success') => toast(message, { tone: type })

  /* ── Documents ── */
  const openDocModal = (mode: 'create' | 'edit', row?: ArchiveRow) => {
    setDocModal({ mode, row })
    setDocFile(null)
    setDocForm({
      kind: row?.kind || 'speech',
      title: row?.title || '',
      slug: row?.slug || '',
      date: row?.date || '',
      year: String(row?.year ?? ''),
      event: row?.event || '',
      location: row?.location || '',
      person: row?.person || '',
      institution: row?.institution || '',
      parliament: row?.parliament || '',
      theme: row?.theme || '',
      venue: row?.venue || '',
      occasion: row?.occasion || '',
      source: row?.source || '',
      sourceUrl: row?.sourceUrl || '',
      videoUrl: row?.videoUrl || '',
      audioUrl: row?.audioUrl || '',
      photoUrl: row?.photoUrl || '',
      excerpt: row?.excerpt || '',
      body: row?.body || '',
      status: row?.status || 'draft',
    })
  }
  const closeDocModal = () => { setDocModal(null) }

  const submitDoc = async (status?: string) => {
    if (!docModal || saving) return
    setSaving(true)
    const body = new FormData()
    body.set('action', docModal.mode === 'edit' ? 'update' : 'create')
    body.set('type', 'archive')
    if (docModal.mode === 'edit' && docModal.row) body.set('id', String(docModal.row.id))
    for (const [k, v] of Object.entries(docForm)) body.set(k, v)
    if (status) body.set('status', status)
    if (docFile) body.set('file', docFile)
    try {
      const res = await fetch('/api/admin/library', { method: 'POST', body })
      const d: { error?: string } = await res.json().catch(() => ({}))
      if (!res.ok) { notify(d.error || 'Failed to save', 'error'); return }
      notify(docModal.mode === 'edit' ? 'Document updated' : 'Document created')
      closeDocModal()
      load('archive')
    } finally {
      setSaving(false)
    }
  }

  const runDelete = async (fn: () => Promise<void>) => {
    setConfirmBusy(true)
    try {
      await fn()
    } finally {
      setConfirmBusy(false)
      setConfirm(null)
    }
  }

  const askDelete = (title: string, message: React.ReactNode, fn: () => Promise<void>) => {
    setConfirm({ title, message, onConfirm: () => runDelete(fn) })
  }

  const deleteDoc = async (row: ArchiveRow) => {
    const res = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', type: 'archive', id: row.id }) })
    if (res.ok) { load('archive'); notify('Deleted') } else notify('Failed to delete', 'error')
  }

  const toggleDocStatus = async (row: ArchiveRow) => {
    const status = row.status === 'published' ? 'draft' : 'published'
    const res = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_status', type: 'archive', id: row.id, status }) })
    if (res.ok) load('archive')
  }

  const publishDoc = async (row: ArchiveRow) => {
    const res = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_status', type: 'archive', id: row.id, status: 'published' }) })
    if (res.ok) { load('archive'); notify('Published') } else notify('Failed to publish', 'error')
  }

  const publishMile = async (row: MilestoneRow) => {
    const res = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_status', type: 'milestones', id: row.id, status: 'published' }) })
    if (res.ok) { load('milestones'); notify('Published') } else notify('Failed to publish', 'error')
  }

  const publishTesti = async (row: TestimonialRow) => {
    const res = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_status', type: 'testimonials', id: row.id, status: 'published' }) })
    if (res.ok) { load('testimonials'); notify('Published') } else notify('Failed to publish', 'error')
  }

  /* ── Milestones ── */
  const openMileModal = (mode: 'create' | 'edit', row?: MilestoneRow) => {
    setMileModal({ mode, row })
    setMileForm({ year: row?.year || '', period: row?.period || '', title: row?.title || '', description: row?.description || '', category: row?.category || 'career', order: String(row?.order ?? 0), status: row?.status || 'draft' })
  }
  const closeMileModal = () => { setMileModal(null) }

  const submitMile = async (status?: string) => {
    if (!mileModal || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: mileModal.mode === 'edit' ? 'update' : 'create', type: 'milestones', ...(mileModal.mode === 'edit' && mileModal.row ? { id: mileModal.row.id } : {}), ...mileForm, ...(status ? { status } : {}) }) })
      const d: { error?: string } = await res.json().catch(() => ({}))
      if (!res.ok) { notify(d.error || 'Failed', 'error'); return }
      notify(mileModal.mode === 'edit' ? 'Milestone updated' : 'Milestone created')
      closeMileModal(); load('milestones')
    } finally {
      setSaving(false)
    }
  }

  const deleteMile = async (row: MilestoneRow) => {
    const res = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', type: 'milestones', id: row.id }) })
    if (res.ok) { load('milestones'); notify('Deleted') } else notify('Failed to delete', 'error')
  }

  /* ── Testimonials ── */
  const openTestiModal = (mode: 'create' | 'edit', row?: TestimonialRow) => {
    setTestiModal({ mode, row })
    setTestiForm({ author: row?.author || '', role: row?.role || '', quote: row?.quote || '', source: row?.source || '', year: String(row?.year ?? ''), photoUrl: row?.photoUrl || '', sortOrder: String(row?.sortOrder ?? 0), status: row?.status || 'draft' })
  }
  const closeTestiModal = () => { setTestiModal(null) }

  const submitTesti = async (status?: string) => {
    if (!testiModal || saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: testiModal.mode === 'edit' ? 'update' : 'create', type: 'testimonials', ...(testiModal.mode === 'edit' && testiModal.row ? { id: testiModal.row.id } : {}), ...testiForm, ...(status ? { status } : {}) }) })
      const d: { error?: string } = await res.json().catch(() => ({}))
      if (!res.ok) { notify(d.error || 'Failed', 'error'); return }
      notify(testiModal.mode === 'edit' ? 'Testimonial updated' : 'Testimonial created')
      closeTestiModal(); load('testimonials')
    } finally {
      setSaving(false)
    }
  }

  const deleteTesti = async (row: TestimonialRow) => {
    const res = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', type: 'testimonials', id: row.id }) })
    if (res.ok) { load('testimonials'); notify('Deleted') } else notify('Failed to delete', 'error')
  }

  return (
    <div className="page-enter">
      <PageHeader
        title="Archive Manager"
        icon={<FileText size={20} />}
        description="Manage the Digital Library's documents (speeches, papers, interviews, notes), milestones and testimonials. Save as drafts and publish when ready."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Archive' }]}
      />

      <Tabs
        label="Archive views"
        value={tab}
        onChange={switchTab}
        className="mb-6"
        items={[
          { value: 'archive', label: 'Documents', icon: <FileText size={15} /> },
          { value: 'milestones', label: 'Milestones', icon: <MilestoneIcon size={15} /> },
          { value: 'testimonials', label: 'Testimonials', icon: <Award size={15} /> },
        ]}
      />

      {!loaded ? (
        <Skeleton style={{ height: 160, borderRadius: 12 }} />
      ) : tab === 'archive' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter documents by kind">
              <ListFilter size={14} aria-hidden style={{ color: 'var(--muted-foreground)' }} />
              <Button
                size="xs"
                variant={!kindFilter ? 'primary' : 'outline'}
                aria-pressed={!kindFilter}
                onClick={() => { setKindFilter(''); setPage(1) }}
              >
                all
              </Button>
              {DOCUMENT_KINDS.map(k => (
                <Button
                  key={k}
                  size="xs"
                  variant={kindFilter === k ? 'primary' : 'outline'}
                  aria-pressed={kindFilter === k}
                  onClick={() => { setKindFilter(kindFilter === k ? '' : k); setPage(1) }}
                >
                  {k}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Input
                type="search"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
                placeholder="Search documents…"
                aria-label="Search documents"
                style={{ maxWidth: 260 }}
              />
              <Button variant="primary" onClick={() => openDocModal('create')} iconLeft={<Plus size={14} />}>
                New Document
              </Button>
            </div>
          </div>

          {archive.length === 0 ? (
            <EmptyState
              icon={<FileText size={40} />}
              title="No documents yet"
              message="Create your first speech, paper, interview or note."
              action={
                <Button variant="primary" onClick={() => openDocModal('create')} iconLeft={<Plus size={14} />}>
                  New Document
                </Button>
              }
            />
          ) : (
            <div className="card overflow-hidden" style={{ border: '1px solid var(--border)', borderRadius: 12 }}>
              <div className="table-wrap table-cards">
                <table style={{ width: '100%', fontSize: '0.85rem' }}>
                  <caption className="sr-only">Archive documents</caption>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--muted-foreground)' }}>
                      <th scope="col" className="px-4 py-3 font-semibold text-xs uppercase">Kind</th>
                      <th scope="col" className="px-4 py-3 font-semibold text-xs uppercase">Title</th>
                      <th scope="col" className="px-4 py-3 font-semibold text-xs uppercase">Year / Date</th>
                      <th scope="col" className="px-4 py-3 font-semibold text-xs uppercase">File</th>
                      <th scope="col" className="px-4 py-3 font-semibold text-xs uppercase">Status</th>
                      <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {archive.map(a => (
                      <tr key={a.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td data-label="Kind" className="px-4 py-3">
                          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.72rem', color: 'var(--primary)' }}>{a.kind}</span>
                        </td>
                        <td data-label="Title" className="px-4 py-3">
                          <div className="font-semibold text-sm">{a.title}</div>
                          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            <code>/{a.slug}</code>
                          </div>
                        </td>
                        <td data-label="Year / Date" className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>{a.year || '—'} {a.date ? `· ${a.date}` : ''}</td>
                        <td data-label="File" className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {a.fileName ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Upload size={12} /> {a.fileName}</span> : '—'}
                        </td>
                        <td data-label="Status" className="px-4 py-3"><StatusBadge status={a.status} /></td>
                        <td data-label="Actions" data-wide className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {a.status === 'draft' ? (
                              <Button variant="primary" size="sm" iconLeft={<Eye size={12} />} onClick={() => publishDoc(a)}>
                                Publish
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" onClick={() => toggleDocStatus(a)}>
                                Unpublish
                              </Button>
                            )}
                            <Button variant="secondary" size="sm" iconOnly onClick={() => openDocModal('edit', a)} aria-label={`Edit ${a.title}`} title="Edit">
                              <Pencil size={14} />
                            </Button>
                            <Button variant="ghost" size="sm" iconOnly onClick={() => askDelete('Delete document?', <>This will permanently delete <strong>&ldquo;{a.title}&rdquo;</strong>. This cannot be undone.</>, () => deleteDoc(a))} aria-label={`Delete ${a.title}`} title="Delete">
                              <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <PaginationBar page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      ) : tab === 'milestones' ? (
        <div className="space-y-4">
          <div className="flex justify-between flex-wrap gap-3">
            <Input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search milestones…" aria-label="Search milestones" style={{ maxWidth: 280 }} />
            <Button variant="primary" onClick={() => openMileModal('create')} iconLeft={<Plus size={14} />}>
              New Milestone
            </Button>
          </div>
          {milestones.length === 0 ? (
            <EmptyState message="No milestones yet." />
          ) : (
            <div className="card overflow-hidden">
              <div className="table-wrap table-cards">
                <table style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--muted-foreground)' }}>
                      <th scope="col" className="px-4 py-3 font-semibold text-xs uppercase">Year</th>
                      <th scope="col" className="px-4 py-3 font-semibold text-xs uppercase">Title</th>
                      <th scope="col" className="px-4 py-3 font-semibold text-xs uppercase">Category</th>
                      <th scope="col" className="px-4 py-3 font-semibold text-xs uppercase">Status</th>
                      <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {milestones.map(m => (
                      <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td data-label="Year" className="px-4 py-3 font-mono text-sm" style={{ color: 'var(--primary)' }}>{m.year}</td>
                        <td data-label="Title" className="px-4 py-3">
                          <div className="font-semibold text-sm">{m.title}</div>
                          {m.description && <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{m.description.slice(0, 90)}…</div>}
                        </td>
                        <td data-label="Category" className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>{m.category}</td>
                        <td data-label="Status" className="px-4 py-3"><StatusBadge status={m.status} /></td>
                        <td data-label="Actions" data-wide className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {m.status === 'draft' && (
                              <button onClick={() => publishMile(m)} className="rounded-md px-2 py-1.5 text-xs font-semibold" style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', cursor: 'pointer' }}>Publish</button>
                            )}
                            <Button variant="secondary" size="sm" iconOnly onClick={() => openMileModal('edit', m)} aria-label={`Edit milestone ${m.title}`} title="Edit"><Pencil size={14} /></Button>
                            <Button variant="ghost" size="sm" iconOnly onClick={() => askDelete('Delete milestone?', <>This will permanently delete <strong>&ldquo;{m.title}&rdquo;</strong>.</>, () => deleteMile(m))} aria-label={`Delete milestone ${m.title}`} title="Delete"><Trash2 size={14} style={{ color: 'var(--danger)' }} /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <PaginationBar page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between flex-wrap gap-3">
            <Input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder="Search testimonials…" aria-label="Search testimonials" style={{ maxWidth: 280 }} />
            <Button variant="primary" onClick={() => openTestiModal('create')} iconLeft={<Plus size={14} />}>
              New Testimonial
            </Button>
          </div>
          {testimonials.length === 0 ? (
            <EmptyState message="No testimonials yet." />
          ) : (
            <div className="card overflow-hidden">
              <div className="table-wrap table-cards">
                <table style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--muted-foreground)' }}>
                      <th scope="col" className="px-4 py-3 font-semibold text-xs uppercase">Author</th>
                      <th scope="col" className="px-4 py-3 font-semibold text-xs uppercase">Quote</th>
                      <th scope="col" className="px-4 py-3 font-semibold text-xs uppercase">Year</th>
                      <th scope="col" className="px-4 py-3 font-semibold text-xs uppercase">Status</th>
                      <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {testimonials.map(t => (
                      <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td data-label="Author" className="px-4 py-3">
                          <div className="font-semibold text-sm">{t.author}</div>
                          {t.role && <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{t.role}</div>}
                        </td>
                        <td data-label="Quote" className="px-4 py-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>&ldquo;{t.quote.slice(0, 100)}…&rdquo;</td>
                        <td data-label="Year" className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>{t.year || '—'}</td>
                        <td data-label="Status" className="px-4 py-3"><StatusBadge status={t.status} /></td>
                        <td data-label="Actions" data-wide className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {t.status === 'draft' && (
                              <button onClick={() => publishTesti(t)} className="rounded-md px-2 py-1.5 text-xs font-semibold" style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', cursor: 'pointer' }}>Publish</button>
                            )}
                            <Button variant="secondary" size="sm" iconOnly onClick={() => openTestiModal('edit', t)} aria-label={`Edit testimonial from ${t.author}`} title="Edit"><Pencil size={14} /></Button>
                            <Button variant="ghost" size="sm" iconOnly onClick={() => askDelete('Delete testimonial?', <>This will permanently delete the testimonial from <strong>{t.author}</strong>.</>, () => deleteTesti(t))} aria-label={`Delete testimonial from ${t.author}`} title="Delete"><Trash2 size={14} style={{ color: 'var(--danger)' }} /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <PaginationBar page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}

      {/* ── Delete confirmation ── */}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title || 'Confirm delete'}
        message={confirm?.message}
        busy={confirmBusy}
        onConfirm={() => confirm?.onConfirm()}
        onClose={() => setConfirm(null)}
      />

      {/* ── Document modal ── */}
      <Modal open={docModal !== null} onClose={closeDocModal} maxWidth="760px">
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4">{docModal?.mode === 'create' ? 'New Document' : 'Edit Document'}</h2>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Kind">
                <Select value={docForm.kind} onChange={e => setDocForm(f => ({ ...f, kind: e.target.value }))}>
                  {DOCUMENT_KINDS.map(k => <option key={k} value={k}>{KIND_CONFIG[k as ArchiveKind].label}</option>)}
                </Select>
              </Field>
              <Field label="Title"><Input value={docForm.title} onChange={e => setDocForm(f => ({ ...f, title: e.target.value }))} /></Field>
              <Field label="Date (display)" hint="e.g. 7 January 2021"><Input value={docForm.date} onChange={e => setDocForm(f => ({ ...f, date: e.target.value }))} /></Field>
              <Field label="Year" hint="Used for sorting and filters."><Input value={docForm.year} onChange={e => setDocForm(f => ({ ...f, year: e.target.value }))} placeholder="2021" /></Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['event', 'location'] as const).map(k => (
                <Field key={k} label={FACET_LABELS[k]}>
                  <Input value={docForm[k]} onChange={e => setDocForm(f => ({ ...f, [k]: e.target.value }))} />
                </Field>
              ))}
              {(['person', 'institution'] as const).map(k => (
                <Field key={k} label={FACET_LABELS[k]}>
                  <Input value={docForm[k]} onChange={e => setDocForm(f => ({ ...f, [k]: e.target.value }))} />
                </Field>
              ))}
              {(['parliament', 'theme'] as const).map(k => (
                <Field key={k} label={FACET_LABELS[k]}>
                  <Input value={docForm[k]} onChange={e => setDocForm(f => ({ ...f, [k]: e.target.value }))} />
                </Field>
              ))}
              <Field label="Venue"><Input value={docForm.venue} onChange={e => setDocForm(f => ({ ...f, venue: e.target.value }))} placeholder="Parliament House, Accra" /></Field>
              <Field label="Occasion" hint="e.g. State of the Nation debate, Commissioning ceremony, Budget reading"><Input value={docForm.occasion} onChange={e => setDocForm(f => ({ ...f, occasion: e.target.value }))} /></Field>
              <Field label="Source name"><Input value={docForm.source} onChange={e => setDocForm(f => ({ ...f, source: e.target.value }))} /></Field>
              <Field label="Source URL"><Input value={docForm.sourceUrl} onChange={e => setDocForm(f => ({ ...f, sourceUrl: e.target.value }))} /></Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Video URL" hint="YouTube link or media URL for this speech."><Input value={docForm.videoUrl} onChange={e => setDocForm(f => ({ ...f, videoUrl: e.target.value }))} placeholder="https://youtube.com/watch?v=…" /></Field>
              <Field label="Audio URL" hint="Recording of the address."><Input value={docForm.audioUrl} onChange={e => setDocForm(f => ({ ...f, audioUrl: e.target.value }))} placeholder="https://… or /api/media/…" /></Field>
              <Field label="Photograph URL" hint="Photo of the occasion."><Input value={docForm.photoUrl} onChange={e => setDocForm(f => ({ ...f, photoUrl: e.target.value }))} placeholder="https://… or /api/media/…" /></Field>
            </div>
            <Field label="Excerpt / short description"><Textarea value={docForm.excerpt} onChange={e => setDocForm(f => ({ ...f, excerpt: e.target.value }))} /></Field>
            <Field label="Body / transcript (markdown)" hint="Optional. Rendered on the public detail page.">
              <Textarea value={docForm.body} onChange={e => setDocForm(f => ({ ...f, body: e.target.value }))} style={{ minHeight: 180, fontFamily: 'var(--font-mono), monospace', fontSize: '0.85rem' }} />
            </Field>
            <Field label="Downloadable file (PDF, DOC, TXT, MD…)" hint={docModal?.row?.fileName ? `Current: ${docModal.row.fileName}` : 'Optional — upload the document for public download.'}>
              <input type="file" onChange={e => setDocFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm" style={{ color: 'var(--foreground)' }} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={closeDocModal} disabled={saving}>Cancel</Button>
            {docModal?.mode === 'create' && (
              <Button variant="secondary" loading={saving} onClick={() => submitDoc('draft')} iconLeft={<Save size={14} />}>
                Save draft
              </Button>
            )}
            <Button variant="primary" loading={saving} onClick={() => submitDoc('published')} iconLeft={<Eye size={14} />}>
              {docModal?.mode === 'create' ? 'Create & publish' : 'Publish changes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Milestone modal ── */}
      <Modal open={mileModal !== null} onClose={closeMileModal} maxWidth="640px">
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4">{mileModal?.mode === 'create' ? 'New Milestone' : 'Edit Milestone'}</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Year"><Input value={mileForm.year} onChange={e => setMileForm(f => ({ ...f, year: e.target.value }))} placeholder="2021" /></Field>
              <Field label="Period (optional)" hint="e.g. 2001–2009"><Input value={mileForm.period} onChange={e => setMileForm(f => ({ ...f, period: e.target.value }))} /></Field>
            </div>
            <Field label="Title"><Input value={mileForm.title} onChange={e => setMileForm(f => ({ ...f, title: e.target.value }))} /></Field>
            <Field label="Description"><Textarea value={mileForm.description} onChange={e => setMileForm(f => ({ ...f, description: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">
                <Select value={mileForm.category} onChange={e => setMileForm(f => ({ ...f, category: e.target.value }))}>
                  {['early-life', 'education', 'career', 'parliament', 'national'].map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Order"><Input value={mileForm.order} onChange={e => setMileForm(f => ({ ...f, order: e.target.value }))} /></Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={closeMileModal} disabled={saving}>Cancel</Button>
            {mileModal?.mode === 'create' && (
              <Button variant="secondary" loading={saving} onClick={() => submitMile('draft')} iconLeft={<Save size={14} />}>
                Save draft
              </Button>
            )}
            <Button variant="primary" loading={saving} onClick={() => submitMile('published')} iconLeft={<Eye size={14} />}>
              {mileModal?.mode === 'create' ? 'Create & publish' : 'Publish changes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Testimonial modal ── */}
      <Modal open={testiModal !== null} onClose={closeTestiModal} maxWidth="640px">
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4">{testiModal?.mode === 'create' ? 'New Testimonial' : 'Edit Testimonial'}</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Author"><Input value={testiForm.author} onChange={e => setTestiForm(f => ({ ...f, author: e.target.value }))} /></Field>
              <Field label="Role / title"><Input value={testiForm.role} onChange={e => setTestiForm(f => ({ ...f, role: e.target.value }))} /></Field>
            </div>
            <Field label="Quote"><Textarea value={testiForm.quote} onChange={e => setTestiForm(f => ({ ...f, quote: e.target.value }))} style={{ minHeight: 120 }} /></Field>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Year"><Input value={testiForm.year} onChange={e => setTestiForm(f => ({ ...f, year: e.target.value }))} placeholder="2024" /></Field>
              <Field label="Source"><Input value={testiForm.source} onChange={e => setTestiForm(f => ({ ...f, source: e.target.value }))} /></Field>
              <Field label="Sort order"><Input value={testiForm.sortOrder} onChange={e => setTestiForm(f => ({ ...f, sortOrder: e.target.value }))} /></Field>
            </div>
            <Field label="Photo URL (optional)"><Input value={testiForm.photoUrl} onChange={e => setTestiForm(f => ({ ...f, photoUrl: e.target.value }))} /></Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={closeTestiModal} disabled={saving}>Cancel</Button>
            {testiModal?.mode === 'create' && (
              <Button variant="secondary" loading={saving} onClick={() => submitTesti('draft')} iconLeft={<Save size={14} />}>
                Save draft
              </Button>
            )}
            <Button variant="primary" loading={saving} onClick={() => submitTesti('published')} iconLeft={<Eye size={14} />}>
              {testiModal?.mode === 'create' ? 'Create & publish' : 'Publish changes'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}