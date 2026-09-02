'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { localToMediaUrl, isYouTubeUrl, getYouTubeEmbedUrl } from '@/lib/media'

export default function VideoDetailPage() {
  const { id } = useParams<{ id: string }>()
  interface VideoDetail {
    id: number
    error?: string
    url: string | null
    localPath: string | null
    title: string | null
    [key: string]: unknown
  }
  const [item, setItem] = useState<VideoDetail | null>(null)
  const [remoteError, setRemoteError] = useState(false)

  useEffect(() => {
    fetch(`/api/videos/${id}`).then(r => r.json()).then(setItem)
  }, [id])

  if (!item) return <div>Loading...</div>
  if (item.error) return <div>Not found</div>

  const mediaUrl = localToMediaUrl(item.localPath)
  const ytEmbed = item.url && isYouTubeUrl(item.url) ? getYouTubeEmbedUrl(item.url) : null

  const getPlayer = () => {
    if (mediaUrl && !remoteError) {
      return (
        <video controls style={{ width: '100%', maxHeight: '500px', borderRadius: '0.375rem', background: '#000' }}>
          <source src={mediaUrl} />
        </video>
      )
    }
    if (ytEmbed) {
      return (
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
          <iframe
            src={ytEmbed}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none', borderRadius: '0.375rem' }}
            allowFullScreen
            allow="autoplay"
          />
        </div>
      )
    }
    if (item.url && !remoteError) {
      return (
        <video controls style={{ width: '100%', maxHeight: '500px', borderRadius: '0.375rem', background: '#000' }} onError={() => setRemoteError(true)}>
          <source src={item.url} />
        </video>
      )
    }
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
        No video available for playback
      </div>
    )
  }

  return (
    <div>
      <Link href="/videos" style={{ fontSize: '0.875rem', marginBottom: '1rem', display: 'inline-block' }}>&larr; Back to Videos</Link>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>{item.title || `Video #${item.id}`}</h1>

      <div className="card" style={{ marginBottom: '1.5rem', padding: 0 }}>
        {getPlayer()}
      </div>

      {item.url && (
        <div style={{ marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          <a href={item.url} target="_blank" rel="noopener noreferrer">Open source URL &rarr;</a>
        </div>
      )}

      <div className="card">
        <div className="table-wrap"><table>
          <tbody>
            {Object.entries(item).filter(([k]) => k !== 'id').map(([key, val]) => {
              let display = val === null || val === undefined ? '-' : String(val)
              if (key === 'duration' && val) {
                const m = Math.floor(Number(val) / 60)
                const s = Number(val) % 60
                display = `${m}:${String(s).padStart(2, '0')}`
              }
              if (key === 'views' && val) display = Number(val).toLocaleString()
              return (
                <tr key={key}>
                  <th style={{ whiteSpace: 'nowrap', textTransform: 'capitalize', paddingRight: '1rem' }}>
                    {key.replace(/([A-Z])/g, ' $1')}
                  </th>
                  <td style={{ wordBreak: 'break-all' }}>{display}</td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
      </div>
    </div>
  )
}
