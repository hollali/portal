'use client'

import {
  createContext,
  useContext,
  useId,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
} from 'react'

interface FieldCtx {
  controlId: string
  hintId: string
  errorId: string
  invalid: boolean
  required: boolean
  describedBy: string | undefined
  disabled: boolean
}

const FieldContext = createContext<FieldCtx | null>(null)

function useField(): FieldCtx | null {
  return useContext(FieldContext)
}

const controlBase: React.CSSProperties = {
  width: '100%',
  background: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--foreground)',
  padding: '0 0.75rem',
  height: 36,
  fontSize: '0.875rem',
  transition: 'border-color 0.15s, background 0.15s',
}

export interface FieldProps {
  label: string
  children: ReactNode
  hint?: string
  error?: string
  required?: boolean
  className?: string
  /** Visually hides the label but keeps it for assistive tech. */
  hideLabel?: boolean
}

/**
 * Wraps a control with a real <label for>, an optional hint, and an error
 * message. Inputs rendered inside pick up the generated ids and set
 * aria-invalid / aria-describedby automatically — so a labelled control can
 * never end up unlabelled, and an error is always announced with its field.
 */
export function Field({ label, children, hint, error, required, className = '', hideLabel }: FieldProps) {
  const uid = useId().replace(/:/g, '')
  const controlId = `f-${uid}`
  const hintId = `f-${uid}-hint`
  const errorId = `f-${uid}-err`

  const invalid = Boolean(error)
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <FieldContext.Provider value={{ controlId, hintId, errorId, invalid, required: Boolean(required), describedBy, disabled: false }}>
      <div className={className}>
        <label
          htmlFor={controlId}
          className={hideLabel ? 'sr-only' : 'block text-xs font-semibold mb-1'}
          style={{ color: 'var(--muted-foreground)' }}
        >
          {label}
          {required && (
            <span aria-hidden style={{ color: 'var(--danger)', marginLeft: 2 }}>
              *
            </span>
          )}
        </label>
        {children}
        {hint && !error && (
          <p id={hintId} className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs mt-1 font-medium" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  )
}

/** `<Field label required>` without a wrapping element, for use with Checkbox. */
export function useFieldIds() {
  const uid = useId().replace(/:/g, '')
  return { controlId: `f-${uid}`, hintId: `f-${uid}-hint`, errorId: `f-${uid}-err` }
}

function useFieldProps(ownId?: string, ownDescribedBy?: string) {
  const field = useField()
  return {
    id: ownId ?? field?.controlId,
    'aria-invalid': field?.invalid || undefined,
    'aria-describedby': ownDescribedBy ?? field?.describedBy,
    required: field?.required || undefined,
  }
}

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className = '', style, ...rest }: InputProps) {
  const p = useFieldProps(rest.id, rest['aria-describedby'])
  return (
    <input
      {...p}
      {...rest}
      className={`ui-input ${className}`}
      data-invalid={p['aria-invalid'] || undefined}
      style={{ ...controlBase, ...style }}
    />
  )
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  minHeight?: number
}

export function Textarea({ className = '', style, minHeight = 90, rows, ...rest }: TextareaProps) {
  const p = useFieldProps(rest.id, rest['aria-describedby'])
  return (
    <textarea
      {...p}
      {...rest}
      rows={rows}
      className={`ui-input ${className}`}
      data-invalid={p['aria-invalid'] || undefined}
      style={{ ...controlBase, height: 'auto', minHeight, padding: '0.5rem 0.75rem', lineHeight: 1.55, ...style }}
    />
  )
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export function Select({ className = '', style, children, ...rest }: SelectProps) {
  const p = useFieldProps(rest.id, rest['aria-describedby'])
  return (
    <select
      {...p}
      {...rest}
      className={`ui-input ui-select ${className}`}
      data-invalid={p['aria-invalid'] || undefined}
      style={{ ...controlBase, paddingRight: '2rem', cursor: 'pointer', appearance: 'none', ...style }}
    >
      {children}
    </select>
  )
}
