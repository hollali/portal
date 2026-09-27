'use client'

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { ChevronDown } from 'lucide-react'

export interface DropdownMenuItem {
  key: string
  label: ReactNode
  onSelect: () => void
  icon?: ReactNode
  /** Renders in the danger tone and, when it is the only item, is used for `Cancel`. */
  danger?: boolean
  disabled?: boolean
  /** Draws a rule above this item to separate it from the group above. */
  separated?: boolean
}

export interface DropdownMenuProps {
  /** The control that opens the menu. Receeds the ARIA wiring it needs. */
  trigger: ReactElement<Record<string, unknown>>
  items: DropdownMenuItem[]
  align?: 'start' | 'end'
  /** Accessible name for the menu, e.g. "Account actions". */
  label: string
  className?: string
}

const MENU_KEYS = new Set([
  'ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape', 'Tab', 'Enter', ' ',
])

/**
 * A minimal menu-button dropdown.
 *
 * Follows the WAI-ARIA menu-button pattern: the trigger owns
 * `aria-haspopup`/`aria-expanded`, the menu is `role="menu"`, and items are
 * `role="menuitem"` reached with a roving tabindex. Escape closes and returns
 * focus to the trigger; Tab closes without trapping the user.
 *
 * Deliberately not a general popover: positioned with CSS rather than
 * floating-ui, so it must stay inside a relatively-positioned ancestor with
 * room below the trigger.
 */
export function DropdownMenu({ trigger, items, align = 'end', label, className = '' }: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const menuId = useId()
  const enabledIndexes = items.map((it, i) => (it.disabled ? -1 : i)).filter(i => i !== -1)

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false)
    setActiveIndex(-1)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  // Close on outside pointerdown.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const focusItem = (index: number) => {
    const el = itemRefs.current[index]
    el?.focus()
  }

  const openAndFocus = (index: number) => {
    setOpen(true)
    setActiveIndex(index)
    // The menu is not mounted until after this commit.
    requestAnimationFrame(() => focusItem(index))
  }

  const onTriggerKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (enabledIndexes.length > 0) openAndFocus(enabledIndexes[0])
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (enabledIndexes.length > 0) openAndFocus(enabledIndexes[enabledIndexes.length - 1])
    }
  }

  const onMenuKeyDown = (e: ReactKeyboardEvent) => {
    if (!MENU_KEYS.has(e.key)) return
    const current = enabledIndexes.indexOf(activeIndex)

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        {
          const next = enabledIndexes[(current + 1 + enabledIndexes.length) % enabledIndexes.length]
          setActiveIndex(next)
          focusItem(next)
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        {
          const prev = enabledIndexes[(current - 1 + enabledIndexes.length) % enabledIndexes.length]
          setActiveIndex(prev)
          focusItem(prev)
        }
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(enabledIndexes[0])
        focusItem(enabledIndexes[0])
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(enabledIndexes[enabledIndexes.length - 1])
        focusItem(enabledIndexes[enabledIndexes.length - 1])
        break
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        close(true)
        break
      case 'Tab':
        // Do not trap Tab inside the menu.
        close(false)
        break
      case 'Enter':
      case ' ':
        if (activeIndex >= 0 && items[activeIndex]) {
          e.preventDefault()
          items[activeIndex].onSelect()
          close(true)
        }
        break
    }
  }

  const select = (item: DropdownMenuItem) => {
    if (item.disabled) return
    item.onSelect()
    close(true)
  }

  if (!isValidElement(trigger)) return null

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {cloneElement(trigger, {
        ref: triggerRef,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': open ? menuId : undefined,
        onClick: (e: React.MouseEvent) => {
          ;(trigger.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e)
          // A menu with nothing selectable must not open at all.
          if (enabledIndexes.length > 0) setOpen(o => !o)
        },
        onKeyDown: (e: ReactKeyboardEvent) => {
          ;(trigger.props as { onKeyDown?: (e: ReactKeyboardEvent) => void }).onKeyDown?.(e)
          onTriggerKeyDown(e)
        },
      })}

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className="ui-menu absolute z-50 mt-1 min-w-[13rem] rounded-lg p-1"
          style={{
            top: '100%',
            left: align === 'end' ? 'auto' : 0,
            right: align === 'end' ? 0 : 'auto',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg, 0 12px 32px rgba(0,0,0,0.35))',
          }}
        >
          {items.map((item, i) => (
            <button
              key={item.key}
              ref={el => { itemRefs.current[i] = el }}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              tabIndex={i === activeIndex ? 0 : -1}
              onClick={() => select(item)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`ui-menu-item flex w-full items-center gap-2 rounded-md text-left text-sm ${
                item.separated ? 'mt-1 border-t pt-1' : ''
              }`}
              style={{
                padding: '0.5rem 0.625rem',
                color: item.danger ? 'var(--danger)' : 'var(--foreground)',
                background: 'transparent',
                border: 'none',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                opacity: item.disabled ? 0.5 : 1,
              }}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** The caret affordance shared by every menu trigger. */
export function MenuCaret() {
  return <ChevronDown size={14} aria-hidden />
}
