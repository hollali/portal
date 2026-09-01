'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, RefreshCw, HardDrive, Database, AlertTriangle, CheckCircle2, FileWarning, EyeOff } from 'lucide-react'
import { AnimBtn, SkeletonTable, EmptyState } from '@/components/ui'

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
  const [isAdmin, setIsAdmin] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (!d.role || !['admin', 'editor', 'viewer'].includes(d.role)) {
        router.push('/login')
        return
      }
      setIsAdmin(true)
    })
  }, [router])

  const fetchHealth = useCallback(async () => {
    const res = await fetch('/api/admin/health')
    if (res.ok) {
      const d = await res.json()
      setData(d)
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    if (isAdmin) fetchHealth()
  }, [isAdmin, fetchHealth])

  const refresh = () => {
    setRefreshing(true)
    fetchHealth()
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <SkeletonTable rows={5} cols={4} />
      </div>
    )
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <SkeletonTable rows={5} cols={4} />
      </div>
    )
  }

  if (!data) {
    return <EmptyState message="Could not load health data." icon={<Activity size={48} />} />
  }

  const overallHealthy = data.totalIssues === 0

  return (
    <div className="page-enter">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold mb-1 flex items-center gap-2">
            <Activity size={20} style={{ color: overallHealthy ? 'var(--success)' : 'var(--warning)' }} /> System Health
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Media integrity, storage, and database overview. Generated {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>
        <AnimBtn onClick={refresh} disabled={refreshing} style={{ padding: '0.5rem 1rem', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--primary)', fontWeight: 600, fontSize: '0.875rem', gap: '0.375rem' }}>
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </AnimBtn>
      </div>

      {/* Overall status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {overallHealthy ? <CheckCircle2 size={32} style={{ color: 'var(--success)' }} /> : <AlertTriangle size={32} style={{ color: 'var(--warning)' }} />}
          <div>
            <div className="text-xl font-bold">{overallHealthy ? 'Healthy' : 'Issues found'}</div>
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{data.totalIssues} problem record(s) across all types</div>
          </div>
        </div>
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <HardDrive size={32} style={{ color: 'var(--primary)' }} />
          <div>
            <div className="text-xl font-bold">{data.storage.localFileSizeFormatted}</div>
            <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{data.storage.localFileCount.toLocaleString()} local files</div>
          </div>
        </div>
        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Database size={32} style={{ color: 'var(--primary)' }} />
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
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold capitalize">{t.type}</h3>
                <span className="text-xs font-semibold px-2 py-1 rounded-full"
                  style={{ background: ok ? 'rgba(var(--success-rgb,16,185,129),0.15)' : 'rgba(var(--danger-rgb,239,68,68),0.15)', color: ok ? 'var(--success)' : 'var(--danger)' }}>
                  {pct}% {ok ? 'ok' : 'issues'}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between"><span style={{ color: 'var(--muted-foreground)' }}>Total records</span><span className="font-semibold">{t.total.toLocaleString()}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--muted-foreground)' }}>With local files</span><span>{t.withLocal}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--muted-foreground)' }}>URL only</span><span>{t.withUrlOnly}</span></div>
                <div className="flex justify-between"><span style={{ color: 'var(--muted-foreground)' }}>Missing local files</span>
                  <span style={{ color: t.missingLocalCount > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                    {t.missingLocalCount > 0 ? <span className="inline-flex items-center gap-1"><FileWarning size={13} /> {t.missingLocalCount}</span> : 0}
                  </span>
                </div>
                <div className="flex justify-between"><span style={{ color: 'var(--muted-foreground)' }}>No media at all</span>
                  <span style={{ color: t.noMediaCount > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
                    {t.noMediaCount > 0 ? <span className="inline-flex items-center gap-1"><EyeOff size={13} /> {t.noMediaCount}</span> : 0}
                  </span>
                </div>
              </div>
              {(t.missingLocalCount > 0 || t.noMediaCount > 0) && (
                <details className="mt-3">
                  <summary className="text-xs cursor-pointer" style={{ color: 'var(--primary)' }}>View problem IDs</summary>
                  <div className="mt-2 max-h-40 overflow-auto rounded bg-(--background) p-2 text-xs" style={{ background: 'var(--background)' }}>
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
          <thead>
            <tr><th>Table</th><th>Count</th></tr>
          </thead>
          <tbody>
            <tr><td className="capitalize">Images</td><td>{data.dbStats.images.toLocaleString()}</td></tr>
            <tr><td className="capitalize">Videos</td><td>{data.dbStats.videos.toLocaleString()}</td></tr>
            <tr><td className="capitalize">News</td><td>{data.dbStats.news.toLocaleString()}</td></tr>
            <tr><td className="capitalize">Audio</td><td>{data.dbStats.audio.toLocaleString()}</td></tr>
            <tr><td className="capitalize">Users</td><td>{data.dbStats.users.toLocaleString()}</td></tr>
            <tr><td className="capitalize">Audit logs</td><td>{data.dbStats.auditLogs.toLocaleString()}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
