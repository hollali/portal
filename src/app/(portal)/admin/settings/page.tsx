'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Save } from 'lucide-react'
import { jsonFetch } from '@/lib/jsonFetch'
import { PageHeader, Button, Field, Input, useToast } from '@/components/ui/kit'

const NUMERIC_FIELDS: { name: string; label: string; min: number; max?: number; hint?: string }[] = [
  { name: 'defaultItemsPerPage', label: 'Items Per Page (public)', min: 5, max: 100 },
  { name: 'searchResultsPerPage', label: 'Search Results Per Page', min: 5, max: 100 },
  { name: 'maxItemsPerRun', label: 'Max Items Per Collection Run', min: 1 },
]

export default function SettingsPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const { toast } = useToast()

  useEffect(() => {
    jsonFetch<{ role?: string }>('/api/me').then(d => {
      if (d?.role !== 'admin') {
        router.push('/admin')
        return
      }
      setIsAdmin(true)
    })
  }, [router])

  useEffect(() => {
    if (!isAdmin) return
    jsonFetch<{ settings?: Record<string, string> }>('/api/admin/settings').then(d => {
      if (d) {
        setSettings(d.settings || {})
        setLoaded(true)
      }
    })
  }, [isAdmin])

  const update = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    // Clear the error as soon as the user edits the offending field.
    setFieldErrors(prev => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  /** The API reports field-level problems in a `fields` map; surface them on the inputs. */
  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    for (const f of NUMERIC_FIELDS) {
      const raw = settings[f.name]
      if (raw === undefined || raw === '') continue
      const n = Number(raw)
      if (!Number.isFinite(n)) {
        errs[f.name] = 'Enter a number.'
      } else if (n < f.min) {
        errs[f.name] = `Must be at least ${f.min}.`
      } else if (f.max !== undefined && n > f.max) {
        errs[f.name] = `Must be at most ${f.max}.`
      }
    }
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) {
      toast('Check the highlighted fields.', { tone: 'error' })
      return false
    }
    return true
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    const body: Record<string, string> = {}
    for (const f of [...NUMERIC_FIELDS.map(f => f.name), 'portalName', 'defaultSource']) {
      if (settings[f] !== undefined) body[f] = settings[f]
    }
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: body }),
    })
    const d = await res.json().catch(() => ({}))
    setSaving(false)
    if (res.ok) {
      toast('Settings saved.', { tone: 'success' })
      setSettings(d.settings || body)
      setFieldErrors({})
    } else {
      if (d?.fields && typeof d.fields === 'object') setFieldErrors(d.fields)
      toast(d.error || 'Failed to save settings.', { tone: 'error' })
    }
  }

  if (!isAdmin) {
    return <div className="flex items-center justify-center min-h-[50vh]">Checking access…</div>
  }

  return (
    <div className="page-enter">
      <PageHeader
        title="System Settings"
        icon={<Settings size={22} />}
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Settings' }]}
        description="Configure portal-wide settings. Changes apply immediately."
      />

      {!loaded ? (
        <div className="card p-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading settings…</div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-6" noValidate>
          <fieldset className="card p-6">
            <legend className="text-base font-bold mb-4">General</legend>
            <div className="grid grid-cols-1 gap-4">
              <Field label="Portal Name" hint="Displayed in the sidebar and page titles.">
                <Input
                  name="portalName"
                  value={settings.portalName || ''}
                  onChange={e => update('portalName', e.target.value)}
                />
              </Field>
              {NUMERIC_FIELDS.slice(0, 2).map(f => (
                <Field key={f.name} label={f.label} error={fieldErrors[f.name]}>
                  <Input
                    name={f.name}
                    type="number"
                    min={f.min}
                    max={f.max}
                    value={settings[f.name] || '20'}
                    onChange={e => update(f.name, e.target.value)}
                  />
                </Field>
              ))}
            </div>
          </fieldset>

          <fieldset className="card p-6">
            <legend className="text-base font-bold mb-4">Collection</legend>
            <div className="grid grid-cols-1 gap-4">
              <Field label="Max Items Per Collection Run" error={fieldErrors.maxItemsPerRun}>
                <Input
                  name="maxItemsPerRun"
                  type="number"
                  min={1}
                  value={settings.maxItemsPerRun || '100'}
                  onChange={e => update('maxItemsPerRun', e.target.value)}
                />
              </Field>
              <Field label="Default Source Tag">
                <Input
                  name="defaultSource"
                  value={settings.defaultSource || ''}
                  onChange={e => update('defaultSource', e.target.value)}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="card p-6">
            <legend className="text-base font-bold mb-4">Security</legend>
            <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              <p className="mb-1"><strong>Session duration:</strong> 7 days (fixed)</p>
              <p>Passwords are hashed with bcrypt (cost 12). Admin actions are recorded in the audit log.</p>
            </div>
          </fieldset>

          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={saving} iconLeft={<Save size={14} aria-hidden />}>
              Save Settings
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
