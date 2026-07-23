'use client'

import { useState, useEffect } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'

type Theme = 'light' | 'dark' | 'system'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved) setTheme(saved)
  }, [])

  useEffect(() => {
    if (!mounted) return
    localStorage.setItem('theme', theme)

    const root = document.documentElement
    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.add(isDark ? 'dark' : 'light')
    } else {
      root.classList.add(theme)
    }
  }, [theme, mounted])

  if (!mounted) return null

  const themes: { value: Theme; icon: typeof Sun; label: string }[] = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ]

  return (
    <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: 'var(--muted)', opacity: 0.8 }}>
      {themes.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className="flex items-center justify-center rounded-md p-1.5 transition-all duration-200"
          style={{
            background: theme === value ? 'var(--card)' : 'transparent',
            color: theme === value ? 'var(--primary)' : 'var(--muted)',
            border: 'none', cursor: 'pointer',
            boxShadow: theme === value ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
          }}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  )
}
