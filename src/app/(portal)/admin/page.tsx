'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminDashboard from '@/components/admin/AdminDashboard'
import type { MediaType } from '@/components/admin/MediaManager'

export default function AdminPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(d => {
        if (!d.isAdmin) {
          router.push('/login')
          return
        }
        setReady(true)
      })
  }, [router])

  const handleBrowse = (tab: MediaType) => {
    router.push(`/admin/media/${tab}`)
  }

  if (!ready) return <div>Loading...</div>

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Dashboard</h1>
      <AdminDashboard onBrowse={handleBrowse} />
    </div>
  )
}