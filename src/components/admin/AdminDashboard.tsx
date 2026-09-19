'use client'

import { useEffect, useState } from 'react'
import { Image as ImageIcon, Video, Newspaper, Headphones } from 'lucide-react'
import { AnimBtn, SkeletonTable } from '@/components/ui'
import type { MediaType } from '@/components/admin/MediaManager'

interface SourceCount {
  source: string
  count: number
}

interface TrendPoint {
  date: string
  count: number
}

interface StatsData {
  counts: {
    images: number
    videos: number
    news: number
    audio: number
    total: number
  }
  images: { withFaces: number; faceMatches: number }
  sources: {
    images: SourceCount[]
    videos: SourceCount[]
    news: SourceCount[]
    audio: SourceCount[]
  }
  recent: {
    images: Array<{ id: number; title?: string | null; url?: string | null; source?: string | null }>
    videos: Array<{ id: number; title?: string | null; url?: string | null; source?: string | null }>
    news: Array<{ id: number; title?: string | null; url?: string | null; source?: string | null }>
    audio: Array<{ id: number; title?: string | null; url?: string | null; source?: string | null }>
  }
  trend: {
    images: TrendPoint[]
    videos: TrendPoint[]
    news: TrendPoint[]
    audio: TrendPoint[]
    labels: string[]
  }
  activity: { username: string; count: number }[]
}

const TABS = [
  { tab: 'images', label: 'Images', icon: ImageIcon },
  { tab: 'videos', label: 'Videos', icon: Video },
  { tab: 'news', label: 'News', icon: Newspaper },
  { tab: 'audio', label: 'Audio', icon: Headphones },
] as const

type Tab = (typeof TABS)[number]['tab']

