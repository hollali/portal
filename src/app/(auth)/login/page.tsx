'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogIn, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    setLoading(false)
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get('next')
      if (next && next.startsWith('/') && !next.startsWith('//')) {
        router.push(next)
      } else {
        router.push('/dashboard')
      }
    }
    else {
      let message = 'Login failed'
      try {
        const data = await res.json()
        if (data?.error) message = data.error
      } catch {
        if (res.status >= 500) message = 'Server error, please retry'
      }
      setError(message)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <LogIn size={32} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Login</h1>
        </div>
        <form onSubmit={handleSubmit} className="card">
          {error && (
            <div style={{
              color: 'var(--danger)',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              padding: '0.5rem 0.75rem',
              background: 'rgba(239,68,68,0.08)',
              borderRadius: '0.375rem',
              border: '1px solid rgba(239,68,68,0.2)',
            }}>
              {error}
            </div>
          )}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.375rem' }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: '0.375rem', background: 'var(--background)', color: 'var(--foreground)', transition: 'border-color 0.2s, box-shadow 0.2s' }}
              onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-glow)' }}
              onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
              required
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.375rem' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 2.5rem 0.5rem 0.75rem', border: '1px solid var(--border)', borderRadius: '0.375rem', background: 'var(--background)', color: 'var(--foreground)', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-glow)' }}
                onBlur={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--muted)',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--primary)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-pulse"
            style={{
              width: '100%',
              padding: '0.625rem',
              background: loading ? 'var(--muted)' : 'var(--primary)',
              color: loading ? 'var(--background)' : 'var(--primary-fg)',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '1rem' }}>
          <Link href="/" style={{ fontSize: '0.875rem', textDecoration: 'none' }}>
            Back to public site
          </Link>
        </p>
      </div>
    </div>
  )
}