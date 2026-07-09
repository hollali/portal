'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function NewsDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [item, setItem] = useState<any>(null)

  useEffect(() => {
    fetch(`/api/news/${id}`).then(r => r.json()).then(setItem)
  }, [id])

  if (!item) return <div>Loading...</div>
  if (item.error) return <div>Not found</div>

  return (
    <div>
      <Link href="/news" style={{ fontSize: '0.875rem', marginBottom: '1rem', display: 'inline-block' }}>&larr; Back to News</Link>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>{item.title || `News #${item.id}`}</h1>

      <div className="card">
        {item.snippet && (
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--background)', borderRadius: '0.375rem', lineHeight: 1.6 }}>
            {item.snippet}
          </div>
        )}
        <div className="table-wrap"><table>
          <tbody>
            {Object.entries(item).filter(([k]) => k !== 'id' && k !== 'snippet').map(([key, val]) => (
              <tr key={key}>
                <th style={{ whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{key.replace(/([A-Z])/g, ' $1')}</th>
                <td>{val === null || val === undefined ? '-' : String(val)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </div>
  )
}