export default function AdminDashboard({ onBrowse }: { onBrowse: (tab: MediaType) => void }) {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [error, setError] = useState(false)

  const load = () => {
    Promise.resolve()
      .then(() => fetch('/api/admin/stats'))
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d) setStats(d)
        else setError(true)
      })
      .catch(() => setError(true))
  }

  useEffect(() => {
    load()
  }, [])

  if (error && !stats) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
        <p style={{ marginBottom: '1rem' }}>Could not load dashboard stats.</p>
        <button onClick={load}
          style={{ background: 'var(--primary)', border: 'none', color: 'var(--primary-fg)', borderRadius: 8, padding: '0.5rem 1.25rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    )
  }

  if (!stats) return <SkeletonTable rows={6} cols={4} />

  const goBrowse = (tab: Tab) => onBrowse(tab)

  const allTrendCounts = stats.trend
    ? [...stats.trend.images, ...stats.trend.videos, ...stats.trend.news, ...stats.trend.audio].map(t => t.count)
    : []
  const trendMax = Math.max(1, ...allTrendCounts)

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {TABS.map(({ tab, label, icon: Icon }) => (
          <button
            key={tab}
            onClick={() => goBrowse(tab)}
            className="card text-left cursor-pointer hover:shadow-lg transition-all"
            style={{ padding: '1rem' }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl font-bold">{stats.counts[tab].toLocaleString()}</span>
              <span style={{ color: 'var(--primary)' }}>
                <Icon size={18} />
              </span>
            </div>
            <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
              {label}
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <StatCard label="Total Records" value={stats.counts.total} />
        <StatCard label="Images w/ Faces" value={stats.images.withFaces} />
        <StatCard label="Face Matches" value={stats.images.faceMatches} />
      </div>

      {stats.trend && (
        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Collection Activity (last 14 days)
          </h2>
          <div className="card" style={{ padding: '1rem' }}>
            <div className="flex flex-col gap-4">
              {(
                [
                  ['Images', stats.trend.images, 'var(--primary)'],
                  ['Videos', stats.trend.videos, 'var(--focus)'],
                  ['News', stats.trend.news, 'var(--success)'],
                  ['Audio', stats.trend.audio, '#f59e0b'],
                ] as [string, TrendPoint[], string][]
              ).map(([label, series, color]) => (
                <div key={label}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                      {label}
                    </span>
                    <span className="text-xs font-bold" style={{ color }}>
                      {series.reduce((a, b) => a + b.count, 0)}
                    </span>
                  </div>
                  <div className="flex items-end gap-0.5 h-10">
                    {series.map(p => (
                      <div
                        key={p.date}
                        title={`${p.date}: ${p.count}`}
                        style={{
                          flex: 1,
                          background: color,
                          borderRadius: '2px 2px 0 0',
                          height: `${Math.max(2, (p.count / trendMax) * 100)}%`,
                          opacity: p.count === 0 ? 0.15 : 1,
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-[10px] mt-1" style={{ color: 'var(--muted-foreground)' }}>
                <span>{stats.trend.labels[0]}</span>
                <span>{stats.trend.labels[Math.floor(stats.trend.labels.length / 2)]}</span>
                <span>{stats.trend.labels[stats.trend.labels.length - 1]}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {stats.activity && stats.activity.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--muted-foreground)' }}>
            Admin Activity (last 30 days)
          </h2>
          <div className="card" style={{ padding: '1rem' }}>
            <div className="flex flex-col gap-2">
              {stats.activity.map(a => (
                <div key={a.username} className="flex items-center gap-2 text-sm">
                  <span className="w-32 truncate font-medium">{a.username}</span>
                  <div className="flex-1">
                    <div className="h-2.5 rounded overflow-hidden" style={{ background: 'var(--muted)' }}>
                      <div
                        style={{
                          width: `${Math.min(100, (a.count / Math.max(1, stats.activity[0].count)) * 100)}%`,
                          height: '100%',
                          background: 'var(--primary)',
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                    {a.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <h2 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--muted-foreground)' }}>
        Top Sources
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {TABS.map(({ tab, label }) => {
          const list = stats.sources[tab]
          return (
            <div key={tab} className="card" style={{ padding: '1rem' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Top {label} Sources</h3>
                <AnimBtn
                  onClick={() => goBrowse(tab)}
                  style={{
                    fontSize: '0.7rem',
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    padding: '0.2rem 0.5rem',
                    color: 'var(--primary)',
                  }}
                >
                  Browse
                </AnimBtn>
              </div>
              {list.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  No data
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {list.map(s => (
                    <div key={s.source} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate">{s.source}</span>
                      <span className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                        {s.count}
                      </span>
                      <div className="w-16 rounded h-1.5 overflow-hidden" style={{ background: 'var(--muted)' }}>
                        <div
                          style={{
                            width: `${Math.min(100, (s.count / Math.max(1, list[0].count)) * 100)}%`,
                            height: '100%',
                            background: 'var(--primary)',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <h2 className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--muted-foreground)' }}>
        Recently Collected
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {TABS.map(({ tab, label }) => {
          const list = stats.recent[tab]
          return (
            <div key={tab} className="card" style={{ padding: '1rem' }}>
              <h3 className="text-sm font-semibold mb-3">Recent {label}</h3>
              {list.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  No data
                </p>
              ) : (
                <div className="flex flex-col divide-y" style={{ borderColor: 'var(--border)' }}>
                  {list.map(item => (
                    <button
                      key={item.id}
                      onClick={() => goBrowse(tab)}
                      className="flex items-center gap-2 py-2 text-left text-sm cursor-pointer hover:opacity-70"
                      style={{ background: 'none', border: 'none', color: 'var(--foreground)' }}
                    >
                      <span className="font-semibold text-xs" style={{ color: 'var(--muted-foreground)' }}>
                        #{item.id}
                      </span>
                      <span className="flex-1 truncate">
                        {item.title || item.url || item.source || 'Untitled'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="card"
      style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <div>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        <div className="text-xs font-medium uppercase tracking-wide mt-1" style={{ color: 'var(--muted-foreground)' }}>
          {label}
        </div>
      </div>
    </div>
  )
}