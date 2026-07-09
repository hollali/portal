'use client'

import { useEffect, useState, JSX } from 'react'
import Link from 'next/link'

interface ListPageProps {
  type: 'images' | 'videos' | 'news' | 'audio'
  apiPath: string
  title: string
  columns: { key: string; label: string; sortable?: boolean; render?: (item: any) => string | JSX.Element }[]
  searchPlaceholder?: string
  detailPrefix: string
}

export default function ListPage({ type, apiPath, title, columns, searchPlaceholder, detailPrefix }: ListPageProps) {
  const [data, setData] = useState<any>({ items: [], total: 0, page: 1, sources: [] })
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('')
  const [sort, setSort] = useState('id')
  const [dir, setDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [exportFormat, setExportFormat] = useState('')

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), sort, dir, perPage: '24' })
    if (query) params.set('q', query)
    if (source) params.set('source', source)
    fetch(`${apiPath}?${params}`).then(r => r.json()).then(setData)
  }, [page, sort, dir, query, source, apiPath])

  useEffect(() => {
    if (exportFormat) {
      const params = new URLSearchParams({ page: String(page), sort, dir, perPage: '10000' })
      if (query) params.set('q', query)
      if (source) params.set('source', source)
      fetch(`${apiPath}?${params}`)
        .then(r => r.json())
        .then(d => {
          const blob = new Blob([JSON.stringify(d.items, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url; a.download = `${type}_${new Date().toISOString().slice(0, 10)}.json`; a.click()
          URL.revokeObjectURL(url)
          setExportFormat('')
        })
    }
  }, [exportFormat, apiPath, page, sort, dir, query, source, type])

  const handleSort = (key: string) => {
    if (sort === key) setDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSort(key); setDir('asc') }
  }

  const totalPages = Math.ceil(data.total / 24)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{title} ({data.total.toLocaleString()})</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setExportFormat('json')} className="btn-pulse" style={{ fontSize: '0.875rem', cursor: 'pointer', background: 'none', border: '1px solid var(--border)', borderRadius: '0.375rem', padding: '0.375rem 0.75rem', color: 'var(--foreground)' }}>
            Export JSON
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          placeholder={searchPlaceholder || `Search ${title.toLowerCase()}...`}
          value={query}
          onChange={e => { setQuery(e.target.value); setPage(1) }}
          style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: '0.375rem', background: 'var(--card)', color: 'var(--foreground)', flex: 1, minWidth: '200px', transition: 'border-color 0.2s, box-shadow 0.2s' }}
          className="full-sm"
          onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-glow)' }}
          onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
        />
        <select value={source} onChange={e => { setSource(e.target.value); setPage(1) }} style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: '0.375rem', background: 'var(--card)', color: 'var(--foreground)', transition: 'border-color 0.2s' }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--primary)'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}>
          <option value="">All sources</option>
          {data.sources.map((s: string) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key}>
                  {col.sortable ? (
                    <button onClick={() => handleSort(col.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: sort === col.key ? 'var(--primary)' : 'var(--muted)', padding: 0 }}>
                      {col.label} {sort === col.key ? (dir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  ) : col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.items.map((item: any, idx: number) => (
              <tr key={item.id} className="stagger-item" style={{ animationDelay: `${(idx % 10) * 0.03}s` }}>
                {columns.map(col => (
                  <td key={col.key}>
                    {col.key === 'id' ? (
                      <Link href={`${detailPrefix}${item.id}`} style={{ fontWeight: 600 }}>{item.id}</Link>
                    ) : col.render ? (
                      col.render(item)
                    ) : (
                      String(item[col.key] || '')
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.5rem' }}>
          {page > 1 && <a onClick={() => setPage(p => p - 1)} style={{ cursor: 'pointer' }}>Prev</a>}
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
            const p = i + 1
            return p === page
              ? <span key={p} className="current">{p}</span>
              : <a key={p} onClick={() => setPage(p)} style={{ cursor: 'pointer' }}>{p}</a>
          })}
          {page < totalPages && <a onClick={() => setPage(p => p + 1)} style={{ cursor: 'pointer' }}>Next</a>}
        </div>
      )}
    </div>
  )
}
