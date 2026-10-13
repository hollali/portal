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
  type PageHeroData,
  type ManPageData,
  type SchoolsData,
  type QuotesData,
  type RulingsData,
  type CollectionsData,
  type CoreThemesData,
  type MediaCardsData,
  type MediaSocialsData,
  type FooterData,
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

function PageHeroEditor({ value, onChange }: { value: PageHeroData; onChange: (v: PageHeroData) => void }) {
  const set = <K extends keyof PageHeroData>(k: K, v: PageHeroData[K]) => onChange({ ...value, [k]: v })
  return (
    <div className="space-y-4">
      <Field label="Eyebrow"><Input value={value.eyebrow} onChange={e => set('eyebrow', e.target.value)} /></Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Heading (plain part)"><Input value={value.titleA} onChange={e => set('titleA', e.target.value)} /></Field>
        <Field label="Heading (accent part)" hint="Rendered in the editorial serif accent."><Input value={value.titleAccent} onChange={e => set('titleAccent', e.target.value)} /></Field>
      </div>
      <Field label="Intro paragraph"><Textarea value={value.lede} onChange={e => set('lede', e.target.value)} /></Field>
    </div>
  )
}

function ManPageEditor({ value, onChange }: { value: ManPageData; onChange: (v: ManPageData) => void }) {
  const set = <K extends keyof ManPageData>(k: K, v: ManPageData[K]) => onChange({ ...value, [k]: v })
  const [selected, setSelected] = useState(0)
  const idx = Math.min(selected, Math.max(0, value.sections.length - 1))
  const section = value.sections[idx]

  const updateSection = (i: number, patch: Partial<(typeof value.sections)[number]>) =>
    set('sections', value.sections.map((s, n) => (n === i ? { ...s, ...patch } : s)))
  const addSection = () =>
    set('sections', [...value.sections, { id: `section-${value.sections.length + 1}`, eyebrow: `0${value.sections.length + 1}`, title: 'New chapter', intro: '', items: [] }])
  const removeSection = (i: number) => {
    set('sections', value.sections.filter((_, n) => n !== i))
    setSelected(0)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Hero heading (plain part)"><Input value={value.heroTitleA} onChange={e => set('heroTitleA', e.target.value)} /></Field>
        <Field label="Hero heading (accent part)"><Input value={value.heroTitleAccent} onChange={e => set('heroTitleAccent', e.target.value)} /></Field>
      </div>
      <Field label="Hero intro"><Textarea value={value.heroIntro} onChange={e => set('heroIntro', e.target.value)} /></Field>
      <Field label="Hero quote"><Textarea value={value.heroQuote} onChange={e => set('heroQuote', e.target.value)} /></Field>
      <fieldset>
        <legend className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Chapters</legend>
        <div className="flex flex-wrap gap-2 mb-3">
          {value.sections.map((s, i) => (
            <div key={`${s.id}-${i}`} className="flex items-center gap-1 rounded-lg border px-2 py-1" style={{ borderColor: i === idx ? 'var(--primary)' : 'var(--border)' }}>
              <button type="button" onClick={() => setSelected(i)} className="text-xs font-semibold px-1" style={{ color: i === idx ? 'var(--primary)' : 'var(--foreground)' }}>
                {s.title || `Chapter ${i + 1}`}
              </button>
              <button type="button" onClick={() => removeSection(i)} aria-label={`Remove ${s.title || `chapter ${i + 1}`}`} title="Remove" className="p-1">
                <Trash2 size={12} style={{ color: 'var(--danger)' }} />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addSection} iconLeft={<Plus size={14} />}>Add chapter</Button>
        </div>
        {section && (
          <div className="space-y-4 rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Anchor id" hint="Used in #links. Lowercase, dashes."><Input value={section.id} onChange={e => updateSection(idx, { id: e.target.value })} /></Field>
              <Field label="Eyebrow"><Input value={section.eyebrow} onChange={e => updateSection(idx, { eyebrow: e.target.value })} /></Field>
              <Field label="Title"><Input value={section.title} onChange={e => updateSection(idx, { title: e.target.value })} /></Field>
            </div>
            <Field label="Intro"><Textarea value={section.intro} onChange={e => updateSection(idx, { intro: e.target.value })} minHeight={70} /></Field>
            <fieldset>
              <legend className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Entries</legend>
              <RowEditor
                keyOf={`man-${idx}`}
                rows={section.items.map(it => ({ title: it.title, text: it.text }))}
                fields={[
                  { key: 'title', label: 'Heading' },
                  { key: 'text', label: 'Text', type: 'textarea' },
                ]}
                addLabel="Add entry"
                onChange={rows => updateSection(idx, { items: rows.map(r => ({ title: r.title, text: r.text })) })}
              />
            </fieldset>
          </div>
        )}
      </fieldset>
    </div>
  )
}

function StringListEditor({ value, onChange, itemLabel, addLabel, placeholder }: {
  value: string[]
  onChange: (v: string[]) => void
  itemLabel: string
  addLabel: string
  placeholder?: string
}) {
  return (
    <div className="space-y-2">
      {value.map((item, i) => (
        <div key={`${itemLabel}-${i}`} className="flex gap-2 items-start">
          <Textarea value={item} onChange={e => onChange(value.map((it, n) => (n === i ? e.target.value : it)))} placeholder={placeholder} aria-label={`${itemLabel} ${i + 1}`} minHeight={70} />
          <Button variant="ghost" size="md" iconOnly onClick={() => onChange(value.filter((_, n) => n !== i))} aria-label={`Remove ${itemLabel.toLowerCase()} ${i + 1}`} title="Remove" className="shrink-0">
            <Trash2 size={16} style={{ color: 'var(--danger)' }} />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...value, ''])} iconLeft={<Plus size={14} />}>
        {addLabel}
      </Button>
    </div>
  )
}

const COLLECTION_COUNT_OPTIONS = ['speeches', 'papers', 'interviews', 'notes', 'milestones', 'testimonials', 'photos', 'news', 'videos', 'audio']

function RulingsEditor({ value, onChange }: { value: RulingsData; onChange: (v: RulingsData) => void }) {
  return (
    <RowEditor
      keyOf="ruling"
      rows={value.items.map(r => ({ tag: r.tag, title: r.title, note: r.note }))}
      fields={[
        { key: 'tag', label: 'Tag' },
        { key: 'title', label: 'Title' },
        { key: 'note', label: 'Summary', type: 'textarea' },
      ]}
      addLabel="Add ruling"
      onChange={rows => onChange({ items: rows.map(r => ({ tag: r.tag, title: r.title, note: r.note })) })}
    />
  )
}

function SchoolsEditor({ value, onChange }: { value: SchoolsData; onChange: (v: SchoolsData) => void }) {
  return (
    <RowEditor
      keyOf="school"
      rows={value.items.map(s => ({ name: s.name, cap: s.cap }))}
      fields={[
        { key: 'name', label: 'School' },
        { key: 'cap', label: 'Caption' },
      ]}
      addLabel="Add school"
      onChange={rows => onChange({ items: rows.map(r => ({ name: r.name, cap: r.cap })) })}
    />
  )
}

function CollectionsEditor({ value, onChange }: { value: CollectionsData; onChange: (v: CollectionsData) => void }) {
  return (
    <RowEditor
      keyOf="collection"
      rows={value.items.map(c => ({ href: c.href, label: c.label, description: c.description, count: c.count }))}
      fields={[
        { key: 'href', label: 'Link' },
        { key: 'label', label: 'Label' },
        { key: 'description', label: 'Description', type: 'textarea' },
        { key: 'count', label: 'Live count', type: 'select', options: COLLECTION_COUNT_OPTIONS },
      ]}
      addLabel="Add collection"
      onChange={rows => onChange({ items: rows.map(r => ({ href: r.href, label: r.label, description: r.description, count: r.count })) })}
    />
  )
}

function CoreThemesEditor({ value, onChange }: { value: CoreThemesData; onChange: (v: CoreThemesData) => void }) {
  return (
    <RowEditor
      keyOf="theme"
      rows={value.items.map(t => ({ slug: t.slug, name: t.name, motto: t.motto, description: t.description }))}
      fields={[
        { key: 'slug', label: 'Slug' },
        { key: 'name', label: 'Name' },
        { key: 'motto', label: 'Motto' },
        { key: 'description', label: 'Description', type: 'textarea' },
      ]}
      addLabel="Add theme"
      onChange={rows => onChange({ items: rows.map(r => ({ slug: r.slug, name: r.name, motto: r.motto, description: r.description })) })}
    />
  )
}

function MediaCardsEditor({ value, onChange }: { value: MediaCardsData; onChange: (v: MediaCardsData) => void }) {
  return (
    <RowEditor
      keyOf="mediacard"
      rows={value.items.map(c => ({ href: c.href, label: c.label, note: c.note }))}
      fields={[
        { key: 'href', label: 'Link' },
        { key: 'label', label: 'Label' },
        { key: 'note', label: 'Note', type: 'textarea' },
      ]}
      addLabel="Add card"
      onChange={rows => onChange({ items: rows.map(r => ({ href: r.href, label: r.label, note: r.note })) })}
    />
  )
}

function MediaSocialsEditor({ value, onChange }: { value: MediaSocialsData; onChange: (v: MediaSocialsData) => void }) {
  return (
    <RowEditor
      keyOf="social"
      rows={value.items.map(s => ({ label: s.label, href: s.href, handle: s.handle }))}
      fields={[
        { key: 'label', label: 'Label' },
        { key: 'href', label: 'URL' },
        { key: 'handle', label: 'Handle' },
      ]}
      addLabel="Add channel"
      onChange={rows => onChange({ items: rows.map(r => ({ label: r.label, href: r.href, handle: r.handle })) })}
    />
  )
}

const linksToText = (links: { label: string; href: string }[]) => links.map(l => `${l.label} | ${l.href}`).join('\n')
const textToLinks = (text: string) =>
  text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [label, href] = line.split('|').map(s => s.trim())
    return { label: label || line, href: href || '#' }
  })

