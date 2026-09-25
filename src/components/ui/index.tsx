'use client'

import { useState, useEffect, useRef, useId, ReactNode, MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  maxWidth?: string
  showClose?: boolean
  role?: 'dialog' | 'alertdialog'
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  initialFocusRef?: { current: HTMLElement | null }
}

const FOCUSABLE = 'input, select, textarea, button, [href], [tabindex]:not([tabindex="-1"])'

let scrollLockCount = 0

function lockScroll() {
  scrollLockCount += 1
  if (scrollLockCount === 1) document.body.style.overflow = 'hidden'
}

function unlockScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1)
  if (scrollLockCount === 0) document.body.style.overflow = ''
}

export function Modal({
  open,
  onClose,
  children,
  maxWidth = '600px',
  showClose = true,
  role = 'dialog',
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  initialFocusRef,
}: ModalProps) {
  const [visible, setVisible] = useState(false)
  const [animate, setAnimate] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const lastFocusedRef = useRef<HTMLElement | null>(null)
  const autoTitleId = useId()

  useEffect(() => {
    if (open) {
      const tid = window.setTimeout(() => setVisible(true), 0)
      const rid = requestAnimationFrame(() => setAnimate(true))
      return () => {
        window.clearTimeout(tid)
        cancelAnimationFrame(rid)
      }
    }
    const rid = requestAnimationFrame(() => setAnimate(false))
    const tid = window.setTimeout(() => setVisible(false), 200)
    return () => {
      cancelAnimationFrame(rid)
      window.clearTimeout(tid)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      lastFocusedRef.current = document.activeElement as HTMLElement | null
      lockScroll()
      return () => {
        unlockScroll()
        lastFocusedRef.current?.focus?.()
        lastFocusedRef.current = null
      }
    }
  }, [open])

  useEffect(() => {
    if (!visible || !open) return
    const el = dialogRef.current
    if (!el) return
    if (ariaLabel) el.setAttribute('aria-label', ariaLabel)
    if (!el.getAttribute('aria-labelledby')) {
      const heading = el.querySelector<HTMLElement>('h1, h2, h3')
      if (heading) {
        if (!heading.id) heading.id = `dlg-title-${autoTitleId.replace(/[:]/g, '')}`
        el.setAttribute('aria-labelledby', heading.id)
      }
    }
  }, [visible, open, ariaLabel, autoTitleId])

  useEffect(() => {
    if (visible && open) {
      const el = dialogRef.current
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus()
        return
      }
      const input = el?.querySelector<HTMLElement>('input:not([type="hidden"]), select, textarea')
      if (input) {
        input.focus()
      } else {
        el?.focus()
      }
    }
  }, [visible, open, initialFocusRef])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose, visible])

  if (!visible) return null

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 flex items-center justify-center p-4 z-[70] transition-opacity duration-200"
      style={{
        background: 'rgba(0,0,0,0.85)',
        opacity: animate ? 1 : 0,
        cursor: 'pointer',
      }}
    >
      <div
        ref={dialogRef}
        onClick={e => e.stopPropagation()}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        className="relative w-full overflow-auto transition-all duration-200"
        style={{
          maxWidth,
          maxHeight: '90vh',
          background: 'var(--card)',
          borderRadius: '0.75rem',
          cursor: 'default',
          outline: 'none',
          transform: animate ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(10px)',
          opacity: animate ? 1 : 0,
        }}
      >
        {showClose && (
          <button
            onClick={onClose}
            aria-label="Close dialog"
            title="Close"
            className="absolute top-3 right-3 z-10 flex items-center justify-center rounded-full transition-all duration-200 hover:rotate-90 hover:scale-110"
            style={{
              width: '32px', height: '32px', border: 'none', cursor: 'pointer',
              background: 'var(--muted)', color: 'var(--foreground)',
            }}
          >
            <X size={16} />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body
  )
}

interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  busy = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Modal
      open={open}
      onClose={onClose}
      maxWidth="440px"
      role="alertdialog"
      ariaLabelledBy={titleId}
      ariaDescribedBy={message ? descId : undefined}
      initialFocusRef={cancelRef}
    >
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-bold mb-2 flex items-center gap-2">
          <AlertTriangle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          {title}
        </h2>
        {message && (
          <p id={descId} className="text-sm mb-6" style={{ color: 'var(--muted-foreground)' }}>
            {message}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--foreground)', cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--danger)', border: 'none', color: '#fff', cursor: busy ? 'not-allowed' : 'pointer' }}
          >
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}

interface AnimBtnProps {
  children: ReactNode
  onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void
  title?: string
  /** Required when the button renders an icon only — `title` alone is not announced reliably. */
  'aria-label'?: string
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  type?: 'button' | 'submit' | 'reset'
}

export function AnimBtn({ children, onClick, title, disabled, className = '', style, type = 'button', ...rest }: AnimBtnProps) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      {...rest}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`inline-flex items-center justify-center transition-all duration-200 ease-out ${className}`}
      style={{
        borderRadius: '0.375rem', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        transform: hover && !disabled ? 'scale(1.1)' : 'scale(1)',
        filter: hover && !disabled ? 'brightness(1.15)' : 'brightness(1)',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

interface AnimLinkProps {
  children: ReactNode
  href: string
  target?: string
  rel?: string
  title?: string
  'aria-label'?: string
  className?: string
  style?: React.CSSProperties
}

export function AnimLink({ children, href, target, rel, title, className = '', style, ...rest }: AnimLinkProps) {
  const [hover, setHover] = useState(false)
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      title={title}
      {...rest}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`inline-flex items-center justify-center transition-all duration-200 ease-out no-underline ${className}`}
      style={{
        borderRadius: '0.375rem', cursor: 'pointer', textDecoration: 'none',
        transform: hover ? 'scale(1.1)' : 'scale(1)',
        filter: hover ? 'brightness(1.15)' : 'brightness(1)',
        ...style,
      }}
    >
      {children}
    </a>
  )
}

interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: 'var(--muted)', opacity: 0.3, ...style }}
    />
  )
}

interface ToastProps {
  message: string
  type?: 'success' | 'error'
  onClose: () => void
}

export function Toast({ message, type = 'success', onClose }: ToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 200)
    }, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return createPortal(
    <div
      role="status"
      className="fixed top-4 right-4 left-4 sm:left-auto z-[80] flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg transition-all duration-200"
      style={{
        background: type === 'error' ? 'var(--danger)' : 'var(--success)',
        maxWidth: '24rem',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-10px)',
      }}
    >
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 flex items-center rounded-full p-1 transition-colors hover:bg-white/20" style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
        <X size={14} />
      </button>
    </div>,
    document.body
  )
}

interface EmptyStateProps {
  message: string
  icon?: ReactNode
  action?: ReactNode
}

export function EmptyState({ message, icon, action }: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && <div className="mb-4 opacity-30">{icon}</div>}
      <p style={{ color: 'var(--muted-foreground)' }}>{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

interface SkeletonTableProps {
  rows?: number
  cols?: number
}

export function SkeletonTable({ rows = 5, cols = 4 }: SkeletonTableProps) {
  return (
    <div className="card overflow-hidden">
      <table style={{ width: '100%' }}>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}><Skeleton style={{ height: '12px', width: '60%' }} /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((_, c) => (
                <td key={c}><Skeleton style={{ height: '16px', width: c === 0 ? '30px' : '80%' }} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
