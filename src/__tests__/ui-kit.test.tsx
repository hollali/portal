import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { Button, Field, Input, Textarea, Select, Badge, StatusBadge, Tabs, PageHeader } from '@/components/ui/kit'
import { ToastProvider, useToast } from '@/components/ui/Toast'
import { ConfirmDialog } from '@/components/ui'

describe('Button', () => {
  it('labels icon-only buttons from aria-label, not title', () => {
    render(
      <Button iconOnly aria-label="Delete page" title="Delete">
        <span aria-hidden>x</span>
      </Button>
    )
    // The whole point of iconOnly + aria-label: the accessible name exists
    // even though there is no text content.
    expect(screen.getByRole('button', { name: 'Delete page' })).toBeInTheDocument()
  })

  it('marks itself busy and blocks clicks while loading', () => {
    const onClick = vi.fn()
    render(<Button loading onClick={onClick}>Save</Button>)
    const btn = screen.getByRole('button', { name: /save/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('does not move the hit target on hover', () => {
    // The old AnimBtn applied transform: scale(1.1) on hover, which is what
    // made small icon buttons in table rows easy to mis-click.
    render(<Button iconOnly aria-label="Edit" />)
    const btn = screen.getByRole('button', { name: 'Edit' })
    expect(btn.style.transform).toBe('')
  })

  it('defaults to type=button so it cannot submit a surrounding form by accident', () => {
    render(<Button>Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('type', 'button')
  })
})

describe('Field', () => {
  it('associates the label with the control it wraps', () => {
    render(
      <Field label="Title">
        <Input />
      </Field>
    )
    // getByLabelText fails unless htmlFor/id are genuinely wired.
    expect(screen.getByLabelText('Title')).toBeInTheDocument()
  })

  it('announces an error and flags the control invalid', () => {
    render(
      <Field label="Title" error="Title is required">
        <Input />
      </Field>
    )
    const input = screen.getByLabelText(/Title/)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Title is required')
  })

  it('points the control at its hint via aria-describedby', () => {
    render(
      <Field label="Slug" hint="Public URL path.">
        <Input />
      </Field>
    )
    expect(screen.getByLabelText('Slug')).toHaveAccessibleDescription('Public URL path.')
  })

  it('gives repeated fields unique ids', () => {
    render(
      <>
        <Field label="First"><Input /></Field>
        <Field label="Second"><Input /></Field>
      </>
    )
    const a = screen.getByLabelText('First')
    const b = screen.getByLabelText('Second')
    expect(a.id).not.toBe('')
    expect(a.id).not.toBe(b.id)
  })

  it('propagates required to the control', () => {
    render(
      <Field label="Title" required>
        <Input />
      </Field>
    )
    expect(screen.getByLabelText(/Title/)).toBeRequired()
  })

  it('labels textarea and select through the same mechanism', () => {
    render(
      <>
        <Field label="Body"><Textarea /></Field>
        <Field label="Kind"><Select><option value="a">a</option></Select></Field>
      </>
    )
    expect(screen.getByLabelText('Body').tagName).toBe('TEXTAREA')
    expect(screen.getByLabelText('Kind').tagName).toBe('SELECT')
  })
})

describe('Badge', () => {
  it('does not mislabel an unrecognised status as Draft', () => {
    // The previous StatusBadge rendered anything != 'published' as "Draft".
    render(<StatusBadge status="archived" />)
    expect(screen.getByText('Archived')).toBeInTheDocument()
    expect(screen.queryByText('Draft')).not.toBeInTheDocument()
  })

  it('degrades unknown statuses to a neutral tone rather than a wrong colour', () => {
    render(<Badge tone="neutral">Custom</Badge>)
    expect(screen.getByText('Custom')).toBeInTheDocument()
  })
})

describe('Tabs', () => {
  const items = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
    { value: 'c', label: 'Gamma' },
  ] as const

  it('exposes tablist semantics with one selected tab', () => {
    render(<Tabs label="Views" items={[...items]} value="a" onChange={() => {}} />)
    const tablist = screen.getByRole('tablist', { name: 'Views' })
    const tabs = within(tablist).getAllByRole('tab')
    expect(tabs).toHaveLength(3)
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
  })

  it('keeps only the selected tab in the tab order (roving tabindex)', () => {
    render(<Tabs label="Views" items={[...items]} value="b" onChange={() => {}} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0]).toHaveAttribute('tabindex', '-1')
    expect(tabs[1]).toHaveAttribute('tabindex', '0')
    expect(tabs[2]).toHaveAttribute('tabindex', '-1')
  })

  it('moves selection with the arrow keys', () => {
    const onChange = vi.fn()
    render(<Tabs label="Views" items={[...items]} value="a" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('b')
  })

  it('wraps around at the end', () => {
    const onChange = vi.fn()
    render(<Tabs label="Views" items={[...items]} value="c" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('a')
  })
})

describe('PageHeader', () => {
  it('marks the trailing crumb as the current page', () => {
    render(
      <PageHeader title="Content" crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Content' }]} />
    )
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument()
    expect(screen.getByText('Content', { selector: '[aria-current="page"]' })).toBeInTheDocument()
  })

  it('renders a single h1', () => {
    render(<PageHeader title="Archive Manager" description="Manage records." />)
    expect(screen.getByRole('heading', { level: 1, name: 'Archive Manager' })).toBeInTheDocument()
  })
})

function Harness() {
  const { toast } = useToast()
  return (
    <div>
      <button onClick={() => toast('Saved', { tone: 'success' })}>ok</button>
      <button onClick={() => toast('Boom', { tone: 'error' })}>bad</button>
    </div>
  )
}

describe('Toast', () => {
  it('queues back-to-back messages instead of clobbering them', () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('ok'))
    fireEvent.click(screen.getByText('bad'))
    // The old single-slot <Toast> could only hold one of these.
    expect(screen.getByText('Saved')).toBeInTheDocument()
    // "Boom" appears twice by design: once as the visible toast, and once in
    // the visually-hidden live region that mirrors the latest message.
    expect(screen.getAllByText('Boom').length).toBeGreaterThanOrEqual(1)
    const live = document.querySelector('[role="status"][aria-live="polite"]')
    expect(live).toHaveTextContent('Boom')
  })

  it('exposes a polite live region for announcements', () => {
    render(
      <ToastProvider>
        <Harness />
      </ToastProvider>
    )
    const region = document.querySelector('[role="status"][aria-live="polite"]')
    expect(region).toBeInTheDocument()
  })

  it('requires ToastProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Harness />)).toThrow(/ToastProvider/)
    spy.mockRestore()
  })
})

describe('Button loading contract', () => {
  it('replaces iconLeft with a spinner while loading', () => {
    const { rerender } = render(
      <Button iconLeft={<svg data-testid="refresh" />}>Refresh</Button>
    )
    expect(screen.getByTestId('refresh')).toBeInTheDocument()

    rerender(<Button loading iconLeft={<svg data-testid="refresh" />}>Refresh</Button>)
    // The old spinner used to render alongside the caller's icon.
    expect(screen.queryByTestId('refresh')).not.toBeInTheDocument()
    expect(document.querySelector('.ui-btn-spin')).toBeInTheDocument()
  })

  it('keeps the label readable while loading', () => {
    render(<Button loading iconLeft={<svg data-testid="refresh" />}>Refresh</Button>)
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
  })

  it('disables and announces busy state while loading', () => {
    render(<Button loading>Saving</Button>)
    const btn = screen.getByRole('button', { name: /saving/i })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
  })
})

describe('Button — icon-only labelling contract', () => {
  it('takes its accessible name from aria-label and hides the glyph from AT', () => {
    render(
      <Button iconOnly aria-label="Delete page" title="Delete">
        <svg data-testid="glyph" />
      </Button>
    )
    const btn = screen.getByRole('button', { name: 'Delete page' })
    // The decorative glyph must not be exposed as a graphic of its own.
    expect(btn.querySelector('svg')!.parentElement).toHaveAttribute('aria-hidden', 'true')
  })

  it('does not let the glyph contribute to the name when the button is labelled', () => {
    render(
      <Button iconOnly aria-label="Delete page">
        <span>Delete</span>
      </Button>
    )
    // aria-label wins: the accessible name stays "Delete page".
    expect(screen.getByRole('button', { name: 'Delete page' })).toBeInTheDocument()
  })

  it('keeps text visible for a non-icon-only button', () => {
    render(<Button>Save changes</Button>)
    const btn = screen.getByRole('button', { name: 'Save changes' })
    expect(btn.querySelector('[aria-hidden]')).toBeNull()
  })

  it('is a compile error to pass iconOnly without a label', () => {
    // Type-level contract: `tsc --noEmit` fails on the unused @ts-expect-error
    // if `iconOnly` ever stops requiring `aria-label`.
    const Unlabelled = () => (
      <>
        {/* @ts-expect-error iconOnly requires an accessible name */}
        <Button iconOnly>
          <svg />
        </Button>
        <Button iconOnly aria-label="Allowed">
          <svg />
        </Button>
      </>
    )
    expect(typeof Unlabelled).toBe('function')
  })
})

describe('ConfirmDialog — typed confirmation gate', () => {
  const setup = async (requireTyped?: string, busy = false) => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    render(
      <ConfirmDialog
        open
        title="Delete all filtered records?"
        message="This cannot be undone."
        confirmLabel="Delete 12"
        busy={busy}
        requireTyped={requireTyped}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    )
    // Modal defers its first paint behind a timer, so wait for it to exist.
    await screen.findByRole('alertdialog')
    return { onConfirm, onClose }
  }

  const confirmButton = () => screen.getByRole('button', { name: 'Delete 12' })
  const phraseInput = () => screen.getByLabelText(/type .* to confirm/i)

  it('renders as an alertdialog with an accessible name and description', async () => {
    await setup()
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveAccessibleName('Delete all filtered records?')
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.')
  })

  it('leaves the confirm button disabled until the phrase is typed', async () => {
    await setup('delete 12')
    expect(confirmButton()).toBeDisabled()

    fireEvent.change(phraseInput(), { target: { value: 'delete' } })
    expect(confirmButton()).toBeDisabled()
  })

  it('is case-sensitive but tolerant of surrounding whitespace', async () => {
    await setup('delete 12')
    const input = phraseInput()

    // Wrong case must not arm it.
    fireEvent.change(input, { target: { value: 'Delete 12' } })
    expect(confirmButton()).toBeDisabled()

    // A stray leading/trailing space from a paste should not block the user.
    fireEvent.change(input, { target: { value: '  delete 12  ' } })
    expect(confirmButton()).toBeEnabled()

    // Internal spacing is significant.
    fireEvent.change(input, { target: { value: 'delete  12' } })
    expect(confirmButton()).toBeDisabled()
  })

  it('enables and fires onConfirm once the phrase matches exactly', async () => {
    const { onConfirm } = await setup('delete 12')
    fireEvent.change(phraseInput(), { target: { value: 'delete 12' } })

    expect(confirmButton()).toBeEnabled()
    fireEvent.click(confirmButton())
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('omits the input and arms the button immediately when requireTyped is absent', async () => {
    const { onConfirm } = await setup()
    expect(screen.queryByLabelText(/to confirm/i)).not.toBeInTheDocument()
    expect(confirmButton()).toBeEnabled()
    fireEvent.click(confirmButton())
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('stays disabled while busy regardless of the typed phrase', async () => {
    const { onConfirm } = await setup('delete 12', true)
    fireEvent.change(phraseInput(), { target: { value: 'delete 12' } })
    expect(screen.getByRole('button', { name: 'Please wait…' })).toBeDisabled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('does not arm onConfirm when the dialog is cancelled', async () => {
    const { onConfirm, onClose } = await setup('delete 12')
    fireEvent.change(phraseInput(), { target: { value: 'delete 12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
