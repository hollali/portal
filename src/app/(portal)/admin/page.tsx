'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LayoutDashboard } from 'lucide-react'
import AdminDashboard from '@/components/admin/AdminDashboard'
import type { MediaType } from '@/components/admin/MediaManager'
import { jsonFetch } from '@/lib/jsonFetch'
import { PageHeader } from '@/components/ui/kit'

export default function AdminPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    jsonFetch<{ role?: string }>('/api/me')
      .then(d => {
        // The CMS admits admins, editors and viewers; the dashboard is read-only.
        if (d?.role !== 'admin' && d?.role !== 'editor' && d?.role !== 'viewer') {
          router.push('/login')
          return
        }
        setReady(true)
      })
  }, [router])

  const handleBrowse = (tab: MediaType) => {
    router.push(`/admin/media/${tab}`)
  }

  if (!ready) return <div>Loading…</div>

  return (
    <div>
      <PageHeader
        title="Dashboard"
        icon={<LayoutDashboard size={22} />}
        description="Collection totals, activity, and sources across every media type."
      />
      <AdminDashboard onBrowse={handleBrowse} />
    </div>
  )
}