'use client'

import type { ReactNode } from 'react'
import { Breadcrumbs, type Crumb } from '@/components/ui/Breadcrumbs'

export type { Crumb }

export interface PageHeaderProps {
  title: string
  description?: string
  icon?: ReactNode
  /** Breadcrumb trail rendered above the title. */
  crumbs?: Crumb[]
  /** Right-aligned action area (primary CTA, filters, etc). */
  actions?: ReactNode
  /** Small metadata row under the description. */
  meta?: ReactNode
}

/**
 * The one page-header shape for the CMS, so title size, icon treatment, the
 * gap before content and the description colour are identical on every page
 * instead of being re-spelled per file.
 */
export function PageHeader({ title, description, icon, crumbs, actions, meta }: PageHeaderProps) {
  return (
    <header className="mb-6">
      {crumbs && <Breadcrumbs crumbs={crumbs} />}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2" style={{ fontSize: '1.375rem', lineHeight: 1.25, fontWeight: 700 }}>
            {icon && (
              <span className="inline-flex shrink-0" style={{ color: 'var(--primary)' }} aria-hidden>
                {icon}
              </span>
            )}
            <span className="truncate">{title}</span>
          </h1>
          {description && (
            <p className="mt-1.5" style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)', maxWidth: '68ch' }}>
              {description}
            </p>
          )}
          {meta && <div className="mt-2">{meta}</div>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </header>
  )
}
