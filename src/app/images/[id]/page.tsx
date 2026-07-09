'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { localToMediaUrl } from '@/lib/media'

export default function ImageDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [item, setItem] = useState<any>(null)
  const [imgError, setImgError] = useState(false)

  useEffect(() => {
    fetch(`/api/images/${id}`).then(r => r.json()).then(setItem)
  }, [id])

  if (!item) return <div>Loading...</div>
  if (item.error) return <div>Not found</div>

  const mediaUrl = localToMediaUrl(item.localPath)
  const src = (!imgError && mediaUrl) ? mediaUrl : item.url

  return (
    <div>
      <Link href="/images" style={{ fontSize: '0.875rem', marginBottom: '1rem', display: 'inline-block' }}>&larr; Back to Images</Link>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Image #{item.id}</h1>

      <div className="card grid-2-sm" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div>
          {src ? (
            <img
              src={src}
              alt=""
              style={{ maxWidth: '100%', maxHeight: '500px', borderRadius: '0.375rem', objectFit: 'contain' }}
              onError={() => setImgError(true)}
            />
          ) : (
            <div style={{ width: '100%', height: '300px', background: 'var(--background)', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
              No preview available
            </div>
          )}
          {item.url && mediaUrl && (
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem' }}>
              {mediaUrl && <a href={mediaUrl} download style={{ fontSize: '0.875rem' }}>Download &darr;</a>}
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.875rem' }}>Open source URL &rarr;</a>
            </div>
          )}
        </div>
        <div>
          <div className="table-wrap"><table>
            <tbody>
              {Object.entries(item).filter(([k]) => k !== 'id').map(([key, val]) => (
                <tr key={key}>
                  <th style={{ whiteSpace: 'nowrap', textTransform: 'capitalize', paddingRight: '1rem' }}>
                    {key.replace(/([A-Z])/g, ' $1')}
                  </th>
                  <td style={{ wordBreak: 'break-all' }}>
                    {val === null || val === undefined ? '-' : String(val)}
                  </td>
                </tr>
              ))}
              </tbody>
            </table></div>
          </div>
      </div>
    </div>
  )
}
