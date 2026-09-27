'use client'

import { useRef, type ReactNode } from 'react'

export interface TabItem<T extends string = string> {
  value: T
  label: string
  icon?: ReactNode
  badge?: ReactNode
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
}

/**
 * Segmented control with real tablist semantics: roving tabindex, arrow-key
 * navigation and `aria-selected`. The previous inline version was a row of
 * buttons, so it announced as four unrelated controls and arrow keys did
 * nothing.
 */
export function Tabs<T extends string = string>({ items, value, onChange, label, className = '' }: TabsProps<T>) {
  const ref = useRef<HTMLDivElement>(null)

  const move = (dir: 1 | -1) => {
    const i = items.findIndex(t => t.value === value)
    const next = items[(i + dir + items.length) % items.length]
    if (next) {
      onChange(next.value)
      const el = ref.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(next.value)}"]`)
      el?.focus()
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Home') { e.preventDefault(); const f = items[0]; if (f) { onChange(f.value); ref.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(f.value)}"]`)?.focus() } }
    else if (e.key === 'End') { e.preventDefault(); const l = items[items.length - 1]; if (l) { onChange(l.value); ref.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(l.value)}"]`)?.focus() } }
  }

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`inline-flex items-center gap-1 p-1 ${className}`}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}
    >
      {items.map(item => {
        const selected = item.value === value
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            data-value={item.value}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className="inline-flex items-center gap-2 font-semibold"
            style={{
              padding: '0.375rem 0.875rem',
              fontSize: '0.8125rem',
              borderRadius: 7,
              border: '1px solid transparent',
              cursor: 'pointer',
              background: selected ? 'var(--primary)' : 'transparent',
              color: selected ? 'var(--primary-fg)' : 'var(--muted-foreground)',
            }}
          >
            {item.icon && <span aria-hidden>{item.icon}</span>}
            {item.label}
            {item.badge}
          </button>
        )
      })}
    </div>
  )
}
