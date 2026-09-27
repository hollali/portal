'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X, CheckCircle2, AlertTriangle, Undo2 } from 'lucide-react'

/* createPortal needs a real document, so nothing renders until after mount.
   useSyncExternalStore keeps this an external-store subscription rather than a
   setState-in-effect. */
const noopSubscribe = () => () => {}
const getClient = () => true
const getServer = () => false
function useIsClient() {
  return useSyncExternalStore(noopSubscribe, getClient, getServer)
}

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastOptions {
  tone?: ToastTone
  /** ms; errors default longer than success so they can actually be read. */
  duration?: number
  action?: { label: string; onClick: () => void }
  /** Set false for toasts the user must dismiss themselves. */
  autoDismiss?: boolean
}

interface ToastItem extends Required<Omit<ToastOptions, 'action'>> {
  id: number
  message: string
  action?: { label: string; onClick: () => void }
}

interface ToastApi {
  toast: (message: string, opts?: ToastOptions) => number
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

const TONE_STYLE: Record<ToastTone, { bg: string; border: string; fg: string; icon: ReactNode }> = {
  success: {
    bg: 'var(--card)',
    border: 'color-mix(in srgb, var(--success) 45%, transparent)',
    fg: 'var(--foreground)',
    icon: <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />,
  },
  error: {
    bg: 'var(--card)',
    border: 'color-mix(in srgb, var(--danger) 50%, transparent)',
    fg: 'var(--foreground)',
    icon: <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />,
  },
  info: {
    bg: 'var(--card)',
    border: 'var(--border-strong)',
    fg: 'var(--foreground)',
    icon: null,
  },
}

const DEFAULT_DURATION: Record<ToastTone, number> = { success: 3500, error: 7000, info: 4500 }
const MAX_VISIBLE = 3

/**
 * Queued toasts behind a single polite live region.
 *
 * The previous per-page <Toast> could hold one message, so back-to-back
 * actions silently clobbered each other, and nothing announced async results
 * to screen readers. This stacks, queues the overflow, and routes every
 * message through an `aria-live="polite"` region.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const [announcement, setAnnouncement] = useState('')
  const mounted = useIsClient()
  const nextId = useRef(1)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setItems(prev => prev.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback(
    (message: string, opts: ToastOptions = {}) => {
      const tone = opts.tone ?? 'success'
      const id = nextId.current++
      const duration = opts.duration ?? DEFAULT_DURATION[tone]
      const autoDismiss = opts.autoDismiss ?? true

      setItems(prev => {
        const next = [...prev, { id, message, tone, duration, autoDismiss, action: opts.action }]
        // Drop the oldest overflow rather than growing without bound.
        return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next
      })
      setAnnouncement(message)

      if (autoDismiss) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        )
      }
      return id
    },
    [dismiss],
  )

  useEffect(() => {
    const map = timers.current
    return () => {
      map.forEach(clearTimeout)
      map.clear()
    }
  }, [])

  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <>
            <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
              {announcement}
            </div>
            <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[80] flex flex-col gap-2 pointer-events-none">
              {items.map(t => {
                const s = TONE_STYLE[t.tone]
                return (
                  <div
                    key={t.id}
                    className="pointer-events-auto flex items-center gap-2.5 shadow-lg"
                    style={{
                      maxWidth: '26rem',
                      padding: '0.625rem 0.75rem',
                      background: s.bg,
                      border: `1px solid ${s.border}`,
                      borderRadius: 10,
                      color: s.fg,
                      fontSize: '0.875rem',
                      animation: 'toastIn 0.2s cubic-bezier(0.22, 0.61, 0.36, 1) both',
                    }}
                  >
                    {s.icon && <span className="shrink-0 flex" aria-hidden>{s.icon}</span>}
                    <span className="flex-1">{t.message}</span>
                    {t.action && (
                      <button
                        onClick={() => {
                          t.action?.onClick()
                          dismiss(t.id)
                        }}
                        className="inline-flex items-center gap-1 font-semibold shrink-0"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--primary)',
                          fontSize: '0.8125rem',
                          padding: '0.125rem 0.25rem',
                        }}
                      >
                        <Undo2 size={13} aria-hidden />
                        {t.action.label}
                      </button>
                    )}
                    <button
                      onClick={() => dismiss(t.id)}
                      aria-label="Dismiss notification"
                      className="shrink-0 inline-flex items-center justify-center rounded"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2 }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          </>,
          document.body,
        )}
    </ToastContext.Provider>
  )
}
