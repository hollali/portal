'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  FileText,
  Save,
  Trash2,
  Plus,
  Pencil,
  Eye,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  ExternalLink,
} from 'lucide-react'
import { Modal, AnimBtn, Toast, Skeleton, EmptyState } from '@/components/ui'
import {
  DEFAULT_SECTIONS,
  normalizeSlug,
  type SectionKey,
  type SectionData,
  type HeroData,
  type BiographyData,
  type TimelineData,
  type InstitutionsData,
} from '@/lib/content'

type Tab = 'sections' | 'pages'

interface SectionRow {
  id: number
  key: string
  title: string | null
  body: string | null
  data: string | null
  status: string
  updatedAt: string
}

interface PageRow {
  id: number
  slug: string
  title: string
  body: string
  status: string
  publishedAt: string | null
  updatedAt: string
}

const inputStyle: React.CSSProperties = {
  background: 'var(--background)',
  borderColor: 'var(--border)',
  color: 'var(--foreground)',
}

const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm'
const labelCls = 'block text-xs font-semibold mb-1'

const FACT_ICONS = ['scale', 'landmark', 'graduation-cap', 'sparkles', 'quote', 'star', 'award', 'heart', 'users', 'flag']

/* ─────────────────────────────── Shared form pieces ─────────────────────────────── */

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

function StatusBadge({ status }: { status: string }) {
  const published = status === 'published'
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{
        background: published ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
        color: published ? '#16a34a' : '#b45309',
      }}>
      {published ? 'Published' : 'Draft'}
    </span>
  )
}

interface RowFieldSpec<T> {
  key: keyof T
  label: string
  type?: 'text' | 'textarea' | 'select'
  options?: string[]
  placeholder?: string
}

