'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'

export interface Crumb {
  label: string
  href?: string
}

/**
 * One breadcrumb trail for the whole site. It was originally inline in
 * `PageHeader`, which meant the nine admin pages had a trail and the public
 * archives — which run three levels deep — had none. Extracted so both shells
 * render the same markup and cannot drift apart.
 *
 * `tone` exists only because the two shells run separate token ladders
 * (`--muted` for the portal, `--p-text-*` for the public pages). Without it a
 * trail pasted into a public page would inherit portal greys that do not match
 * the surrounding palette.
 *
 * The last crumb is plain text: a link to the page you are already on is a
 * no-op tap that reads as a broken control.
 */
export function Breadcrumbs({
  crumbs,
  tone = 'portal',
  className = 'mb-2',
  separator = '/',
}: {
  crumbs: Crumb[]
  tone?: 'portal' | 'public'
  className?: string
  separator?: ReactNode
}) {
  if (crumbs.length === 0) return null

  const tone_ =
    tone === 'public'
      ? { link: 'var(--p-text-3)', current: 'var(--p-text-2)', sep: 'var(--p-border-3)' }
      : { link: 'var(--muted)', current: 'var(--muted-foreground)', sep: 'var(--border-strong)' }

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-1.5 flex-wrap">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {c.href && !last ? (
                <Link href={c.href} className="text-xs no-underline" style={{ color: tone_.link }}>
                  {c.label}
                </Link>
              ) : (
                <span
                  className="text-xs font-semibold"
                  style={{ color: tone_.current }}
                  aria-current={last ? 'page' : undefined}
                >
                  {c.label}
                </span>
              )}
              {!last && (
                <span aria-hidden style={{ color: tone_.sep }}>
                  {separator}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}