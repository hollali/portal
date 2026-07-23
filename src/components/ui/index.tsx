'use client'

import { useState, useEffect, ReactNode, MouseEvent as ReactMouseEvent } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  maxWidth?: string
  showClose?: boolean
}

export function Modal({ open, onClose, children, maxWidth = '600px', showClose = true }: ModalProps) {
  const [visible, setVisible] = useState(false)
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    if (open) {
      setVisible(true)
      requestAnimationFrame(() => setAnimate(true))
    } else {
      setAnimate(false)
      const timer = setTimeout(() => setVisible(false), 200)
      return () => clearTimeout(timer)
    }
  }, [open])

  useEffect(() => {
    if (open) {
      const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }
  }, [open, onClose])

  if (!visible) return null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 flex items-center justify-center p-4 z-50 transition-opacity duration-200"
      style={{
        background: 'rgba(0,0,0,0.85)',
        opacity: animate ? 1 : 0,
        cursor: 'pointer',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full overflow-auto transition-all duration-200"
        style={{
          maxWidth,
          maxHeight: '90vh',
          background: 'var(--card)',
          borderRadius: '0.75rem',
          cursor: 'default',
          transform: animate ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(10px)',
          opacity: animate ? 1 : 0,
        }}
      >
        {showClose && (
          <button
            onClick={onClose}
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
    </div>
  )
}

interface AnimBtnProps {
  children: ReactNode
  onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void
  title?: string
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  type?: 'button' | 'submit' | 'reset'
}

export function AnimBtn({ children, onClick, title, disabled, className = '', style, type = 'button' }: AnimBtnProps) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
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
  className?: string
  style?: React.CSSProperties
}

export function AnimLink({ children, href, target, rel, title, className = '', style }: AnimLinkProps) {
  const [hover, setHover] = useState(false)
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      title={title}
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

  return (
    <div
      className="flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg transition-all duration-200"
      style={{
        background: type === 'error' ? 'var(--danger)' : 'var(--success)',
        marginBottom: '1rem',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-10px)',
      }}
    >
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 flex items-center rounded-full p-1 transition-colors hover:bg-white/20" style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
        <X size={14} />
      </button>
    </div>
  )
}

interface EmptyStateProps {
  message: string
  icon?: ReactNode
}

export function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && <div className="mb-4 opacity-30">{icon}</div>}
      <p style={{ color: 'var(--muted-foreground)' }}>{message}</p>
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
