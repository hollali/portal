'use client'

import { useState, useEffect } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const next =
      saved === 'light' || saved === 'dark'
        ? saved === 'dark'
        : window.matchMedia('(prefers-color-scheme: dark)').matches
    const id = requestAnimationFrame(() => {
      setMounted(true)
      setIsDark(next)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (!mounted) return
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
    const root = document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(isDark ? 'dark' : 'light')
  }, [isDark, mounted])

  if (!mounted) return null

  const switchTo = isDark ? 'light' : 'dark'
  const Icon = isDark ? Sun : Moon

  return (
    <button
      onClick={() => setIsDark(d => !d)}
      aria-label={`Switch to ${switchTo} mode`}
      title={`Switch to ${switchTo} mode`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.5rem 0.75rem',
        borderRadius: 999,
        cursor: 'pointer',
        background: 'var(--card)',
        border: '1px solid var(--border)',
        color: 'var(--foreground)',
        transition: 'color 0.2s, border-color 0.2s, background 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = 'var(--primary)'
        e.currentTarget.style.borderColor = 'var(--border-strong)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = 'var(--foreground)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      <Icon size={14} />
    </button>
  )
}