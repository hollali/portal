'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, RefreshCw, HardDrive, Database, AlertTriangle, CheckCircle2, FileWarning, EyeOff } from 'lucide-react'
import { SkeletonTable, EmptyState } from '@/components/ui'
import { PageHeader, Button, Badge } from '@/components/ui/kit'
import { jsonFetch } from '@/lib/jsonFetch'

interface TypeHealth {
  type: string
  total: number
  withLocal: number
  withUrlOnly: number
  noMediaCount: number
  missingLocalCount: number
  missingLocal: { id: number; localPath: string }[]
  noMedia: { id: number }[]
}

interface HealthData {
  types: TypeHealth[]
  storage: { localFileCount: number; localFileSizeFormatted: string; publicDir: string }
  dbStats: { images: number; videos: number; news: number; audio: number; users: number; auditLogs: number; total: number }
  totalIssues: number
  generatedAt: string
}

export default function HealthPage() {
  const router = useRouter()
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  // This gate admits admin OR editor, so the old `isAdmin` name was a lie.
  const [authorized, setAuthorized] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    jsonFetch<{ role?: string }>('/api/me').then(d => {
      if (d?.role !== 'admin' && d?.role !== 'editor') {
        router.push('/admin')
        return
      }
      setAuthorized(true)
    })
  }, [router])

  const fetchHealth = useCallback(async (showSpinner = true) => {
    if (showSpinner) setRefreshing(true)
    const res = await fetch('/api/admin/health')
    if (res.ok) {
      const d = await res.json().catch(() => null)
      if (d) {
        setData(d)
        setLoadFailed(false)
      } else {
        setLoadFailed(true)
      }
    } else {
      setLoadFailed(true)
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    if (!authorized) return
    const id = requestAnimationFrame(() => fetchHealth())
    return () => cancelAnimationFrame(id)
  }, [authorized, fetchHealth])

  if (!authorized || (loading && !data)) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <SkeletonTable rows={5} cols={4} />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <EmptyState message="Could not load health data." icon={<Activity size={48} />} />
        <Button variant="primary" onClick={() => fetchHealth(true)} style={{ marginTop: '1rem' }}>
          Retry
        </Button>
      </div>
    )
  }

  const overallHealthy = data.totalIssues === 0

  return (
    <div className="page-enter">
      <PageHeader
        title="System Health"
        icon={<Activity size={22} style={{ color: overallHealthy ? 'var(--success)' : 'var(--warning)' }} />}
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Health' }]}
        description={`Media integrity, storage, and database overview. Generated ${new Date(data.generatedAt).toLocaleString()}`}
        actions={
          <Button
            variant="secondary"
            onClick={() => fetchHealth(true)}
            loading={refreshing}
            iconLeft={<RefreshCw size={14} aria-hidden />}
          >
            Refresh
          </Button>
        }
      />

      {loadFailed && (
        <div role="alert" className="card mb-4" style={{ padding: '0.75rem 1rem', borderColor: 'var(--warning)', color: 'var(--warning)' }}>
          Showing the last successful reading — the latest refresh failed.
        </div>
      )}

      {/* Overall status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {overallHealthy ? <CheckCircle2 size={32} style={{ color: 'var(--success)' }} aria-hidden /> : <AlertTriangle size={32} style={{ color: 'var(--warning)' }} aria-hidden />}
          <div>
            <div className="text-xl font-bold">{overallHealthy ? 'Healthy' : 'Issues found'}</div>
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{data.totalIssues} problem record(s) across all types</div>
          </div>
        </div>
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <HardDrive size={32} style={{ color: 'var(--primary)' }} aria-hidden />
          <div>
            <div className="text-xl font-bold">{data.storage.localFileSizeFormatted}</div>
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{data.storage.localFileCount.toLocaleString()} local files</div>
          </div>
        </div>
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Database size={32} style={{ color: 'var(--primary)' }} aria-hidden />
          <div>
            <div className="text-xl font-bold">{data.dbStats.total.toLocaleString()}</div>
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{data.dbStats.users} users · {data.dbStats.auditLogs} audit entries</div>
          </div>
        </div>
      </div>

      {/* Per-type health */}
      <h2 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--muted-foreground)' }}>Media Health by Type</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {data.types.map(t => {
          const ok = t.missingLocalCount === 0 && t.noMediaCount === 0
          const pct = t.total === 0 ? 100 : Math.round(((t.total - (t.missingLocalCount + t.noMediaCount)) / t.total) * 100)
          return (
            <div key={t.type} className="card" style={{ padding: '1rem' }}>
              <div className="flex items-center justify-between mb-3 gap-2">
                <h3 className="text-sm font-semibold capitalize">{t.type}</h3>
                <Badge tone={ok ? 'success' : 'danger'}>{pct}% {ok ? 'ok' : 'issues'}</Badge>
              </div>
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between"><span style={{ color: 'var(--muted-foreground)' }}>Total records</span><span className="font-semibold">{t.total.toLocaleString()}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--muted-foreground)' }}>With local files</span><span>{t.withLocal}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--muted-foreground)' }}>URL only</span><span>{t.withUrlOnly}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--muted-foreground)' }}>Missing local files</span>
                  <span style={{ color: t.missingLocalCount > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                    {t.missingLocalCount > 0 ? <span className="inline-flex items-center gap-1"><FileWarning size={13} aria-hidden /> {t.missingLocalCount}</span> : 0}
                  </span>
                </div>
                <div className="flex justify-between"><span style={{ color: 'var(--muted-foreground)' }}>No media at all</span>
                  <span style={{ color: t.noMediaCount > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                    {t.noMediaCount > 0 ? <span className="inline-flex items-center gap-1"><EyeOff size={13} aria-hidden /> {t.noMediaCount}</span> : 0}
                  </span>
                </div>
              </div>
              {(t.missingLocalCount > 0 || t.noMediaCount > 0) && (
                <details className="mt-3">
                  <summary className="text-xs cursor-pointer" style={{ color: 'var(--primary)' }}>
                    View problem IDs for {t.type}
                  </summary>
                  <div className="mt-2 max-h-40 overflow-auto rounded p-2 text-xs" style={{ background: 'var(--background)' }}>
                    {t.noMedia.length > 0 && <div className="mb-1">No media: {t.noMedia.map(n => `#${n.id}`).join(', ') || '-'}</div>}
                    {t.missingLocal.length > 0 && <div>Missing files: {t.missingLocal.map(m => `#${m.id}`).join(', ') || '-'}</div>}
                  </div>
                </details>
              )}
            </div>
          )
        })}
      </div>

      {/* DB stats */}
      <h2 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--muted-foreground)' }}>Database Summary</h2>
      <div className="card overflow-x-auto mb-6">
        <table>
          <caption className="sr-only">Row counts per database table</caption>
          <thead>
            <tr>
              <th scope="col">Table</th>
              <th scope="col">Count</th>
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row" className="capitalize font-normal text-left">Images</th><td>{data.dbStats.images.toLocaleString()}</td></tr>
            <tr><th scope="row" className="capitalize font-normal text-left">Videos</th><td>{data.dbStats.videos.toLocaleString()}</td></tr>
            <tr><th scope="row" className="capitalize font-normal text-left">News</th><td>{data.dbStats.news.toLocaleString()}</td></tr>
            <tr><th scope="row" className="capitalize font-normal text-left">Audio</th><td>{data.dbStats.audio.toLocaleString()}</td></tr>
            <tr><th scope="row" className="capitalize font-normal text-left">Users</th><td>{data.dbStats.users.toLocaleString()}</td></tr>
            <tr><th scope="row" className="capitalize font-normal text-left">Audit logs</th><td>{data.dbStats.auditLogs.toLocaleString()}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
