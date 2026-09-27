'use client'

import { useEffect, useState, useCallback, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Pencil, Trash2, ShieldCheck, Shield } from 'lucide-react'
import { Modal, SkeletonTable, EmptyState, ConfirmDialog } from '@/components/ui'
import { PageHeader, Button, Badge, Field, Input, Select, useToast, type BadgeTone } from '@/components/ui/kit'
import { jsonFetch } from '@/lib/jsonFetch'

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

const ROLE_TONES: Record<string, BadgeTone> = {
  admin: 'brand',
  editor: 'success',
  viewer: 'neutral',
}

const MIN_PASSWORD = 8

const emptyDraft = { username: '', email: '', password: '', role: 'viewer' }
type Draft = typeof emptyDraft

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selfId, setSelfId] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft)
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({})
  const [confirm, setConfirm] = useState<{ title: string; message: ReactNode; onConfirm: () => Promise<void> } | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    jsonFetch<{ isAdmin?: boolean; role?: string }>('/api/me').then(d => {
      if (!d?.isAdmin || d.role !== 'admin') {
        router.push('/login')
        return
      }
      setIsAdmin(true)
    })
  }, [router])

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/admin/users')
    if (res.ok) {
      const d = await res.json().catch(() => null)
      setUsers(d?.users || [])
      const me = await jsonFetch<{ userId?: number }>('/api/me')
      setSelfId(me?.userId ?? null)
    } else {
      toast('Could not load users.', { tone: 'error' })
    }
    setLoading(false)
  }, [toast])

  useEffect(() => {
    if (!isAdmin) return
    const id = requestAnimationFrame(() => fetchUsers())
    return () => cancelAnimationFrame(id)
  }, [isAdmin, fetchUsers])

  const openAdd = () => {
    setDraft(emptyDraft)
    setErrors({})
    setShowAdd(true)
  }

  const openEdit = (user: User) => {
    setEditDraft({ username: user.username, email: user.email || '', password: '', role: user.role })
    setErrors({})
    setEditingUser(user)
  }

  const validate = (d: Draft, requirePassword: boolean): boolean => {
    const next: Partial<Record<keyof Draft, string>> = {}
    if (!d.username.trim()) next.username = 'Username is required.'
    if (requirePassword && d.password.length < MIN_PASSWORD) {
      next.password = `Use at least ${MIN_PASSWORD} characters.`
    }
    if (!requirePassword && d.password && d.password.length < MIN_PASSWORD) {
      next.password = `Use at least ${MIN_PASSWORD} characters, or leave blank to keep the current password.`
    }
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
      next.email = 'Enter a valid email address.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validate(draft, true)) return
    setSaving(true)
    const body = {
      username: draft.username.trim(),
      password: draft.password,
      email: draft.email.trim(),
      isAdmin: draft.role === 'admin',
      role: draft.role,
    }
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await res.json().catch(() => ({}))
    setSaving(false)
    if (res.ok) {
      toast(`User "${body.username}" created.`, { tone: 'success' })
      setShowAdd(false)
      fetchUsers()
    } else {
      toast(d.error || 'Failed to create user.', { tone: 'error' })
    }
  }

  const handleEdit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!editingUser) return
    if (!validate(editDraft, false)) return
    setSaving(true)
    const body: Record<string, unknown> = {
      id: editingUser.id,
      email: editDraft.email.trim(),
      role: editDraft.role,
      isAdmin: editDraft.role === 'admin',
    }
    if (editDraft.password) body.password = editDraft.password

    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const d = await res.json().catch(() => ({}))
    setSaving(false)
    if (res.ok) {
      toast(`User "${editingUser.username}" updated.`, { tone: 'success' })
      setEditingUser(null)
      fetchUsers()
    } else {
      toast(d.error || 'Failed to update user.', { tone: 'error' })
    }
  }

  const handleDelete = async (user: User) => {
    setDeletingId(user.id)
    const res = await fetch(`/api/admin/users?id=${user.id}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    setDeletingId(null)
    if (res.ok) {
      toast(`Deleted user "${user.username}".`, { tone: 'success' })
      fetchUsers()
    } else {
      toast(d.error || 'Failed to delete.', { tone: 'error' })
    }
  }

  const askDeleteUser = (user: User) =>
    setConfirm({
      title: 'Delete user?',
      message: (
        <>
          This will permanently remove <strong>&ldquo;{user.username}&rdquo;</strong>. They will no longer be
          able to sign in. This cannot be undone.
        </>
      ),
      onConfirm: () => handleDelete(user),
    })

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <SkeletonTable rows={5} cols={5} />
      </div>
    )
  }

  const adminCount = users.filter(u => u.role === 'admin').length

  return (
    <div className="page-enter">
      <PageHeader
        title="User Management"
        icon={<Users size={22} />}
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Users' }]}
        description="Manage admin accounts and their roles."
        actions={
          <Button variant="primary" onClick={openAdd} iconLeft={<Plus size={14} aria-hidden />}>
            Add User
          </Button>
        }
      />

      {loading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : users.length === 0 ? (
        <EmptyState message="No users found." icon={<Users size={48} />} />
      ) : (
        <div className="card overflow-x-auto">
          <div className="table-wrap table-cards">
            <table>
            <caption className="sr-only">Admin accounts and their assigned roles</caption>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Username</th>
                <th scope="col">Email</th>
                <th scope="col">Role</th>
                <th scope="col">Created</th>
                <th scope="col" style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => {
                const isSelf = user.id === selfId
                const isLastAdmin = user.role === 'admin' && adminCount === 1
                const deleteBlocked = isSelf || isLastAdmin
                const deleteTitle = isSelf
                  ? 'You cannot delete your own account'
                  : isLastAdmin
                    ? 'Cannot delete the last remaining admin'
                    : 'Delete user'
                return (
                  <tr key={user.id} className="stagger-item">
                    <td data-label="ID" className="font-semibold">{user.id}</td>
                    <td data-label="Username" className="font-medium">
                      {user.username}
                      {isSelf && <span className="text-xs ml-2" style={{ color: 'var(--primary)' }}>(you)</span>}
                    </td>
                    <td data-label="Email" style={{ color: 'var(--muted-foreground)' }}>
                      {user.email || <span aria-label="No email">—</span>}
                    </td>
                    <td data-label="Role">
                      <Badge
                        tone={ROLE_TONES[user.role] ?? 'neutral'}
                        icon={user.role === 'admin' ? <ShieldCheck size={12} aria-hidden /> : <Shield size={12} aria-hidden />}
                      >
                        {ROLE_LABELS[user.role] || user.role}
                      </Badge>
                    </td>
                    <td data-label="Created" className="text-sm whitespace-nowrap" style={{ color: 'var(--muted-foreground)' }}>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td data-label="Actions" data-wide>
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="secondary"
                          size="sm"
                          iconOnly
                          onClick={() => openEdit(user)}
                          aria-label={`Edit ${user.username}`}
                          title="Edit"
                        >
                          <Pencil size={14} aria-hidden />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          iconOnly
                          onClick={() => askDeleteUser(user)}
                          loading={deletingId === user.id}
                          disabled={deleteBlocked}
                          aria-label={`Delete ${user.username}`}
                          title={deleteTitle}
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

      {/* Add modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} maxWidth="500px">
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Plus size={16} aria-hidden /> Add User
          </h2>
          <form onSubmit={handleAdd} noValidate>
            <div className="grid grid-cols-1 gap-3 mb-4">
              <Field label="Username" required error={errors.username}>
                <Input
                  name="username"
                  autoComplete="off"
                  value={draft.username}
                  onChange={e => setDraft(d => ({ ...d, username: e.target.value }))}
                />
              </Field>
              <Field label="Email" error={errors.email} hint="Optional.">
                <Input
                  name="email"
                  type="email"
                  autoComplete="off"
                  value={draft.email}
                  onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
                />
              </Field>
              <Field
                label="Password"
                required
                error={errors.password}
                hint={`At least ${MIN_PASSWORD} characters.`}
              >
                <Input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={draft.password}
                  onChange={e => setDraft(d => ({ ...d, password: e.target.value }))}
                />
              </Field>
              <Field label="Role" required>
                <Select
                  name="role"
                  value={draft.role}
                  onChange={e => setDraft(d => ({ ...d, role: e.target.value }))}
                >
                  <option value="viewer">Viewer — read-only access</option>
                  <option value="editor">Editor — can manage media</option>
                  <option value="admin">Admin — full access</option>
                </Select>
              </Field>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving} iconLeft={<Plus size={14} aria-hidden />}>
                Create
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editingUser} onClose={() => setEditingUser(null)} maxWidth="500px">
        {editingUser && (
          <div className="p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Pencil size={16} aria-hidden /> Edit User
            </h2>
            <form onSubmit={handleEdit} noValidate>
              <div className="grid grid-cols-1 gap-3 mb-4">
                <Field label="Username" hint="Usernames cannot be changed.">
                  <Input value={editingUser.username} disabled readOnly />
                </Field>
                <Field label="Email" error={errors.email}>
                  <Input
                    name="email"
                    type="email"
                    value={editDraft.email}
                    onChange={e => setEditDraft(d => ({ ...d, email: e.target.value }))}
                  />
                </Field>
                <Field label="Role" required>
                  <Select
                    name="role"
                    value={editDraft.role}
                    onChange={e => setEditDraft(d => ({ ...d, role: e.target.value }))}
                  >
                    <option value="viewer">Viewer — read-only access</option>
                    <option value="editor">Editor — can manage media</option>
                    <option value="admin">Admin — full access</option>
                  </Select>
                </Field>
                <Field label="New password" error={errors.password} hint="Leave blank to keep the current password.">
                  <Input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={editDraft.password}
                    onChange={e => setEditDraft(d => ({ ...d, password: e.target.value }))}
                  />
                </Field>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="secondary" onClick={() => setEditingUser(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={saving} iconLeft={<Pencil size={14} aria-hidden />}>
                  Save
                </Button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title || 'Confirm delete'}
        message={confirm?.message}
        busy={deletingId !== null}
        onConfirm={() => confirm?.onConfirm()}
        onClose={() => setConfirm(null)}
      />
    </div>
  )
}
