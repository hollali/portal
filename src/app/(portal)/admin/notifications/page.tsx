'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, Trash2, Info, AlertTriangle, XCircle, CheckCircle2, BellOff, type LucideIcon } from 'lucide-react'
import { AnimBtn, EmptyState, SkeletonTable, Toast } from '@/components/ui'

interface Notification {
  id: number
  type: string
  message: string
  read: boolean
  createdAt: string
}

const TYPE_META: Record<string, { icon: LucideIcon; color: string }> = {
  info: { icon: Info, color: 'var(--primary)' },
  warning: { icon: AlertTriangle, color: 'var(--warning, #f59e0b)' },
  error: { icon: XCircle, color: 'var(--danger)' },
  success: { icon: CheckCircle2, color: 'var(--success)' },
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (!d.isAdmin) {
        router.push('/login')
        return
      }
      setIsAdmin(true)
    })
  }, [router])

  const fetchNotifications = async () => {
    const res = await fetch('/api/admin/notifications')
    const d = await res.json()
    setNotifications(d.notifications || [])
    setLoading(false)
  }

  useEffect(() => {
    if (isAdmin) fetchNotifications()
  }, [isAdmin])

  const markRead = async (id?: number) => {
    await fetch('/api/admin/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', id }),
    })
    fetchNotifications()
  }

  const deleteNotification = async (id?: number) => {
    await fetch('/api/admin/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    })
    fetchNotifications()
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <SkeletonTable rows={5} cols={3} />
      </div>
    )
  }

  const unread = notifications.filter(n => !n.read).length

  return (
    <div className="page-enter">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold mb-1 flex items-center gap-2">
            <Bell size={20} style={{ color: 'var(--primary)' }} /> Notifications
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            System alerts and operation results. {unread > 0 ? `${unread} unread.` : 'All caught up.'}
          </p>
        </div>
        <div className="flex gap-2">
          {unread > 0 && (
            <AnimBtn onClick={() => markRead()} style={{ padding: '0.5rem 1rem', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--primary)', fontWeight: 600, fontSize: '0.875rem', gap: '0.375rem' }}>
              <Check size={14} /> Mark all read
            </AnimBtn>
          )}
          {notifications.length > 0 && (
            <AnimBtn onClick={() => deleteNotification()} style={{ padding: '0.5rem 1rem', background: 'var(--card)', border: '1px solid var(--danger)', color: 'var(--danger)', fontWeight: 600, fontSize: '0.875rem', gap: '0.375rem' }}>
              <Trash2 size={14} /> Clear all
            </AnimBtn>
          )}
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {loading ? (
        <SkeletonTable rows={8} cols={3} />
      ) : notifications.length === 0 ? (
        <EmptyState message="No notifications yet." icon={<BellOff size={48} />} />
      ) : (
        <div className="card overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Type</th>
                <th>Message</th>
                <th>Time</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map(n => {
                const meta = TYPE_META[n.type] || TYPE_META.info
                const Icon = meta.icon
                return (
                  <tr key={n.id} className="stagger-item" style={{ opacity: n.read ? 0.6 : 1 }}>
                    <td>
                      {!n.read && <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Icon size={16} style={{ color: meta.color }} />
                        <span className="capitalize font-medium" style={{ color: meta.color }}>{n.type}</span>
                      </div>
                    </td>
                    <td className="text-sm">{n.message}</td>
                    <td className="text-sm whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(n.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        {!n.read && (
                          <AnimBtn onClick={() => markRead(n.id)} title="Mark read" style={{ padding: '0.375rem', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--primary)' }}>
                            <Check size={14} />
                          </AnimBtn>
                        )}
                        <AnimBtn onClick={() => deleteNotification(n.id)} title="Delete" style={{ padding: '0.375rem', background: 'var(--danger)', color: 'white' }}>
                          <Trash2 size={14} />
                        </AnimBtn>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