function RowEditor<T extends Record<string, string>>({
  rows,
  fields,
  onChange,
  addLabel,
  keyOf,
}: {
  rows: T[]
  fields: RowFieldSpec<T>[]
  onChange: (rows: T[]) => void
  addLabel: string
  keyOf: string
}) {
  const update = (i: number, k: string, v: string) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r))
    onChange(next)
  }
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i))
  const add = () => {
    const base: Record<string, string> = {}
    for (const f of fields) base[String(f.key)] = ''
    onChange([...rows, base as T])
  }

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={`${keyOf}-${i}`} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(fields.length, 3)}, 1fr)` }}>
            {fields.map(f => (
              <div key={String(f.key)}>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>{f.label}</label>
                {f.type === 'select' ? (
                  <select
                    value={row[f.key]}
                    onChange={e => update(i, String(f.key), e.target.value)}
                    className={inputCls}
                    style={{ ...inputStyle, paddingRight: '2rem' }}
                  >
                    {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea
                    value={row[f.key]}
                    onChange={e => update(i, String(f.key), e.target.value)}
                    rows={3}
                    className={inputCls}
                    style={inputStyle}
                  />
                ) : (
                  <input
                    value={row[f.key]}
                    onChange={e => update(i, String(f.key), e.target.value)}
                    placeholder={f.placeholder}
                    className={inputCls}
                    style={inputStyle}
                  />
                )}
              </div>
            ))}
            <div className="flex items-end justify-end">
              <AnimBtn onClick={() => remove(i)} className="p-2" style={{ background: 'transparent', color: 'var(--danger)' }} title="Remove">
                <Trash2 size={16} />
              </AnimBtn>
            </div>
          </div>
        </div>
      ))}
      <button onClick={add} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm"
        style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', cursor: 'pointer', background: 'none' }}>
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  )
}

/* ─────────────────────────────── Section editors ─────────────────────────────── */

function HeroEditor({ value, onChange }: { value: HeroData; onChange: (v: HeroData) => void }) {
  const set = <K extends keyof HeroData>(k: K, v: HeroData[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Eyebrow"><TextInput value={value.eyebrow} onChange={e => set('eyebrow', e.target.value)} /></Field>
        <Field label="Display name (gradient)" hint="Rendered with the accent gradient.">
          <TextInput value={value.displayName} onChange={e => set('displayName', e.target.value)} />
        </Field>
        <Field label="Full name (line above gradient)">
          <TextInput value={value.name} onChange={e => set('name', e.target.value)} />
        </Field>
      </div>
      <Field label="Description" hint="Shown under the hero title.">
        <TextArea value={value.description} onChange={e => set('description', e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Portrait image URL"><TextInput value={value.portraitUrl} onChange={e => set('portraitUrl', e.target.value)} /></Field>
        <Field label="Portrait alt text"><TextInput value={value.portraitAlt} onChange={e => set('portraitAlt', e.target.value)} /></Field>
        <Field label="Profile label"><TextInput value={value.profileLabel} onChange={e => set('profileLabel', e.target.value)} /></Field>
        <Field label="Profile value"><TextInput value={value.profileValue} onChange={e => set('profileValue', e.target.value)} /></Field>
      </div>
      <div>
        <label className={labelCls}>Facts cards</label>
        <RowEditor
          keyOf="fact"
          rows={value.facts.map(f => ({ label: f.label || '', value: f.value || '', icon: f.icon || 'scale' }))}
          fields={[
            { key: 'icon', label: 'Icon', type: 'select', options: FACT_ICONS },
            { key: 'value', label: 'Value' },
            { key: 'label', label: 'Label' },
          ]}
          addLabel="Add fact"
          onChange={rows => set('facts', rows.map(r => ({ icon: r.icon, value: r.value, label: r.label })))}
        />
      </div>
    </div>
  )
}

function BiographyEditor({ value, onChange }: { value: BiographyData; onChange: (v: BiographyData) => void }) {
  const set = <K extends keyof BiographyData>(k: K, v: BiographyData[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-4">
      <Field label="Heading" hint="Use \n to break to a second line.">
        <TextArea value={value.heading} onChange={e => set('heading', e.target.value)} style={{ minHeight: 70 }} />
      </Field>
      <Field label="Intro paragraph"><TextArea value={value.intro} onChange={e => set('intro', e.target.value)} /></Field>
      <div>
        <label className={labelCls}>Detail cards</label>
        <RowEditor
          keyOf="card"
          rows={value.cards.map(c => ({ tag: c.tag, text: c.text }))}
          fields={[
            { key: 'tag', label: 'Tag' },
            { key: 'text', label: 'Text', type: 'textarea' },
          ]}
          addLabel="Add card"
          onChange={rows => set('cards', rows.map(r => ({ tag: r.tag, text: r.text })))}
        />
      </div>
    </div>
  )
}

function TimelineEditor({ value, onChange }: { value: TimelineData; onChange: (v: TimelineData) => void }) {
  const set = <K extends keyof TimelineData>(k: K, v: TimelineData[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <Field label="Heading" hint="Use \n to break to a second line.">
          <TextArea value={value.heading} onChange={e => set('heading', e.target.value)} style={{ minHeight: 70 }} />
        </Field>
        <Field label="Subheading"><TextArea value={value.subheading} onChange={e => set('subheading', e.target.value)} style={{ minHeight: 60 }} /></Field>
      </div>
      <div>
        <label className={labelCls}>Timeline entries</label>
        <RowEditor
          keyOf="entry"
          rows={value.entries.map(e => ({ year: e.year, title: e.title, text: e.text }))}
          fields={[
            { key: 'year', label: 'Year' },
            { key: 'title', label: 'Title' },
            { key: 'text', label: 'Description', type: 'textarea' },
          ]}
          addLabel="Add entry"
          onChange={rows => set('entries', rows.map(r => ({ year: r.year, title: r.title, text: r.text })))}
        />
      </div>
    </div>
  )
}

function InstitutionsEditor({ value, onChange }: { value: InstitutionsData; onChange: (v: InstitutionsData) => void }) {
  const update = (i: number, v: string) => onChange({ items: value.items.map((it, idx) => (idx === i ? v : it)) })
  const remove = (i: number) => onChange({ items: value.items.filter((_, idx) => idx !== i) })
  return (
    <div className="space-y-2">
      {value.items.map((item, i) => (
        <div key={`inst-${i}`} className="flex gap-2 items-center">
          <TextInput value={item} onChange={e => update(i, e.target.value)} placeholder="Institution name" />
          <AnimBtn onClick={() => remove(i)} className="p-2 shrink-0" style={{ background: 'transparent', color: 'var(--danger)' }} title="Remove">
            <Trash2 size={16} />
          </AnimBtn>
        </div>
      ))}
      <button onClick={() => onChange({ items: [...value.items, ''] })}
        className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm"
        style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', cursor: 'pointer', background: 'none' }}>
        <Plus size={14} /> Add institution
      </button>
    </div>
  )
}

/* ─────────────────────────────── Main page ─────────────────────────────── */

export default function ContentAdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('sections')
  const [role, setRole] = useState<string>('')

  const [sections, setSections] = useState<SectionRow[]>([])
  const [pages, setPages] = useState<PageRow[]>([])
  const [loaded, setLoaded] = useState(false)

  const [drafts, setDrafts] = useState<Record<string, SectionData>>({})
  const [openKey, setOpenKey] = useState<string | null>(null)

  const [pageModal, setPageModal] = useState<{ mode: 'create' | 'edit'; page?: PageRow } | null>(null)
  const [pageForm, setPageForm] = useState({ title: '', slug: '', body: '', status: 'draft' })

  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (d.role !== 'admin' && d.role !== 'editor') {
        router.push('/login')
        return
      }
      setRole(d.role)
    })
  }, [router])

  useEffect(() => {
    if (!role) return
    Promise.all([
      fetch('/api/admin/content').then(r => r.json()),
      fetch('/api/admin/pages').then(r => r.json()),
    ]).then(([c, p]) => {
      setSections(c.sections || [])
      setPages(p.pages || [])
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [role])

  const sectionData = (s: SectionRow): SectionData => {
    const key = s.key as SectionKey
    if (drafts[s.key]) return drafts[s.key]
    if (s.data) {
      try { return { ...(DEFAULT_SECTIONS[key] as object), ...JSON.parse(s.data) } as SectionData } catch { /* fallthrough */ }
    }
    return DEFAULT_SECTIONS[key] as SectionData
  }

  const parseDataOf = (s: SectionRow): SectionData => {
    if (s.data) {
      try { return { ...(DEFAULT_SECTIONS[s.key as SectionKey] as object), ...JSON.parse(s.data) } as SectionData } catch { /* noop */ }
    }
    return DEFAULT_SECTIONS[s.key as SectionKey] as SectionData
  }

  const notify = (message: string, type?: 'success' | 'error') => setToast({ message, type })

  const saveSection = async (key: string, status?: 'draft' | 'published') => {
    const data = drafts[key]
    if (!data) return
    setSavingKey(key)
    const res = await fetch('/api/admin/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', key, data, status }),
    })
    const d = await res.json()
    setSavingKey(null)
    if (res.ok) {
      notify(status === 'published' ? `"${key}" published` : `"${key}" saved`)
      setSections(prev => prev.map(s => (s.key === key ? { ...s, data: JSON.stringify(data), status: d.section?.status ?? s.status } : s)))
    } else {
      notify(d.error || 'Failed to save', 'error')
    }
  }

  const setSectionStatus = async (key: string, status: 'draft' | 'published') => {
    const res = await fetch('/api/admin/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_status', key, status }),
    })
    const d = await res.json()
    if (res.ok) {
      notify(`"${key}" ${status === 'published' ? 'published' : 'moved to draft'}`)
      setSections(prev => prev.map(s => (s.key === key ? { ...s, status: d.section?.status ?? status } : s)))
    } else {
      notify(d.error || 'Failed to update', 'error')
    }
  }

  const openEditor = (key: string) => {
    if (openKey === key) { setOpenKey(null); return }
    const sec = sections.find(s => s.key === key)
    setDrafts(prev => ({ ...prev, [key]: sec ? parseDataOf(sec) : DEFAULT_SECTIONS[key as SectionKey] as SectionData }))
    setOpenKey(key)
  }

  const openPageModal = (mode: 'create' | 'edit', page?: PageRow) => {
    setPageModal({ mode, page })
    setPageForm({
      title: page?.title ?? '',
      slug: page?.slug ?? '',
      body: page?.body ?? '',
      status: page?.status ?? 'draft',
    })
  }

  const submitPage = async () => {
    if (!pageModal) return
    const res = await fetch('/api/admin/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: pageModal.mode === 'create' ? 'create' : 'update',
        ...(pageModal.mode === 'edit' && pageModal.page ? { id: pageModal.page.id } : {}),
        title: pageForm.title,
        slug: pageForm.slug,
        body: pageForm.body,
      }),
    })
    const d = await res.json()
    if (!res.ok) { notify(d.error || 'Failed to save page', 'error'); return }
    const reload = await fetch('/api/admin/pages').then(r => r.json())
    setPages(reload.pages || [])
    setPageModal(null)
    notify(pageModal.mode === 'create' ? 'Page created' : 'Page updated')
  }

  const submitPageDraft = async (page: PageRow, draft: boolean) => {
    const res = await fetch('/api/admin/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_status', id: page.id, status: draft ? 'draft' : 'published' }),
    })
    const d = await res.json()
    if (!res.ok) { notify(d.error || 'Failed to update', 'error'); return }
    setPages(prev => prev.map(p => (p.id === page.id ? { ...p, status: d.page.status, publishedAt: d.page.publishedAt } : p)))
    notify(draft ? 'Page moved to draft' : 'Page published')
  }

  const deletePage = async (page: PageRow) => {
    if (!confirm(`Delete page "${page.title}"? This cannot be undone.`)) return
    const res = await fetch('/api/admin/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: page.id }),
    })
    if (res.ok) {
      setPages(prev => prev.filter(p => p.id !== page.id))
      notify('Page deleted')
    } else {
      const d = await res.json()
      notify(d.error || 'Failed to delete', 'error')
    }
  }

  const sectionIcons: Record<SectionKey, React.ReactNode> = {
    home_hero: <Eye size={15} />,
    home_biography: <LayoutDashboard size={15} />,
    home_timeline: <ChevronDown size={15} />,
    home_institutions: <ExternalLink size={15} />,
  }

  const sectionTitles: Record<SectionKey, string> = {
    home_hero: 'Hero & intro',
    home_biography: 'Biography',
    home_timeline: 'Career timeline',
    home_institutions: 'Institutions marquee',
  }

  const notLoaded = !loaded
  const sectionKeys = Object.keys(DEFAULT_SECTIONS) as SectionKey[]

  return (
    <div className="page-enter">
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FileText size={20} style={{ color: 'var(--primary)' }} /> Content
        </h1>
      </div>
      <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
        Manage what visitors see. Changes are staged as drafts and only go live when you publish them.
      </p>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex gap-1 mb-6 rounded-lg p-1 w-fit" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {(['sections', 'pages'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="inline-flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-semibold transition-colors"
            style={{
              background: tab === t ? 'var(--primary)' : 'transparent',
              color: tab === t ? 'var(--primary-fg)' : 'var(--muted-foreground)',
              border: 'none', cursor: 'pointer',
            }}>
            <HomeOrPagesIcon tab={t} /> {t === 'sections' ? 'Homepage Sections' : 'Pages'}
          </button>
        ))}
      </div>

      {notLoaded ? (
        <Skeleton style={{ height: 120, borderRadius: 12 }} />
      ) : tab === 'sections' ? (
        <div className="space-y-4">
          {sectionKeys.map(key => {
            const row = sections.find(s => s.key === key)
            const status = row?.status ?? 'draft'
            const isOpen = openKey === key
            const data = sectionData(row ?? { key, data: null, status, title: null, body: null, id: 0, updatedAt: '' })
            const title = sectionTitles[key]

            return (
              <div key={key} className="card" style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div className="flex items-center justify-between gap-3 p-4 cursor-pointer" onClick={() => openEditor(key)}>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center rounded-lg p-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      {sectionIcons[key]}
                    </span>
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-2">
                        {title}
                        <StatusBadge status={status} />
                      </div>
                      <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        <code>{key}</code> · updated {row ? new Date(row.updatedAt).toLocaleString() : 'never'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOpen && (
                      <>
                        <button onClick={e => { e.stopPropagation(); saveSection(key) }}
                          disabled={savingKey === key}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
                          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', cursor: 'pointer' }}>
                          <Save size={14} /> {savingKey === key ? 'Saving…' : 'Save draft'}
                        </button>
                        <button onClick={e => { e.stopPropagation(); saveSection(key, 'published') }}
                          disabled={savingKey === key}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
                          style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', cursor: 'pointer' }}>
                          <Eye size={14} /> Publish
                        </button>
                        {status === 'published' && (
                          <button onClick={e => { e.stopPropagation(); setSectionStatus(key, 'draft') }}
                            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold"
                            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
                            Unpublish
                          </button>
                        )}
                      </>
                    )}
                    {isOpen ? <ChevronUp size={18} className="shrink-0" style={{ color: 'var(--muted-foreground)' }} /> : <ChevronDown size={18} className="shrink-0" style={{ color: 'var(--muted-foreground)' }} />}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t p-4" style={{ borderColor: 'var(--border)' }}>
                    {key === 'home_hero' && <HeroEditor value={data as HeroData} onChange={v => setDrafts(prev => ({ ...prev, [key]: v }))} />}
                    {key === 'home_biography' && <BiographyEditor value={data as BiographyData} onChange={v => setDrafts(prev => ({ ...prev, [key]: v }))} />}
                    {key === 'home_timeline' && <TimelineEditor value={data as TimelineData} onChange={v => setDrafts(prev => ({ ...prev, [key]: v }))} />}
                    {key === 'home_institutions' && <InstitutionsEditor value={data as InstitutionsData} onChange={v => setDrafts(prev => ({ ...prev, [key]: v }))} />}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* ───────────────────────── Pages tab ───────────────────────── */
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => openPageModal('create')}
              className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', cursor: 'pointer' }}>
              <Plus size={15} /> New Page
            </button>
          </div>

          {pages.length === 0 ? (
            <EmptyState message="No pages yet. Create your first page to publish content to the public site." />
          ) : (
            <div className="card overflow-hidden" style={{ border: '1px solid var(--border)', borderRadius: 12 }}>
              <table className="table-wrap" style={{ width: '100%', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--muted-foreground)' }}>
                    <th className="px-4 py-3 font-semibold text-xs uppercase">Title</th>
                    <th className="px-4 py-3 font-semibold text-xs uppercase">URL</th>
                    <th className="px-4 py-3 font-semibold text-xs uppercase">Status</th>
                    <th className="px-4 py-3 font-semibold text-xs uppercase">Updated</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {pages.map(p => (
                    <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-sm">{p.title}</div>
                      </td>
                      <td className="px-4 py-3">
                        <a href={`/${p.slug}`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs"
                          style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                          /{p.slug} <ExternalLink size={12} />
                        </a>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {new Date(p.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <AnimBtn onClick={() => openPageModal('edit', p)} className="p-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)' }} title="Edit">
                            <Pencil size={14} />
                          </AnimBtn>
                          {p.status === 'draft' ? (
                            <button onClick={() => submitPageDraft(p, false)}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold"
                              style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', cursor: 'pointer' }}>
                              Publish
                            </button>
                          ) : (
                            <button onClick={() => submitPageDraft(p, true)}
                              className="inline-flex items-center rounded-md px-2 py-1.5 text-xs font-semibold"
                              style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
                              Unpublish
                            </button>
                          )}
                          <AnimBtn onClick={() => deletePage(p)} className="p-2" style={{ background: 'transparent', color: 'var(--danger)' }} title="Delete">
                            <Trash2 size={14} />
                          </AnimBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ───────────── Page create/edit modal ───────────── */}
      <Modal open={pageModal !== null} onClose={() => setPageModal(null)} maxWidth="640px">
        <div className="p-6">
          <h2 className="text-lg font-bold mb-1">{pageModal?.mode === 'create' ? 'New Page' : 'Edit Page'}</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--muted-foreground)' }}>
            Pages are rendered at a public URL from markdown. Save it as a draft and publish when ready.
          </p>
          <div className="space-y-4">
            <Field label="Title">
              <TextInput value={pageForm.title} onChange={e => setPageForm(f => ({ ...f, title: e.target.value }))} placeholder="About Alban Bagbin" />
            </Field>
            <Field label="Slug" hint="Public URL path. Auto-friendly from the title.">
              <div className="flex items-center gap-1">
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>/</span>
                <TextInput value={pageForm.slug} onChange={e => setPageForm(f => ({ ...f, slug: normalizeSlug(e.target.value) }))} placeholder="about" />
              </div>
            </Field>
            <Field label="Body (markdown)" hint="Supports headings, bold, links, lists, quotes and images via markdown.">
              <TextArea value={pageForm.body} onChange={e => setPageForm(f => ({ ...f, body: e.target.value }))}
                placeholder={'# Heading\n\nWrite your content here with **markdown**.\n\n- bullet\n- points\n\n[links](https://…)'}
                style={{ minHeight: 240, fontFamily: 'var(--font-mono), monospace', fontSize: '0.85rem' }} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={() => setPageModal(null)}
              className="rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={submitPage}
              className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', cursor: 'pointer' }}>
              <Save size={14} /> {pageModal?.mode === 'create' ? 'Create page' : 'Save changes'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function HomeOrPagesIcon({ tab }: { tab: Tab }) {
  return tab === 'sections' ? <LayoutDashboard size={15} /> : <FileText size={15} />
}