'use client'

import { useEffect, useState, useCallback, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Pencil, Trash2, ShieldCheck, Shield } from 'lucide-react'
import { Modal, AnimBtn, Toast, SkeletonTable, EmptyState } from '@/components/ui'

interface User {
  id: number
  username: string
  email: string | null
  isAdmin: boolean
  role: string
  createdAt: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
}

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selfId, setSelfId] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetch('/api/me').then(r => r.json()).then(d => {
      if (!d.isAdmin || d.role !== 'admin') {
        router.push('/login')
        return
      }
      setIsAdmin(true)
    })
  }, [router])

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/admin/users')
    const d = await res.json()
    if (res.ok) {
      setUsers(d.users || [])
      const me = await fetch('/api/me').then(r => r.json())
      setSelfId(me.userId ?? null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (isAdmin) fetchUsers()
  }, [isAdmin, fetchUsers])

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const form = e.currentTarget
    const body = {
      username: (form.querySelector<HTMLInputElement>('[name=username]')?.value || '').trim(),
      password: form.querySelector<HTMLInputElement>('[name=password]')?.value || '',
      email: form.querySelector<HTMLInputElement>('[name=email]')?.value || '',
      isAdmin: (form.querySelector<HTMLSelectElement>('[name=role]')?.value) === 'admin' ||
               (form.querySelector<HTMLInputElement>('[name=isAdmin]')?.checked ?? false),
      role: form.querySelector<HTMLSelectElement>('[name=role]')?.value || 'viewer',
    }
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await res.json()
    setSaving(false)
    if (res.ok) {
      setToast({ message: `User "${body.username}" created` })
      setShowAdd(false)
      fetchUsers()
    } else {
      setToast({ message: d.error || 'Failed to create user', type: 'error' })
    }
  }

  const handleEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingUser) return
    setSaving(true)
    const form = e.currentTarget
    const body: Record<string, unknown> = { id: editingUser.id }
    const email = form.querySelector<HTMLInputElement>('[name=email]')?.value || ''
    const roleVal = form.querySelector<HTMLSelectElement>('[name=role]')?.value || editingUser.role
    const password = form.querySelector<HTMLInputElement>('[name=password]')?.value || ''
    body.email = email
    body.role = roleVal
    body.isAdmin = roleVal === 'admin'
    if (password) body.password = password

    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await res.json()
    setSaving(false)
    if (res.ok) {
      setToast({ message: `User "${editingUser.username}" updated` })
      setEditingUser(null)
      fetchUsers()
    } else {
      setToast({ message: d.error || 'Failed to update user', type: 'error' })
    }
  }

  const handleDelete = async (user: User) => {
    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/users?id=${user.id}`, { method: 'DELETE' })
    const d = await res.json()
    if (res.ok) {
      setToast({ message: `Deleted user "${user.username}"` })
      fetchUsers()
    } else {
      setToast({ message: d.error || 'Failed to delete', type: 'error' })
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <SkeletonTable rows={5} cols={5} />
      </div>
    )
  }

  return (
    <div className="page-enter">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold mb-1 flex items-center gap-2">
            <Users size={20} style={{ color: 'var(--primary)' }} /> User Management
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            Manage admin accounts and their roles.
          </p>
        </div>
        <AnimBtn onClick={() => setShowAdd(true)} style={{ padding: '0.5rem 1rem', background: 'var(--primary)', color: 'var(--primary-fg)', fontWeight: 600, fontSize: '0.875rem', gap: '0.375rem' }}>
          <Plus size={14} /> Add User
        </AnimBtn>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {loading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : users.length === 0 ? (
        <EmptyState message="No users found." icon={<Users size={48} />} />
      ) : (
        <div className="card overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const isSelf = user.id === selfId
                const isLastAdmin = user.role === 'admin' && users.filter(u => u.role === 'admin').length === 1
                return (
                  <tr key={user.id} className="stagger-item">
                    <td className="font-semibold">{user.id}</td>
                    <td className="font-medium">
                      {user.username}
                      {isSelf && <span className="text-xs ml-2" style={{ color: 'var(--primary)' }}>(you)</span>}
                    </td>
                    <td style={{ color: 'var(--muted-foreground)' }}>{user.email || '-'}</td>
                    <td>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
                        style={{
                          background: user.role === 'admin' ? 'rgba(var(--primary-rgb,21,61,108),0.15)' : user.role === 'editor' ? 'rgba(var(--success-rgb,16,185,129),0.15)' : 'var(--muted)',
                          color: user.role === 'admin' ? 'var(--primary)' : user.role === 'editor' ? 'var(--success)' : 'var(--muted-foreground)',
                        }}>
                        {user.role === 'admin' ? <ShieldCheck size={12} /> : <Shield size={12} />}
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </td>
                    <td className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        <AnimBtn onClick={() => setEditingUser(user)} title="Edit" style={{ padding: '0.375rem', background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--primary)' }}>
                          <Pencil size={14} />
                        </AnimBtn>
                        <AnimBtn
                          onClick={() => handleDelete(user)}
                          title={isSelf ? 'Cannot delete your own account' : 'Delete'}
                          disabled={isSelf || (isLastAdmin && !isSelf)}
                          style={{ padding: '0.375rem', background: 'var(--danger)', color: 'white', opacity: isSelf || (isLastAdmin && !isSelf) ? 0.5 : 1 }}
                        >
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

      {/* Add modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} maxWidth="500px">
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Plus size={16} /> Add User</h2>
          <form onSubmit={handleAdd}>
            <div className="grid grid-cols-1 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Username</label>
                <input name="username" required className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Email</label>
                <input name="email" type="email" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Password</label>
                <input name="password" type="password" required className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Role</label>
                <select name="role" className="w-full rounded-lg border px-3 py-2 text-sm cursor-pointer" style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                  <option value="viewer">Viewer — read-only access</option>
                  <option value="editor">Editor — can manage media</option>
                  <option value="admin">Admin — full access</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <AnimBtn onClick={() => setShowAdd(false)} style={{ padding: '0.5rem 1rem', background: 'var(--card)', border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.875rem' }}>
                Cancel
              </AnimBtn>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: 'var(--primary)', color: 'var(--primary-fg)', cursor: saving ? 'not-allowed' : 'pointer', border: 'none' }}>
                <Plus size={14} /> Create
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editingUser} onClose={() => setEditingUser(null)} maxWidth="500px">
        {editingUser && (
          <div className="p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Pencil size={16} /> Edit User</h2>
            <form onSubmit={handleEdit}>
              <div className="grid grid-cols-1 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Username</label>
                  <input value={editingUser.username} disabled className="w-full rounded-lg border px-3 py-2 text-sm opacity-70" style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Email</label>
                  <input name="email" type="email" key={`email-${editingUser.id}`} defaultValue={editingUser.email || ''} className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Role</label>
                  <select name="role" key={`role-${editingUser.id}`} defaultValue={editingUser.role} className="w-full rounded-lg border px-3 py-2 text-sm cursor-pointer" style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}>
                    <option value="viewer">Viewer — read-only access</option>
                    <option value="editor">Editor — can manage media</option>
                    <option value="admin">Admin — full access</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">New password (leave blank to keep)</label>
                  <input name="password" type="password" className="w-full rounded-lg border px-3 py-2 text-sm" style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <AnimBtn onClick={() => setEditingUser(null)} style={{ padding: '0.5rem 1rem', background: 'var(--card)', border: '1px solid var(--border)', fontWeight: 600, fontSize: '0.875rem' }}>
                  Cancel
                </AnimBtn>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: 'var(--primary)', color: 'var(--primary-fg)', cursor: saving ? 'not-allowed' : 'pointer', border: 'none' }}>
                  <Pencil size={14} /> Save
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  )
}
