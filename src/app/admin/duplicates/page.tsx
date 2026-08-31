'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { localToMediaUrl } from '@/lib/media'
import { Image } from 'lucide-react'

export default function DuplicatesPage() {
  const [data, setData] = useState<any>(null)
  const [page, setPage] = useState(1)
  const [errored, setErrored] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetch(`/api/admin/duplicates?page=${page}`).then(r => r.json()).then(setData)
  }, [page])

  if (!data) return <div>Loading...</div>

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Image size={22} style={{ color: 'var(--primary)' }} />
          Duplicate Images
        </span>
      </h1>
      <div style={{ color: 'var(--muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        {data.totalGroups} group{data.totalGroups !== 1 ? 's' : ''} with {data.totalDuplicates} duplicate{data.totalDuplicates !== 1 ? 's' : ''}
      </div>

      {data.groups.map((group: any[], i: number) => (
        <div key={i} className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            Group {i + 1} — {group.length} items
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Preview</th><th>ID</th><th>Source</th><th>URL</th><th>Collected</th></tr>
              </thead>
              <tbody>
                {group.map((img: any) => {
                  const src = (!errored.has(img.id) && localToMediaUrl(img.localPath)) || img.url
                  return (
                    <tr key={img.id}>
                      <td>
                        {src ? (
                          <img
                            src={src}
                            alt=""
                            style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '0.25rem', display: 'block' }}
                            onError={() => setErrored(prev => new Set(prev).add(img.id))}
                          />
                        ) : (
                          <div style={{ width: '60px', height: '40px', background: 'var(--background)', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '0.65rem' }}>
                            No img
                          </div>
                        )}
                      </td>
                      <td><Link href={`/images/${img.id}`} style={{ fontWeight: 600 }}>{img.id}</Link></td>
                      <td>{img.source}</td>
                      <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <a href={img.url} target="_blank" rel="noopener noreferrer">{img.url}</a>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>{img.collectedAt?.slice(0, 10)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {data.totalGroups > 20 && (
        <div className="pagination" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.5rem' }}>
          {page > 1 && <a onClick={() => setPage(p => p - 1)} style={{ cursor: 'pointer' }}>Prev</a>}
          <span className="current">{page}</span>
          {page < Math.ceil(data.totalGroups / 20) && <a onClick={() => setPage(p => p + 1)} style={{ cursor: 'pointer' }}>Next</a>}
        </div>
      )}
    </div>
  )
}
