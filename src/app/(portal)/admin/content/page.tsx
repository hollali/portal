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
import { Modal, Skeleton, EmptyState, ConfirmDialog } from '@/components/ui'
import { Button, Field, Input, Textarea, Select, StatusBadge, PageHeader, Tabs, useToast } from '@/components/ui/kit'
import { jsonFetch } from '@/lib/jsonFetch'
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

const FACT_ICONS = ['scale', 'landmark', 'graduation-cap', 'sparkles', 'quote', 'star', 'award', 'heart', 'users', 'flag']

/* ─────────────────────────────── Shared form pieces ─────────────────────────────── */

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
              <Field key={String(f.key)} label={f.label}>
                {f.type === 'select' ? (
                  <Select value={row[f.key]} onChange={e => update(i, String(f.key), e.target.value)}>
                    {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </Select>
                ) : f.type === 'textarea' ? (
                  <Textarea value={row[f.key]} onChange={e => update(i, String(f.key), e.target.value)} minHeight={70} />
                ) : (
                  <Input value={row[f.key]} onChange={e => update(i, String(f.key), e.target.value)} placeholder={f.placeholder} />
                )}
              </Field>
            ))}
            <div className="flex items-end justify-end">
              <Button variant="ghost" size="sm" iconOnly onClick={() => remove(i)} aria-label={`Remove row ${i + 1}`} title="Remove">
                <Trash2 size={16} style={{ color: 'var(--danger)' }} />
              </Button>
            </div>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add} iconLeft={<Plus size={14} />}>
        {addLabel}
      </Button>
    </div>
  )
}

/* ─────────────────────────────── Section editors ─────────────────────────────── */

