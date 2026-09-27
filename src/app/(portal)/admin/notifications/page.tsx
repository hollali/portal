'use client'

import { useEffect, useState, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, Trash2, Info, AlertTriangle, XCircle, CheckCircle2, BellOff, type LucideIcon } from 'lucide-react'
import { EmptyState, SkeletonTable, ConfirmDialog } from '@/components/ui'
import { PageHeader, Button, Badge, useToast, type BadgeTone } from '@/components/ui/kit'
import { jsonFetch } from '@/lib/jsonFetch'

interface Notification {
  id: number
  type: string
  message: string
  read: boolean
  createdAt: string
}

const TYPE_META: Record<string, { icon: LucideIcon; tone: BadgeTone }> = {
  info: { icon: Info, tone: 'info' },
  warning: { icon: AlertTriangle, tone: 'warning' },
  error: { icon: XCircle, tone: 'danger' },
  success: { icon: CheckCircle2, tone: 'success' },
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  // Admits admins OR editors, so `isAdmin` was a misleading name.
  const [authorized, setAuthorized] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [clearing, setClearing] = useState(false)
  const [confirm, setConfirm] = useState<{ title: string; message: ReactNode; onConfirm: () => Promise<void> } | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    jsonFetch<{ role?: string }>('/api/me').then(d => {
      if (d?.role !== 'admin' && d?.role !== 'editor') {
        router.push('/admin')
        return
      }
      setAuthorized(true)
    })
  }, [router])

  const fetchNotifications = useCallback(async () => {
    const res = await fetch('/api/admin/notifications')
    if (res.ok) {
      const d = await res.json().catch(() => null)
      setNotifications(d?.notifications || [])
    } else {
      toast('Could not load notifications.', { tone: 'error' })
    }
    setLoading(false)
  }, [toast])

  useEffect(() => {
    if (!authorized) return
    const id = requestAnimationFrame(() => fetchNotifications())
    return () => cancelAnimationFrame(id)
  }, [authorized, fetchNotifications])

  const markRead = async (id?: number) => {
    const res = await fetch('/api/admin/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', id }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast(d.error || 'Failed to update notifications.', { tone: 'error' })
      return
    }
    if (id !== undefined) {
      setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)))
    } else {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }
    toast(id === undefined ? 'All notifications marked read.' : 'Marked read.', { tone: 'success' })
  }

  const deleteNotification = async (id: number) => {
    setBusyId(id)
    const res = await fetch('/api/admin/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    })
    setBusyId(null)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast(d.error || 'Failed to delete notification.', { tone: 'error' })
      return
    }
    setNotifications(prev => prev.filter(n => n.id !== id))
    toast('Notification deleted.', { tone: 'success' })
  }

  const clearAll = async () => {
    setClearing(true)
    const res = await fetch('/api/admin/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'clear_all' }),
    })
    setClearing(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      toast(d.error || 'Failed to clear notifications.', { tone: 'error' })
      return
    }
    const d = await res.json().catch(() => ({}))
    setNotifications([])
    toast(`Cleared ${d.deleted ?? 0} notification(s).`, { tone: 'success' })
  }

  const askClearAll = () => {
    if (notifications.length === 0) return
    setConfirm({
      title: 'Delete all notifications?',
      message: (
        <>
          This will permanently delete all <strong>{notifications.length}</strong> notification(s). This cannot be undone.
        </>
      ),
      onConfirm: clearAll,
    })
  }

  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <SkeletonTable rows={5} cols={3} />
      </div>
    )
  }

  const unread = notifications.filter(n => !n.read).length

  return (
    <div className="page-enter">
      <PageHeader
        title="Notifications"
        icon={<Bell size={22} />}
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Notifications' }]}
        description={
          unread > 0
            ? `System alerts and operation results. ${unread} unread.`
            : 'System alerts and operation results. All caught up.'
        }
        actions={
          <>
            {unread > 0 && (
              <Button variant="secondary" onClick={() => markRead()} iconLeft={<Check size={14} aria-hidden />}>
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="secondary"
                onClick={askClearAll}
                loading={clearing}
                iconLeft={<Trash2 size={14} aria-hidden />}
                style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                Clear all
              </Button>
            )}
          </>
        }
      />

      {loading ? (
        <SkeletonTable rows={8} cols={3} />
      ) : notifications.length === 0 ? (
        <EmptyState message="No notifications yet." icon={<BellOff size={48} />} />
      ) : (
        <div className="card overflow-x-auto">
          <div className="table-wrap table-cards">
            <table>
            <caption className="sr-only">System notifications, newest first</caption>
            <thead>
              <tr>
                <th scope="col" style={{ width: '40px' }}>
                  <span className="sr-only">Unread</span>
                </th>
                <th scope="col">Type</th>
                <th scope="col">Message</th>
                <th scope="col">Time</th>
                <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map(n => {
                const meta = TYPE_META[n.type] ?? TYPE_META.info
                const Icon = meta.icon
                return (
                  <tr key={n.id} className="stagger-item" style={{ opacity: n.read ? 0.6 : 1 }}>
                    <td className="select-cell">
                      {n.read ? (
                        <span className="sr-only">Read</span>
                      ) : (
                        <>
                          <span
                            aria-hidden
                            style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }}
                          />
                          <span className="sr-only">Unread</span>
                        </>
                      )}
                    </td>
                    <td data-label="Type">
                      <Badge tone={meta.tone} icon={<Icon size={13} aria-hidden />}>
                        <span className="capitalize">{n.type}</span>
                      </Badge>
                    </td>
                    <td data-label="Message" className="text-sm">{n.message}</td>
                    <td data-label="Time" className="text-sm whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(n.createdAt).toLocaleString()}
                    </td>
                    <td data-label="Actions" data-wide>
                      <div className="flex gap-1 justify-end">
                        {!n.read && (
                          <Button
                            variant="secondary"
                            size="sm"
                            iconOnly
                            onClick={() => markRead(n.id)}
                            aria-label={`Mark notification ${n.id} as read`}
                            title="Mark read"
                          >
                            <Check size={14} aria-hidden />
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          iconOnly
                          onClick={() => deleteNotification(n.id)}
                          loading={busyId === n.id}
                          aria-label={`Delete notification ${n.id}`}
                          title="Delete"
                          style={{ color: 'var(--danger)' }}
                        >
                          <Trash2 size={14} aria-hidden />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title || 'Confirm delete'}
        message={confirm?.message}
        busy={clearing}
        onConfirm={() => confirm?.onConfirm()}
        onClose={() => setConfirm(null)}
      />
    </div>
  )
}
