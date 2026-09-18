'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import MediaManager, { MEDIA_TYPES, MEDIA_LABELS, type MediaType } from '@/components/admin/MediaManager'
import { jsonFetch } from '@/lib/jsonFetch'

export default function AdminMediaPage() {
  const router = useRouter()
  const { type } = useParams<{ type: string }>()
  const [state, setState] = useState<{ role: string } | null>(null)

  useEffect(() => {
    jsonFetch<{ isAdmin?: boolean; role?: string }>('/api/me')
      .then(d => {
        if (!d?.isAdmin) {
          router.push('/login')
          return
        }
        setState({ role: d.role || '' })
      })
  }, [router])

  if (!MEDIA_TYPES.includes(type as MediaType)) {
    return (
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Media</h1>
        <p style={{ color: 'var(--muted)' }}>Unknown media type.</p>
        <button
          onClick={() => router.push('/admin')}
          style={{ marginTop: '1rem', cursor: 'pointer', color: 'var(--primary)', background: 'none', border: 'none' }}
        >
          Back to dashboard
        </button>
      </div>
    )
  }

  const mediaType = type as MediaType

  if (!state) return <div>Loading...</div>

  const canManage = state.role === 'admin' || state.role === 'editor'

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>{MEDIA_LABELS[mediaType]}</h1>
      <MediaManager type={mediaType} canManage={canManage} />
    </div>
  )
}