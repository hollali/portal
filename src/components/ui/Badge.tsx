'use client'

import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

const TONES: Record<BadgeTone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: 'var(--surface)', fg: 'var(--muted-foreground)', border: 'var(--border)' },
  success: {
    bg: 'color-mix(in srgb, var(--success) 15%, transparent)',
    fg: 'var(--success)',
    border: 'color-mix(in srgb, var(--success) 32%, transparent)',
  },
  warning: {
    bg: 'color-mix(in srgb, var(--warning) 16%, transparent)',
    fg: 'var(--warning)',
    border: 'color-mix(in srgb, var(--warning) 34%, transparent)',
  },
  danger: {
    bg: 'color-mix(in srgb, var(--danger) 15%, transparent)',
    fg: 'var(--danger)',
    border: 'color-mix(in srgb, var(--danger) 32%, transparent)',
  },
  info: {
    bg: 'color-mix(in srgb, var(--focus) 15%, transparent)',
    fg: 'var(--focus)',
    border: 'color-mix(in srgb, var(--focus) 32%, transparent)',
  },
  brand: {
    bg: 'color-mix(in srgb, var(--primary) 15%, transparent)',
    fg: 'var(--primary)',
    border: 'color-mix(in srgb, var(--primary) 32%, transparent)',
  },
}

export interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
  icon?: ReactNode
  className?: string
  style?: React.CSSProperties
  title?: string
}

/**
 * Status pill driven by theme tokens rather than fixed hex values, so it stays
 * legible in both themes and tracks the palette if the theme changes.
 */
export function Badge({ tone = 'neutral', children, icon, className = '', style, title }: BadgeProps) {
  const t = TONES[tone]
  return (
    <span
      title={title}
      className={`ui-badge inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap ${className}`}
      style={{
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        padding: '0.125rem 0.5rem',
        fontSize: '0.6875rem',
        lineHeight: 1.5,
        ...style,
      }}
    >
      {icon}
      {children}
    </span>
  )
}

/** Maps a CMS status string onto a tone, so unknown states degrade to neutral. */
export function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'published':
    case 'active':
    case 'ok':
      return 'success'
    case 'draft':
    case 'pending':
      return 'warning'
    case 'failed':
    case 'error':
    case 'disabled':
      return 'danger'
    default:
      return 'neutral'
  }
}

const STATUS_LABELS: Record<string, string> = {
  published: 'Published',
  draft: 'Draft',
  archived: 'Archived',
  pending: 'Pending',
  failed: 'Failed',
  active: 'Active',
  disabled: 'Disabled',
}

/**
 * Status pill for CMS records. Unlike the previous inline versions, a status
 * outside the known set renders its own label instead of being mislabelled
 * "Draft".
 */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge tone={statusTone(status)} className={className}>
      {STATUS_LABELS[status] ?? status}
    </Badge>
  )
}
