'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText, Save, Trash2, Plus, Pencil, Eye,
  Award, Milestone as MilestoneIcon, Upload, ListFilter,
} from 'lucide-react'
import { Modal, AnimBtn, Toast, Skeleton, EmptyState } from '@/components/ui'
import { KIND_CONFIG, DOCUMENT_KINDS, FACET_LABELS, type ArchiveKind } from '@/lib/library'

type Tab = 'archive' | 'milestones' | 'testimonials'

interface ArchiveRow { id: number; kind: string; title: string; slug: string; date: string | null; year: number | null; event: string | null; location: string | null; person: string | null; institution: string | null; parliament: string | null; theme: string | null; excerpt: string | null; body: string | null; filePath: string | null; fileName: string | null; source: string | null; sourceUrl: string | null; venue: string | null; featured: boolean; status: string; updatedAt: string }
interface MilestoneRow { id: number; year: string; period: string | null; title: string; description: string | null; category: string; order: number; status: string }
interface TestimonialRow { id: number; author: string; role: string | null; quote: string; source: string | null; year: number | null; photoUrl: string | null; sortOrder: number; status: string }

const inputStyle: React.CSSProperties = { background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }
const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm'
const labelCls = 'block text-xs font-semibold mb-1'

function StatusBadge({ status }: { status: string }) {
  const published = status === 'published'
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: published ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)', color: published ? '#16a34a' : '#b45309' }}>
      {published ? 'Published' : 'Draft'}
    </span>
  )
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{hint}</p>}
    </div>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} style={{ ...inputStyle, ...(props.style || {}) }} />
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={inputCls + ' min-h-[90px]'} style={{ ...inputStyle, ...(props.style || {}) }} />
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={inputCls} style={{ ...inputStyle, paddingRight: '2rem' }}>{children}</select>
}

