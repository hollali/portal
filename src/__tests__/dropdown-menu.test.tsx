import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DropdownMenu, type DropdownMenuItem } from '@/components/ui/DropdownMenu'
import { Button } from '@/components/ui/Button'

const items = (onSelect = vi.fn()): DropdownMenuItem[] => [
  { key: 'a', label: 'Edit profile', onSelect },
  { key: 'b', label: 'Disabled thing', onSelect, disabled: true },
  { key: 'c', label: 'Sign out', onSelect, danger: true, separated: true },
]

function setup(customItems = items()) {
  render(
    <DropdownMenu
      label="Account actions"
      items={customItems}
      trigger={<Button variant="secondary">Account</Button>}
    />
  )
  return { trigger: screen.getByRole('button', { name: /account/i }), onSelect: customItems[0].onSelect }
}

const openMenu = (trigger: HTMLElement) => {
  fireEvent.click(trigger)
  return screen.getByRole('menu', { name: 'Account actions' })
}

describe('DropdownMenu', () => {
  it('exposes the WAI-ARIA menu-button wiring on the trigger', () => {
    const { trigger } = setup()
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('toggles aria-expanded and reveals the menu', () => {
    const { trigger } = setup()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    openMenu(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('gives the menu an accessible name', () => {
    const { trigger } = setup()
    openMenu(trigger)
    expect(screen.getByRole('menu', { name: 'Account actions' })).toBeInTheDocument()
  })

  it('marks every entry as a menuitem', () => {
    const { trigger } = setup()
    openMenu(trigger)
    expect(screen.getAllByRole('menuitem')).toHaveLength(3)
  })

  it('opens onto the first enabled item with ArrowDown', () => {
    const { trigger } = setup()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    // requestAnimationFrame is async in jsdom; flush it.
    return new Promise<void>(r => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          expect(screen.getByRole('menuitem', { name: /edit profile/i })).toHaveFocus()
          r()
        })
      })
    })
  })

  it('opens onto the last enabled item with ArrowUp', async () => {
    const { trigger } = setup()
    fireEvent.keyDown(trigger, { key: 'ArrowUp' })
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toHaveFocus()
  })

  it('ArrowDown skips disabled items', async () => {
    const { trigger } = setup()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowDown' })
    // "Disabled thing" sits between the two, so this must land on "Sign out".
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toHaveFocus()
  })

  it('wraps from the last item to the first', async () => {
    const { trigger } = setup()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    const menu = screen.getByRole('menu')
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(screen.getByRole('menuitem', { name: /edit profile/i })).toHaveFocus()
  })

  it('ArrowUp from the first item wraps to the last', async () => {
    const { trigger } = setup()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'ArrowUp' })
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toHaveFocus()
  })

  it('Home and End jump to the first and last enabled items', async () => {
    const { trigger } = setup()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    const menu = screen.getByRole('menu')

    fireEvent.keyDown(menu, { key: 'End' })
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toHaveFocus()

    fireEvent.keyDown(menu, { key: 'Home' })
    expect(screen.getByRole('menuitem', { name: /edit profile/i })).toHaveFocus()
  })

  it('Escape closes the menu and returns focus to the trigger', async () => {
    const { trigger } = setup()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('Tab closes without pulling focus back to the trigger', async () => {
    const { trigger } = setup()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).not.toHaveFocus()
  })

  it('activates an item with the keyboard and then closes', async () => {
    const onSelect = vi.fn()
    const { trigger } = setup(items(onSelect))
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('activates an item on click and returns focus to the trigger', () => {
    const onSelect = vi.fn()
    const { trigger } = setup(items(onSelect))
    openMenu(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: /edit profile/i }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('does not activate a disabled item', () => {
    const onSelect = vi.fn()
    const { trigger } = setup(items(onSelect))
    openMenu(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: /disabled thing/i }))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('closes on an outside pointerdown', () => {
    const { trigger } = setup()
    openMenu(trigger)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('stays open when the pointerdown lands inside the menu', () => {
    const { trigger } = setup()
    openMenu(trigger)
    fireEvent.pointerDown(screen.getByRole('menu'))
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('uses a roving tabindex so only the active item is tabbable', () => {
    const { trigger } = setup()
    openMenu(trigger)
    const items = screen.getAllByRole('menuitem')
    // Nothing is active before the first keyboard interaction, so every item
    // is out of the tab order rather than all being reachable.
    expect(items.every(i => i.getAttribute('tabindex') === '-1')).toBe(true)
  })

  it('does not open on keyboard when every item is disabled', () => {
    const allDisabled: DropdownMenuItem[] = [
      { key: 'x', label: 'Nothing', onSelect: vi.fn(), disabled: true },
    ]
    const { trigger } = setup(allDisabled)
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('does not open on click when every item is disabled', () => {
    const allDisabled: DropdownMenuItem[] = [
      { key: 'x', label: 'Nothing', onSelect: vi.fn(), disabled: true },
    ]
    const { trigger } = setup(allDisabled)
    fireEvent.click(trigger)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })
})