function HeroEditor({ value, onChange }: { value: HeroData; onChange: (v: HeroData) => void }) {
  const set = <K extends keyof HeroData>(k: K, v: HeroData[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Eyebrow"><Input value={value.eyebrow} onChange={e => set('eyebrow', e.target.value)} /></Field>
        <Field label="Display name (gradient)" hint="Rendered with the accent gradient.">
          <Input value={value.displayName} onChange={e => set('displayName', e.target.value)} />
        </Field>
        <Field label="Full name (line above gradient)">
          <Input value={value.name} onChange={e => set('name', e.target.value)} />
        </Field>
      </div>
      <Field label="Description" hint="Shown under the hero title.">
        <Textarea value={value.description} onChange={e => set('description', e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Portrait image URL"><Input value={value.portraitUrl} onChange={e => set('portraitUrl', e.target.value)} /></Field>
        <Field label="Portrait alt text"><Input value={value.portraitAlt} onChange={e => set('portraitAlt', e.target.value)} /></Field>
        <Field label="Profile label"><Input value={value.profileLabel} onChange={e => set('profileLabel', e.target.value)} /></Field>
        <Field label="Profile value"><Input value={value.profileValue} onChange={e => set('profileValue', e.target.value)} /></Field>
      </div>
      <fieldset>
        <legend className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Facts cards</legend>
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
      </fieldset>
    </div>
  )
}

function BiographyEditor({ value, onChange }: { value: BiographyData; onChange: (v: BiographyData) => void }) {
  const set = <K extends keyof BiographyData>(k: K, v: BiographyData[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-4">
      <Field label="Heading" hint="Use \n to break to a second line.">
        <Textarea value={value.heading} onChange={e => set('heading', e.target.value)} style={{ minHeight: 70 }} />
      </Field>
      <Field label="Intro paragraph"><Textarea value={value.intro} onChange={e => set('intro', e.target.value)} /></Field>
      <fieldset>
        <legend className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Detail cards</legend>
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
      </fieldset>
    </div>
  )
}

function TimelineEditor({ value, onChange }: { value: TimelineData; onChange: (v: TimelineData) => void }) {
  const set = <K extends keyof TimelineData>(k: K, v: TimelineData[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        <Field label="Heading" hint="Use \n to break to a second line.">
          <Textarea value={value.heading} onChange={e => set('heading', e.target.value)} style={{ minHeight: 70 }} />
        </Field>
        <Field label="Subheading"><Textarea value={value.subheading} onChange={e => set('subheading', e.target.value)} style={{ minHeight: 60 }} /></Field>
      </div>
      <fieldset>
        <legend className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Timeline entries</legend>
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
      </fieldset>
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
          <Input value={item} onChange={e => update(i, e.target.value)} placeholder="Institution name" aria-label={`Institution ${i + 1}`} />
          <Button variant="ghost" size="md" iconOnly onClick={() => remove(i)} aria-label={`Remove institution ${i + 1}`} title="Remove" className="shrink-0">
            <Trash2 size={16} style={{ color: 'var(--danger)' }} />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange({ items: [...value.items, ''] })} iconLeft={<Plus size={14} />}>
        Add institution
      </Button>
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
  const [confirm, setConfirm] = useState<{ title: string; message: React.ReactNode; onConfirm: () => Promise<void> } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<number | null>(null)

  useEffect(() => {
    jsonFetch<{ role?: string }>('/api/me').then(d => {
      if (d?.role !== 'admin' && d?.role !== 'editor') {
        router.push('/login')
        return
      }
      setRole(d.role)
    })
  }, [router])

  useEffect(() => {
    if (!role) return
    Promise.all([
      jsonFetch<{ sections?: SectionRow[] }>('/api/admin/content'),
      jsonFetch<{ pages?: PageRow[] }>('/api/admin/pages'),
    ]).then(([c, p]) => {
      setSections(c?.sections || [])
      setPages(p?.pages || [])
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

  const { toast } = useToast()
  const notify = (message: string, type: 'success' | 'error' = 'success') => toast(message, { tone: type })

  const saveSection = async (key: string, status?: 'draft' | 'published') => {
    const data = drafts[key]
    if (!data) return
    setSavingKey(key)
    const res = await fetch('/api/admin/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', key, data, status }),
    })
    const d: { error?: string; section?: SectionRow } = await res.json().catch(() => ({}))
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
    const d: { error?: string; section?: SectionRow } = await res.json().catch(() => ({}))
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
    const d: { error?: string } = await res.json().catch(() => ({}))
    if (!res.ok) { notify(d.error || 'Failed', 'error'); return }
    const reload = await jsonFetch<{ pages?: PageRow[] }>('/api/admin/pages')
    setPages(reload?.pages || [])
    setPageModal(null)
    notify(pageModal.mode === 'create' ? 'Page created' : 'Page updated')
  }

  const submitPageDraft = async (page: PageRow, draft: boolean) => {
    setSavingId(page.id)
    const res = await fetch('/api/admin/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'set_status', id: page.id, status: draft ? 'draft' : 'published' }),
    })
    const d: { error?: string; page?: PageRow } = await res.json().catch(() => ({}))
    setSavingId(null)
    if (!res.ok) { notify(d.error || 'Failed', 'error'); return }
    setPages(prev => prev.map(p => (p.id === page.id ? { ...p, status: d.page?.status ?? p.status, publishedAt: d.page?.publishedAt ?? p.publishedAt } : p)))
    notify(draft ? 'Page moved to draft' : 'Page published')
  }

  const deletePage = async (page: PageRow) => {
    const res = await fetch('/api/admin/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: page.id }),
    })
    if (res.ok) {
      setPages(prev => prev.filter(p => p.id !== page.id))
      notify('Page deleted')
    } else {
      const d: { error?: string } = await res.json().catch(() => ({}))
      notify(d.error || 'Failed', 'error')
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

  const askDeletePage = (page: PageRow) =>
    setConfirm({
      title: 'Delete page?',
      message: <>This will permanently delete <strong>&ldquo;{page.title}&rdquo;</strong> and any content on <code>/{page.slug}</code>. This cannot be undone.</>,
      onConfirm: () => runDelete(() => deletePage(page)),
    })

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
      <PageHeader
        title="Content"
        icon={<FileText size={20} />}
        description="Manage what visitors see. Changes are staged as drafts and only go live when you publish them."
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Content' }]}
      />

      <Tabs
        label="Content views"
        value={tab}
        onChange={setTab}
        className="mb-6"
        items={[
          { value: 'sections', label: 'Homepage Sections', icon: <LayoutDashboard size={15} /> },
          { value: 'pages', label: 'Pages', icon: <FileText size={15} /> },
        ]}
      />

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
                        <Button
                          variant="secondary"
                          size="sm"
                          loading={savingKey === key}
                          onClick={e => { e.stopPropagation(); saveSection(key) }}
                        >
                          Save draft
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          iconLeft={<Eye size={14} />}
                          onClick={e => { e.stopPropagation(); saveSection(key, 'published') }}
                        >
                          Publish
                        </Button>
                        {status === 'published' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={e => { e.stopPropagation(); setSectionStatus(key, 'draft') }}
                          >
                            Unpublish
                          </Button>
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
            <Button variant="primary" onClick={() => openPageModal('create')} iconLeft={<Plus size={15} />}>
              New Page
            </Button>
          </div>

          {pages.length === 0 ? (
            <EmptyState
              icon={<FileText size={40} />}
              title="No pages yet"
              message="Create your first page to publish content to the public site."
              action={
                <Button variant="primary" onClick={() => openPageModal('create')} iconLeft={<Plus size={15} />}>
                  New Page
                </Button>
              }
            />
          ) : (
            <div className="card overflow-hidden" style={{ border: '1px solid var(--border)', borderRadius: 12 }}>
              <div className="table-wrap table-cards">
                <table style={{ width: '100%', fontSize: '0.875rem' }}>
                <caption className="sr-only">Published and draft pages</caption>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--muted-foreground)' }}>
                    <th scope="col" className="px-4 py-3 font-semibold text-xs uppercase">Title</th>
                    <th scope="col" className="px-4 py-3 font-semibold text-xs uppercase">URL</th>
                    <th scope="col" className="px-4 py-3 font-semibold text-xs uppercase">Status</th>
                    <th scope="col" className="px-4 py-3 font-semibold text-xs uppercase">Updated</th>
                    <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map(p => (
                    <tr key={p.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td data-label="Title" className="px-4 py-3">
                        <div className="font-semibold text-sm">{p.title}</div>
                      </td>
                      <td data-label="URL" className="px-4 py-3">
                        <a href={`/${p.slug}`} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs"
                          style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                          /{p.slug} <ExternalLink size={12} />
                        </a>
                      </td>
                      <td data-label="Status" className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td data-label="Updated" className="px-4 py-3 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        {new Date(p.updatedAt).toLocaleDateString()}
                      </td>
                      <td data-label="Actions" data-wide className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="secondary"
                            size="sm"
                            iconOnly
                            onClick={() => openPageModal('edit', p)}
                            aria-label={`Edit ${p.title}`}
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </Button>
                          {p.status === 'draft' ? (
                            <Button variant="primary" size="sm" loading={savingId === p.id} onClick={() => submitPageDraft(p, false)}>
                              Publish
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" loading={savingId === p.id} onClick={() => submitPageDraft(p, true)}>
                              Unpublish
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            iconOnly
                            onClick={() => askDeletePage(p)}
                            aria-label={`Delete ${p.title}`}
                            title="Delete"
                          >
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
            <Field label="Title" required>
              <Input value={pageForm.title} onChange={e => setPageForm(f => ({ ...f, title: e.target.value }))} placeholder="About Alban Bagbin" />
            </Field>
            <Field label="Slug" hint="Public URL path. Auto-friendly from the title." required>
              <div className="flex items-center gap-1">
                <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>/</span>
                <Input value={pageForm.slug} onChange={e => setPageForm(f => ({ ...f, slug: normalizeSlug(e.target.value) }))} placeholder="about" />
              </div>
            </Field>
            <Field label="Body (markdown)" hint="Supports headings, bold, links, lists, quotes and images via markdown.">
              <Textarea value={pageForm.body} onChange={e => setPageForm(f => ({ ...f, body: e.target.value }))}
                placeholder={'# Heading\n\nWrite your content here with **markdown**.\n\n- bullet\n- points\n\n[links](https://…)'}
                style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.85rem' }} minHeight={240} />
            </Field>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setPageModal(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submitPage} iconLeft={<Save size={14} />}>
              {pageModal?.mode === 'create' ? 'Create page' : 'Save changes'}
            </Button>
          </div>
        </div>
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
