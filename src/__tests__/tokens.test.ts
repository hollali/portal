import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const css = readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8')

/** Custom properties declared inside the block that starts at `marker`. */
function tokensIn(marker: string): Set<string> {
  const start = css.indexOf(marker)
  expect(start, `marker ${marker} not found in globals.css`).toBeGreaterThan(-1)
  const end = css.indexOf('}', start)
  const body = css.slice(start, end)
  return new Set([...body.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map(m => m[1]))
}

/** Tokens set at runtime by next/font or by an inline script, not in CSS. */
const RUNTIME_ONLY = new Set([
  '--font-inter',
  '--font-display',
  '--font-serif',
  '--font-mono',
  '--marquee-duration',
  '--spot-x',
  '--spot-y',
  '--p-text-3',
  '--focus-ring-color',
  '--focus-ring-width',
  '--focus-ring-style',
  '--focus-ring-offset',
])

/** Theme-independent layout metrics that intentionally live in :root only. */
// Structural tokens that are identical in both themes, so they are declared
// only in `:root` and must not be duplicated into `.light`.
const ROOT_ONLY = new Set(['--sidebar-width', '--table-min'])

describe('design tokens', () => {
  const root = tokensIn(':root {')
  const light = tokensIn('.light {')

  it('every var() reference resolves to a declared token', () => {
    const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map(m => m[1]))
    const undeclared = [...used].filter(t => !root.has(t) && !light.has(t) && !RUNTIME_ONLY.has(t))
    // An undefined custom property makes `background: var(--x)` invalid at
    // computed-value time, so the declaration is silently dropped and the
    // element renders transparent. That is how --surface went unnoticed.
    expect(undeclared, 'referenced but never declared').toEqual([])
  })

  it('.light declares every colour token that :root declares', () => {
    const missing = [...root].filter(t => !light.has(t) && !ROOT_ONLY.has(t))
    expect(missing, 'tokens declared in :root but not .light').toEqual([])
  })

  it('.light does not invent tokens that :root lacks', () => {
    const extra = [...light].filter(t => !root.has(t))
    expect(extra, 'tokens declared in .light but not :root').toEqual([])
  })

  it('keeps the palette to two sources, with no prefers-color-scheme copy', () => {
    // A third copy is how the token set drifted out of sync before.
    expect(css).not.toMatch(/@media\s*\(prefers-color-scheme:\s*light\)/)
  })

  it('defines the three-step elevation ladder', () => {
    for (const t of ['--background', '--card', '--surface']) {
      expect(root.has(t), `${t} missing from :root`).toBe(true)
      expect(light.has(t), `${t} missing from .light`).toBe(true)
    }
  })

  it('no longer uses the *-rgb channel tokens', () => {
    // Replaced by color-mix(), because the hardcoded fallbacks were a stale
    // shadcn navy that appeared nowhere in the theme.
    expect(css).not.toMatch(/--(primary|success|danger|warning)-rgb/)
  })
})