export default function ArchiveAdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('archive')
  const [role, setRole] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null)

  const [archive, setArchive] = useState<ArchiveRow[]>([])
  const [milestones, setMilestones] = useState<MilestoneRow[]>([])
  const [testimonials, setTestimonials] = useState<TestimonialRow[]>([])
  const [search, setSearch] = useState('')

  const [docModal, setDocModal] = useState<{ mode: 'create' | 'edit'; row?: ArchiveRow } | null>(null)
  const [docForm, setDocForm] = useState<Record<string, string>>({})
  const [docFile, setDocFile] = useState<File | null>(null)

  const [mileModal, setMileModal] = useState<{ mode: 'create' | 'edit'; row?: MilestoneRow } | null>(null)
  const [mileForm, setMileForm] = useState<Record<string, string>>({})

  const [testiModal, setTestiModal] = useState<{ mode: 'create' | 'edit'; row?: TestimonialRow } | null>(null)
  const [testiForm, setTestiForm] = useState<Record<string, string>>({})

  const load = async (t: Tab) => {
    const res = await fetch(`/api/admin/library?type=${t}&q=${encodeURIComponent(search)}`)
    const d = await res.json()
    if (t === 'archive') setArchive(d.items || [])
    else if (t === 'milestones') setMilestones(d.items || [])
    else setTestimonials(d.items || [])
    setLoaded(true)
  }

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (d.role !== 'admin' && d.role !== 'editor') { router.push('/login'); return }
      setRole(d.role)
    })
  }, [router])

  useEffect(() => {
    if (!role) return
    load(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, tab, search])

  const notify = (message: string, type?: 'success' | 'error') => setToast({ message, type })

  const block = (s: string) => document.body.style.overflow = s

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
      source: row?.source || '',
      sourceUrl: row?.sourceUrl || '',
      excerpt: row?.excerpt || '',
      body: row?.body || '',
      status: row?.status || 'draft',
    })
    block('hidden')
  }
  const closeDocModal = () => { setDocModal(null); block('') }

  const submitDoc = async (status?: string) => {
    if (!docModal) return
    const body = new FormData()
    body.set('action', docModal.mode === 'edit' ? 'update' : 'create')
    body.set('type', 'archive')
    if (docModal.mode === 'edit' && docModal.row) body.set('id', String(docModal.row.id))
    for (const [k, v] of Object.entries(docForm)) body.set(k, v)
    if (status) body.set('status', status)
    if (docFile) body.set('file', docFile)
    const res = await fetch('/api/admin/library', { method: 'POST', body })
    const d = await res.json()
    if (!res.ok) { notify(d.error || 'Failed to save', 'error'); return }
    notify(docModal.mode === 'edit' ? 'Document updated' : 'Document created')
    closeDocModal()
    load('archive')
  }

  const deleteDoc = async (row: ArchiveRow) => {
    if (!confirm(`Delete "${row.title}"? This cannot be undone.`)) return
    const res = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', type: 'archive', id: row.id }) })
    if (res.ok) { load('archive'); notify('Deleted') } else notify('Failed to delete', 'error')
  }

  const toggleDocStatus = async (row: ArchiveRow) => {
    const status = row.status === 'published' ? 'draft' : 'published'
    const res = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_status', type: 'archive', id: row.id, status }) })
    if (res.ok) load('archive')
  }

  /* ── Milestones ── */
  const openMileModal = (mode: 'create' | 'edit', row?: MilestoneRow) => {
    setMileModal({ mode, row })
    setMileForm({ year: row?.year || '', period: row?.period || '', title: row?.title || '', description: row?.description || '', category: row?.category || 'career', order: String(row?.order ?? 0), status: row?.status || 'draft' })
    block('hidden')
  }
  const closeMileModal = () => { setMileModal(null); block('') }

  const submitMile = async (status?: string) => {
    if (!mileModal) return
    const res = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: mileModal.mode === 'edit' ? 'update' : 'create', type: 'milestones', ...(mileModal.mode === 'edit' && mileModal.row ? { id: mileModal.row.id } : {}), ...mileForm, ...(status ? { status } : {}) }) })
    const d = await res.json()
    if (!res.ok) { notify(d.error || 'Failed', 'error'); return }
    notify(mileModal.mode === 'edit' ? 'Milestone updated' : 'Milestone created')
    closeMileModal(); load('milestones')
  }

  const deleteMile = async (row: MilestoneRow) => {
    if (!confirm(`Delete "${row.title}"?`)) return
    await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', type: 'milestones', id: row.id }) })
    load('milestones'); notify('Deleted')
  }

  /* ── Testimonials ── */
  const openTestiModal = (mode: 'create' | 'edit', row?: TestimonialRow) => {
    setTestiModal({ mode, row })
    setTestiForm({ author: row?.author || '', role: row?.role || '', quote: row?.quote || '', source: row?.source || '', year: String(row?.year ?? ''), photoUrl: row?.photoUrl || '', sortOrder: String(row?.sortOrder ?? 0), status: row?.status || 'draft' })
    block('hidden')
  }
  const closeTestiModal = () => { setTestiModal(null); block('') }

  const submitTesti = async (status?: string) => {
    if (!testiModal) return
    const res = await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: testiModal.mode === 'edit' ? 'update' : 'create', type: 'testimonials', ...(testiModal.mode === 'edit' && testiModal.row ? { id: testiModal.row.id } : {}), ...testiForm, ...(status ? { status } : {}) }) })
    const d = await res.json()
    if (!res.ok) { notify(d.error || 'Failed', 'error'); return }
    notify(testiModal.mode === 'edit' ? 'Testimonial updated' : 'Testimonial created')
    closeTestiModal(); load('testimonials')
  }

  const deleteTesti = async (row: TestimonialRow) => {
    if (!confirm(`Delete testimonial from ${row.author}?`)) return
    await fetch('/api/admin/library', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', type: 'testimonials', id: row.id }) })
    load('testimonials'); notify('Deleted')
  }

  const kindsByTab: Record<string, boolean> = {}
  const visibleArchive = archive.filter(a => kindsByTab[a.kind] !== false)

  return (
    <div className="page-enter">
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-bold flex items-center gap-2"><FileText size={20} style={{ color: 'var(--primary)' }} /> Archive Manager</h1>
      </div>
      <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
        Manage the Digital Library&apos;s documents (speeches, papers, interviews, notes), milestones and testimonials. Save as drafts and publish when ready.
      </p>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex flex-wrap gap-1 mb-6 rounded-lg p-1 w-fit" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {([['archive', 'Documents', FileText], ['milestones', 'Milestones', MilestoneIcon], ['testimonials', 'Testimonials', Award]] as [Tab, string, React.ElementType][]).map(([t, label, Icon]) => (
          <button key={t} onClick={() => setTab(t)}
            className="inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-semibold transition-colors"
            style={{ background: tab === t ? 'var(--primary)' : 'transparent', color: tab === t ? 'var(--primary-fg)' : 'var(--muted-foreground)', border: 'none', cursor: 'pointer' }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {!loaded ? (
        <Skeleton style={{ height: 160, borderRadius: 12 }} />
      ) : tab === 'archive' ? (
        <div className="space-y-4">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontFamily: 'var(--font-mono), monospace', color: 'var(--muted-foreground)' }}>
              <ListFilter size={14} />
              {DOCUMENT_KINDS.map(k => (
                <span key={k} style={{ border: '1px solid var(--border)', borderRadius: 999, padding: '0.2rem 0.6rem' }}>{k}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexGrow: 1, justifyContent: 'flex-end' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents…"
                className={inputCls} style={{ ...inputStyle, maxWidth: 260 }} />
              <button onClick={() => openDocModal('create')} className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold"
                style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', cursor: 'pointer' }}>
                <Plus size={14} /> New Document
              </button>
            </div>
          </div>

          {archive.length === 0 ? (
            <EmptyState message="No documents yet. Create your first speech, paper, interview or note." />
          ) : (
            <div className="card overflow-hidden" style={{ border: '1px solid var(--border)', borderRadius: 12 }}>
              <div className="table-wrap" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--muted-foreground)' }}>
                      <th className="px-4 py-3 font-semibold text-xs uppercase">Kind</th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase">Title</th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase">Year / Date</th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase">File</th>
                      <th className="px-4 py-3 font-semibold text-xs uppercase">Status</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {archive.map(a => (
                      <tr key={a.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="px-4 py-3">
                          <span style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.72rem', color: 'var(--primary)' }}>{a.kind}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-sm">{a.title}</div>
                          <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                            <code>/{a.slug}</code>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>{a.year || '—'} {a.date ? `· ${a.date}` : ''}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {a.fileName ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Upload size={12} /> {a.fileName}</span> : '—'}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {a.status === 'draft' ? (
                              <button onClick={() => submitDoc('published')} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold"
                                style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', cursor: 'pointer' }}>
                                <Eye size={12} /> Publish
                              </button>
                            ) : (
                              <button onClick={() => toggleDocStatus(a)} className="rounded-md px-2 py-1.5 text-xs font-semibold"
                                style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
                                Unpublish
                              </button>
                            )}
                            <AnimBtn onClick={() => openDocModal('edit', a)} className="p-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }} title="Edit">
                              <Pencil size={14} />
                            </AnimBtn>
                            <AnimBtn onClick={() => deleteDoc(a)} className="p-2" style={{ background: 'transparent', color: 'var(--danger)' }} title="Delete">
                              <Trash2 size={14} />
                            </AnimBtn>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : tab === 'milestones' ? (
        <div className="space-y-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search milestones…" className={inputCls} style={{ ...inputStyle, maxWidth: 280 }} />
            <button onClick={() => openMileModal('create')} className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', cursor: 'pointer' }}>
              <Plus size={14} /> New Milestone
            </button>
          </div>
          {milestones.length === 0 ? (
            <EmptyState message="No milestones yet." />
          ) : (
            <div className="card overflow-hidden">
              <div className="table-wrap" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--muted-foreground)' }}>
                      <th>Year</th><th>Title</th><th>Category</th><th>Status</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {milestones.map(m => (
                      <tr key={m.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="px-4 py-3 font-mono text-sm" style={{ color: 'var(--primary)' }}>{m.year}</td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-sm">{m.title}</div>
                          {m.description && <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{m.description.slice(0, 90)}…</div>}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>{m.category}</td>
                        <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {m.status === 'draft' && (
                              <button onClick={() => submitMile('published')} className="rounded-md px-2 py-1.5 text-xs font-semibold" style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', cursor: 'pointer' }}>Publish</button>
                            )}
                            <AnimBtn onClick={() => openMileModal('edit', m)} className="p-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}><Pencil size={14} /></AnimBtn>
                            <AnimBtn onClick={() => deleteMile(m)} className="p-2" style={{ background: 'transparent', color: 'var(--danger)' }}><Trash2 size={14} /></AnimBtn>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search testimonials…" className={inputCls} style={{ ...inputStyle, maxWidth: 280 }} />
            <button onClick={() => openTestiModal('create')} className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', cursor: 'pointer' }}>
              <Plus size={14} /> New Testimonial
            </button>
          </div>
          {testimonials.length === 0 ? (
            <EmptyState message="No testimonials yet." />
          ) : (
            <div className="card overflow-hidden">
              <div className="table-wrap" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--muted-foreground)' }}>
                      <th>Author</th><th>Quote</th><th>Year</th><th>Status</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {testimonials.map(t => (
                      <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-sm">{t.author}</div>
                          {t.role && <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{t.role}</div>}
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: 'var(--muted-foreground)' }}>&ldquo;{t.quote.slice(0, 100)}…&rdquo;</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>{t.year || '—'}</td>
                        <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {t.status === 'draft' && (
                              <button onClick={() => submitTesti('published')} className="rounded-md px-2 py-1.5 text-xs font-semibold" style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', cursor: 'pointer' }}>Publish</button>
                            )}
                            <AnimBtn onClick={() => openTestiModal('edit', t)} className="p-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }}><Pencil size={14} /></AnimBtn>
                            <AnimBtn onClick={() => deleteTesti(t)} className="p-2" style={{ background: 'transparent', color: 'var(--danger)' }}><Trash2 size={14} /></AnimBtn>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

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
              <Field label="Title"><TextInput value={docForm.title} onChange={e => setDocForm(f => ({ ...f, title: e.target.value }))} /></Field>
              <Field label="Date (display)" hint="e.g. 7 January 2021"><TextInput value={docForm.date} onChange={e => setDocForm(f => ({ ...f, date: e.target.value }))} /></Field>
              <Field label="Year" hint="Used for sorting and filters."><TextInput value={docForm.year} onChange={e => setDocForm(f => ({ ...f, year: e.target.value }))} placeholder="2021" /></Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['event', 'location'] as const).map(k => (
                <Field key={k} label={FACET_LABELS[k]}>
                  <TextInput value={docForm[k]} onChange={e => setDocForm(f => ({ ...f, [k]: e.target.value }))} />
                </Field>
              ))}
              {(['person', 'institution'] as const).map(k => (
                <Field key={k} label={FACET_LABELS[k]}>
                  <TextInput value={docForm[k]} onChange={e => setDocForm(f => ({ ...f, [k]: e.target.value }))} />
                </Field>
              ))}
              {(['parliament', 'theme'] as const).map(k => (
                <Field key={k} label={FACET_LABELS[k]}>
                  <TextInput value={docForm[k]} onChange={e => setDocForm(f => ({ ...f, [k]: e.target.value }))} />
                </Field>
              ))}
              <Field label="Venue"><TextInput value={docForm.venue} onChange={e => setDocForm(f => ({ ...f, venue: e.target.value }))} /></Field>
              <Field label="Source name"><TextInput value={docForm.source} onChange={e => setDocForm(f => ({ ...f, source: e.target.value }))} /></Field>
              <Field label="Source URL"><TextInput value={docForm.sourceUrl} onChange={e => setDocForm(f => ({ ...f, sourceUrl: e.target.value }))} /></Field>
            </div>
            <Field label="Excerpt / short description"><TextArea value={docForm.excerpt} onChange={e => setDocForm(f => ({ ...f, excerpt: e.target.value }))} /></Field>
            <Field label="Body / transcript (markdown)" hint="Optional. Rendered on the public detail page.">
              <TextArea value={docForm.body} onChange={e => setDocForm(f => ({ ...f, body: e.target.value }))} style={{ minHeight: 180, fontFamily: 'var(--font-mono), monospace', fontSize: '0.85rem' }} />
            </Field>
            <Field label="Downloadable file (PDF, DOC, TXT, MD…)" hint={docModal?.row?.fileName ? `Current: ${docModal.row.fileName}` : 'Optional — upload the document for public download.'}>
              <input type="file" onChange={e => setDocFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm" style={{ color: 'var(--foreground)' }} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={closeDocModal} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
            {docModal?.mode === 'create' && (
              <button onClick={() => submitDoc('draft')} className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', cursor: 'pointer' }}>
                <Save size={14} /> Save draft
              </button>
            )}
            <button onClick={() => submitDoc('published')} className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', cursor: 'pointer' }}>
              <Eye size={14} /> {docModal?.mode === 'create' ? 'Create & publish' : 'Publish changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Milestone modal ── */}
      <Modal open={mileModal !== null} onClose={closeMileModal} maxWidth="640px">
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4">{mileModal?.mode === 'create' ? 'New Milestone' : 'Edit Milestone'}</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Year"><TextInput value={mileForm.year} onChange={e => setMileForm(f => ({ ...f, year: e.target.value }))} placeholder="2021" /></Field>
              <Field label="Period (optional)" hint="e.g. 2001–2009"><TextInput value={mileForm.period} onChange={e => setMileForm(f => ({ ...f, period: e.target.value }))} /></Field>
            </div>
            <Field label="Title"><TextInput value={mileForm.title} onChange={e => setMileForm(f => ({ ...f, title: e.target.value }))} /></Field>
            <Field label="Description"><TextArea value={mileForm.description} onChange={e => setMileForm(f => ({ ...f, description: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">
                <Select value={mileForm.category} onChange={e => setMileForm(f => ({ ...f, category: e.target.value }))}>
                  {['early-life', 'education', 'career', 'parliament', 'national'].map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Order"><TextInput value={mileForm.order} onChange={e => setMileForm(f => ({ ...f, order: e.target.value }))} /></Field>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={closeMileModal} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
            {mileModal?.mode === 'create' && (
              <button onClick={() => submitMile('draft')} className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', cursor: 'pointer' }}>
                <Save size={14} /> Save draft
              </button>
            )}
            <button onClick={() => submitMile('published')} className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', cursor: 'pointer' }}>
              <Eye size={14} /> {mileModal?.mode === 'create' ? 'Create & publish' : 'Publish changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Testimonial modal ── */}
      <Modal open={testiModal !== null} onClose={closeTestiModal} maxWidth="640px">
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4">{testiModal?.mode === 'create' ? 'New Testimonial' : 'Edit Testimonial'}</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Author"><TextInput value={testiForm.author} onChange={e => setTestiForm(f => ({ ...f, author: e.target.value }))} /></Field>
              <Field label="Role / title"><TextInput value={testiForm.role} onChange={e => setTestiForm(f => ({ ...f, role: e.target.value }))} /></Field>
            </div>
            <Field label="Quote"><TextArea value={testiForm.quote} onChange={e => setTestiForm(f => ({ ...f, quote: e.target.value }))} style={{ minHeight: 120 }} /></Field>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Year"><TextInput value={testiForm.year} onChange={e => setTestiForm(f => ({ ...f, year: e.target.value }))} placeholder="2024" /></Field>
              <Field label="Source"><TextInput value={testiForm.source} onChange={e => setTestiForm(f => ({ ...f, source: e.target.value }))} /></Field>
              <Field label="Sort order"><TextInput value={testiForm.sortOrder} onChange={e => setTestiForm(f => ({ ...f, sortOrder: e.target.value }))} /></Field>
            </div>
            <Field label="Photo URL (optional)"><TextInput value={testiForm.photoUrl} onChange={e => setTestiForm(f => ({ ...f, photoUrl: e.target.value }))} /></Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={closeTestiModal} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', cursor: 'pointer' }}>Cancel</button>
            {testiModal?.mode === 'create' && (
              <button onClick={() => submitTesti('draft')} className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', cursor: 'pointer' }}>
                <Save size={14} /> Save draft
              </button>
            )}
            <button onClick={() => submitTesti('published')} className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', cursor: 'pointer' }}>
              <Eye size={14} /> {testiModal?.mode === 'create' ? 'Create & publish' : 'Publish changes'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}