function FooterEditor({ value, onChange }: { value: FooterData; onChange: (v: FooterData) => void }) {
  const updateCol = (i: number, patch: Partial<(typeof value.columns)[number]>) =>
    onChange({ ...value, columns: value.columns.map((c, n) => (n === i ? { ...c, ...patch } : c)) })
  return (
    <div className="space-y-4">
      <Field label="Brand tagline"><Textarea value={value.tagline} onChange={e => onChange({ ...value, tagline: e.target.value })} /></Field>
      <fieldset>
        <legend className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Link columns</legend>
        <div className="space-y-3">
          {value.columns.map((col, i) => (
            <div key={`col-${i}`} className="rounded-lg border p-3 space-y-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Field label="Column title"><Input value={col.title} onChange={e => updateCol(i, { title: e.target.value })} /></Field>
                </div>
                <Button variant="ghost" size="sm" iconOnly onClick={() => onChange({ ...value, columns: value.columns.filter((_, n) => n !== i) })} aria-label={`Remove column ${col.title}`} title="Remove">
                  <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                </Button>
              </div>
              <Field label="Links" hint="One per line: Label | /href">
                <Textarea value={linksToText(col.links)} onChange={e => updateCol(i, { links: textToLinks(e.target.value) })} style={{ fontFamily: 'var(--font-mono), monospace', fontSize: '0.82rem' }} minHeight={110} />
              </Field>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => onChange({ ...value, columns: [...value.columns, { title: 'New column', links: [] }] })} iconLeft={<Plus size={14} />}>
            Add column
          </Button>
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-xs font-semibold mb-1.5" style={{ color: 'var(--muted-foreground)' }}>Social links</legend>
        <RowEditor
          keyOf="footersocial"
          rows={value.social.map(s => ({ label: s.label, href: s.href }))}
          fields={[
            { key: 'label', label: 'Label' },
            { key: 'href', label: 'URL' },
          ]}
          addLabel="Add social link"
          onChange={rows => onChange({ ...value, social: rows.map(r => ({ label: r.label, href: r.href })) })}
        />
      </fieldset>
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
    home_schools: <ExternalLink size={15} />,
    home_quotes: <Pencil size={15} />,
    the_man: <FileText size={15} />,
    parliament_rulings: <Eye size={15} />,
    hero_timeline: <Eye size={15} />,
    hero_parliament: <Eye size={15} />,
    hero_speaker_record: <Eye size={15} />,
    hero_themes: <Eye size={15} />,
    hero_ask: <Eye size={15} />,
    hero_search: <Eye size={15} />,
    hero_media: <Eye size={15} />,
    hero_archives: <Eye size={15} />,
    archive_collections: <LayoutDashboard size={15} />,
    core_themes: <LayoutDashboard size={15} />,
    media_cards: <LayoutDashboard size={15} />,
    media_socials: <ExternalLink size={15} />,
    site_footer: <LayoutDashboard size={15} />,
  }

  const sectionTitles: Record<SectionKey, string> = {
    home_hero: 'Home · Hero & intro',
    home_biography: 'Home · Biography',
    home_timeline: 'Home · Career timeline',
    home_institutions: 'Home · Institutions',
    home_schools: 'Home · Schools marquee',
    home_quotes: 'Home · Testimonial quotes',
    the_man: 'The Man page · Chapters & hero',
    parliament_rulings: 'Parliament page · Signature rulings',
    hero_timeline: 'Hero · Timeline page',
    hero_parliament: 'Hero · Parliament page',
    hero_speaker_record: 'Hero · Speaker Record page',
    hero_themes: 'Hero · Themes page',
    hero_ask: 'Hero · Ask page',
    hero_search: 'Hero · Search page',
    hero_media: 'Hero · Media page',
    hero_archives: 'Hero · Archives hub',
    archive_collections: 'Collections (home + archives hub)',
    core_themes: 'Themes page · Core themes',
    media_cards: 'Media page · Collection cards',
    media_socials: 'Media page · Social channels',
    site_footer: 'Footer · Columns & social',
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
          { value: 'sections', label: 'Site content', icon: <LayoutDashboard size={15} /> },
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
                    {key === 'home_schools' && <SchoolsEditor value={data as SchoolsData} onChange={v => setDrafts(prev => ({ ...prev, [key]: v }))} />}
                    {key === 'home_quotes' && <StringListEditor value={(data as QuotesData).items} onChange={items => setDrafts(prev => ({ ...prev, [key]: { items } }))} itemLabel="Quote" addLabel="Add quote" placeholder="Testimonial quote shown on the home page…" />}
                    {key === 'the_man' && <ManPageEditor value={data as ManPageData} onChange={v => setDrafts(prev => ({ ...prev, [key]: v }))} />}
                    {key === 'parliament_rulings' && <RulingsEditor value={data as RulingsData} onChange={v => setDrafts(prev => ({ ...prev, [key]: v }))} />}
                    {(key === 'hero_timeline' || key === 'hero_parliament' || key === 'hero_speaker_record' || key === 'hero_themes' || key === 'hero_ask' || key === 'hero_search' || key === 'hero_media' || key === 'hero_archives') && <PageHeroEditor value={data as PageHeroData} onChange={v => setDrafts(prev => ({ ...prev, [key]: v }))} />}
                    {key === 'archive_collections' && <CollectionsEditor value={data as CollectionsData} onChange={v => setDrafts(prev => ({ ...prev, [key]: v }))} />}
                    {key === 'core_themes' && <CoreThemesEditor value={data as CoreThemesData} onChange={v => setDrafts(prev => ({ ...prev, [key]: v }))} />}
                    {key === 'media_cards' && <MediaCardsEditor value={data as MediaCardsData} onChange={v => setDrafts(prev => ({ ...prev, [key]: v }))} />}
                    {key === 'media_socials' && <MediaSocialsEditor value={data as MediaSocialsData} onChange={v => setDrafts(prev => ({ ...prev, [key]: v }))} />}
                    {key === 'site_footer' && <FooterEditor value={data as FooterData} onChange={v => setDrafts(prev => ({ ...prev, [key]: v }))} />}
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
