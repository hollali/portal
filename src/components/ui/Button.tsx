'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg'

const SIZES: Record<ButtonSize, { height: number; padding: string; fontSize: number; gap: number }> = {
  xs: { height: 26, padding: '0 0.5rem', fontSize: 0.75, gap: 0.25 },
  sm: { height: 32, padding: '0 0.625rem', fontSize: 0.8125, gap: 0.375 },
  md: { height: 36, padding: '0 0.875rem', fontSize: 0.875, gap: 0.4375 },
  lg: { height: 44, padding: '0 1.125rem', fontSize: 0.9375, gap: 0.5 },
}

function variantStyle(variant: ButtonVariant, disabled: boolean): React.CSSProperties {
  if (disabled) {
    return { background: 'var(--surface)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }
  }
  switch (variant) {
    case 'primary':
      return { background: 'var(--primary)', color: 'var(--primary-fg)', border: '1px solid transparent' }
    case 'danger':
      return { background: 'var(--danger)', color: '#fff', border: '1px solid transparent' }
    case 'secondary':
      return { background: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)' }
    case 'outline':
      return { background: 'transparent', color: 'var(--foreground)', border: '1px solid var(--border)' }
    case 'ghost':
      return { background: 'transparent', color: 'var(--muted-foreground)', border: '1px solid transparent' }
  }
}

/**
 * The single button primitive for the CMS.
 *
 * Interaction is expressed through surface + border + colour shifts rather
 * than a `transform: scale()` on hover. Scaling a control moves the hit
 * target out from under the pointer, which makes small icon buttons
 * (26px) genuinely easy to mis-click.
 */
export interface ButtonBaseProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
}

/**
 * An icon-only button has no text to announce, so it is not usable without a
 * label. Rather than trusting every call site to remember, the prop is modelled
 * as a union: `iconOnly` and a label must be supplied together.
 */
export type ButtonProps = ButtonBaseProps &
  (
    | { iconOnly: true; 'aria-label': string; 'aria-labelledby'?: string }
    | { iconOnly?: false; 'aria-label'?: string; 'aria-labelledby'?: string }
  )

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    iconOnly = false,
    iconLeft,
    iconRight,
    disabled,
    children,
    className = '',
    style,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading
  const s = SIZES[size]

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`ui-btn inline-flex items-center justify-center font-semibold whitespace-nowrap select-none ${className}`}
      data-variant={variant}
      data-size={size}
      style={{
        height: s.height,
        minWidth: iconOnly ? s.height : undefined,
        padding: iconOnly ? 0 : s.padding,
        fontSize: s.fontSize,
        gap: s.gap,
        borderRadius: size === 'sm' || size === 'xs' ? 6 : 8,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        ...variantStyle(variant, Boolean(isDisabled)),
        ...style,
      }}
      {...rest}
    >
      {loading ? <Loader2 size={s.fontSize + 2} className="ui-btn-spin" aria-hidden /> : iconLeft}
      {iconOnly ? (
        // The accessible name of an icon-only button comes from `aria-label`,
        // so the glyph must never contribute to it (and must not be announced
        // as a graphic in its own right).
        <span aria-hidden className="inline-flex items-center justify-center">
          {children}
        </span>
      ) : (
        children
      )}
      {iconRight}
    </button>
  )
})
