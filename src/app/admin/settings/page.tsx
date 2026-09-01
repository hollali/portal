'use client'

import { useEffect, useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, Save } from 'lucide-react'
import { Toast } from '@/components/ui'

export default function SettingsPage() {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (d.role !== 'admin') {
        router.push('/login')
        return
      }
      setIsAdmin(true)
    })
  }, [router])

  useEffect(() => {
    if (!isAdmin) return
    fetch('/api/admin/settings').then(r => r.json()).then(d => {
      setSettings(d.settings || {})
      setLoaded(true)
    })
  }, [isAdmin])

  const update = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const form = e.currentTarget
    const body: Record<string, string> = {}
    for (const input of Array.from(form.querySelectorAll<HTMLInputElement>('input[name], textarea[name]'))) {
      body[input.name] = input.value
    }
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: body }),
    })
    const d = await res.json()
    setSaving(false)
    if (res.ok) {
      setToast({ message: 'Settings saved' })
      setSettings(d.settings || body)
    } else {
      setToast({ message: d.error || 'Failed to save settings', type: 'error' })
    }
  }

  if (!isAdmin) {
    return <div className="flex items-center justify-center min-h-[50vh]">Checking access...</div>
  }

  return (
    <div className="page-enter">
      <div className="flex items-center gap-2 mb-1">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Settings size={20} style={{ color: 'var(--primary)' }} /> System Settings
        </h1>
      </div>
      <p className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
        Configure portal-wide settings. Changes apply immediately.
      </p>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {!loaded ? (
        <div className="card p-6 text-sm" style={{ color: 'var(--muted-foreground)' }}>Loading settings...</div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
          <div className="card p-6">
            <h2 className="text-base font-bold mb-4">General</h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Portal Name</label>
                <input name="portalName" value={settings.portalName || ''} onChange={e => update('portalName', e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
                <p className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>Displayed in the sidebar and page titles.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Items Per Page (public)</label>
                <input name="defaultItemsPerPage" type="number" min={5} max={100} value={settings.defaultItemsPerPage || '20'}
                  onChange={e => update('defaultItemsPerPage', e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Search Results Per Page</label>
                <input name="searchResultsPerPage" type="number" min={5} max={100} value={settings.searchResultsPerPage || '20'}
                  onChange={e => update('searchResultsPerPage', e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-base font-bold mb-4">Collection</h2>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Max Items Per Collection Run</label>
                <input name="maxItemsPerRun" type="number" min={1} value={settings.maxItemsPerRun || '100'}
                  onChange={e => update('maxItemsPerRun', e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Default Source Tag</label>
                <input name="defaultSource" value={settings.defaultSource || ''} onChange={e => update('defaultSource', e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-base font-bold mb-4">Security</h2>
            <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
              <p className="mb-1"><strong>Session duration:</strong> 7 days (fixed)</p>
              <p>Passwords are hashed with bcrypt (cost 12). Admin actions are recorded in the audit log.</p>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ background: 'var(--primary)', color: 'var(--primary-fg)', cursor: saving ? 'not-allowed' : 'pointer', border: 'none' }}>
              <Save size={14} /> {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
