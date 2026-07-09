'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { localToMediaUrl, getMediaUrl } from '@/lib/media'
import { Image, Video, Newspaper, Headphones, Database, Globe } from 'lucide-react'

interface Stats {
  images: number; videos: number; news: number; audio: number; total: number; sources: Record<string, number>
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recent, setRecent] = useState<{ images: any[], videos: any[], news: any[], audio: any[] }>({ images: [], videos: [], news: [], audio: [] })
  const [errored, setErrored] = useState<Set<number>>(new Set())
  const [animCount, setAnimCount] = useState(false)

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats)
    Promise.all([
      fetch('/api/images?perPage=8').then(r => r.json()),
      fetch('/api/videos?perPage=8').then(r => r.json()),
      fetch('/api/news?perPage=8').then(r => r.json()),
      fetch('/api/audio?perPage=8').then(r => r.json()),
    ]).then(([i, v, n, a]) => setRecent({ images: i.items, videos: v.items, news: n.items, audio: a.items }))
  }, [])

  useEffect(() => {
    if (stats) {
      const timeout = setTimeout(() => setAnimCount(true), 300)
      return () => clearTimeout(timeout)
    }
  }, [stats])

  if (!stats) return <div>Loading...</div>

  const statCards = [
    { label: 'Images', count: stats.images, href: '/images', color: '#3b82f6', icon: Image },
    { label: 'Videos', count: stats.videos, href: '/videos', color: '#22c55e', icon: Video },
    { label: 'News', count: stats.news, href: '/news', color: '#f59e0b', icon: Newspaper },
    { label: 'Audio', count: stats.audio, href: '/audio', color: '#ef4444', icon: Headphones },
  ]

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {statCards.map((c, i) => (
          <Link key={c.label} href={c.href} style={{ textDecoration: 'none' }}>
            <div className="stat-card stagger-item" style={{ position: 'relative', overflow: 'hidden' }}>
              <c.icon
                size={32}
                style={{
                  position: 'absolute',
                  top: '0.75rem',
                  right: '0.75rem',
                  opacity: 0.12,
                  color: c.color,
                  display: 'none',
                }}
                className="show-sm-icon"
              />
              <div
                className={`stat-count${animCount ? ' animate' : ''}`}
                style={{ fontSize: '2rem', fontWeight: 700, color: c.color }}
              >
                {c.count.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{c.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="stack-sm" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <div className="card stagger-item">
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={18} style={{ color: 'var(--primary)' }} /> Source Breakdown
          </h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Source</th><th>Count</th><th>%</th></tr>
              </thead>
              <tbody>
                {Object.entries(stats.sources).slice(0, 15).map(([src, count]) => (
                  <tr key={src}>
                    <td>{src}</td>
                    <td>{count.toLocaleString()}</td>
                    <td>{stats.total ? Math.round(count / stats.total * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card stagger-item">
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={18} style={{ color: 'var(--primary)' }} /> Total Items
          </h2>
          <div style={{ fontSize: '3rem', fontWeight: 700, textAlign: 'center', padding: '2rem 0', color: 'var(--primary)' }}>
            {stats.total.toLocaleString()}
          </div>
          <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
            collected items across all sources
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Recent Items</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
        {recent.images.slice(0, 4).map((img: any) => {
          const src = (!errored.has(img.id) && localToMediaUrl(img.localPath)) || img.url
          return (
            <Link key={img.id} href={`/images/${img.id}`} style={{ textDecoration: 'none' }}>
              <div className="card stagger-item" style={{ padding: '0.75rem' }}>
                <div style={{ width: '100%', height: '140px', overflow: 'hidden', borderRadius: '0.25rem', marginBottom: '0.5rem', background: 'var(--background)' }}>
                  {src ? (
                    <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={() => setErrored(prev => new Set(prev).add(img.id))} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.75rem' }}>No preview</div>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{img.source}</span>
                  <span>{img.collectedAt?.slice(0, 10)}</span>
                </div>
                {img.faceMatch && <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>Face match</div>}
              </div>
            </Link>
          )
        })}
        {recent.videos.slice(0, 4).map((v: any) => (
          <Link key={v.id} href={`/videos/${v.id}`} style={{ textDecoration: 'none' }}>
            <div className="card stagger-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Video size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
                <div style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.title || `Video #${v.id}`}
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: '1.25rem' }}>
                {v.source} &middot; {v.channel} &middot; {v.collectedAt?.slice(0, 10)}
              </div>
            </div>
          </Link>
        ))}
        {recent.news.slice(0, 4).map((n: any) => (
          <Link key={n.id} href={`/news/${n.id}`} style={{ textDecoration: 'none' }}>
            <div className="card stagger-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Newspaper size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                <div style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {n.title || `News #${n.id}`}
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: '1.25rem' }}>
                {n.sourceName} &middot; {n.date?.slice(0, 10)}
              </div>
            </div>
          </Link>
        ))}
        {recent.audio.slice(0, 4).map((a: any) => (
          <Link key={a.id} href={`/audio/${a.id}`} style={{ textDecoration: 'none' }}>
            <div className="card stagger-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Headphones size={14} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                <div style={{ fontSize: '0.875rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.title || `Audio #${a.id}`}
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: '1.25rem' }}>
                {a.source} &middot; {a.artist} &middot; {a.collectedAt?.slice(0, 10)}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
