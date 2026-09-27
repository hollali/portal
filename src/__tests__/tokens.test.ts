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

/** `marker` -> custom property name -> raw declared value. */
function valuesIn(marker: string): Record<string, string> {
  const start = css.indexOf(marker)
  expect(start, `marker ${marker} not found in globals.css`).toBeGreaterThan(-1)
  const end = css.indexOf('}', start)
  const body = css.slice(start, end)
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gm)) out[m[1]] = m[2].trim()
  return out
}

/* ── Contrast maths (WCAG 2.1 relative luminance) ─────────────── */

type Rgb = [number, number, number]

function parseRgb(value: string): Rgb | null {
  const hex = value.match(/^#([0-9a-f]{6})$/i)
  if (hex) {
    const h = hex[1]
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as Rgb
  }
  const rgba = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i)
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])] as Rgb
  return null
}

function alphaOf(value: string): number {
  const rgba = value.match(/^rgba\([^)]*?,\s*([\d.]+)\s*\)$/i)
  return rgba ? Number(rgba[1]) : 1
}

/** Flattens a possibly translucent token onto an opaque backdrop. */
function flatten(value: string, backdrop: Rgb): Rgb {
  const rgb = parseRgb(value)
  if (!rgb) throw new Error(`unsupported colour literal: ${value}`)
  const a = alphaOf(value)
  return rgb.map((c, i) => c * a + backdrop[i] * (1 - a)) as Rgb
}

function relativeLuminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contrast(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
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

/**
 * Contrast floor per theme. The public surface is the part of the product
 * that actually has to read well, and these are the numbers that used to
 * drift: --p-text-4 sat at 2.38:1 in dark mode (well under AA) and
 * --p-border-3 — the token every input and select is outlined with — was
 * 1.39:1, which fails WCAG 1.4.11 for control boundaries.
 */
describe('public surface contrast', () => {
  const THEMES: { marker: string; label: string }[] = [
    { marker: ':root {', label: 'dark (default)' },
    { marker: '.light {', label: 'light' },
  ]

  for (const { marker, label } of THEMES) {
    describe(label, () => {
      const t = valuesIn(marker)
      const bg = parseRgb(t['--p-bg'])!
      const surface = parseRgb(t['--p-surface'])!

      it.each([
        ['--p-text-1', 'body'],
        ['--p-text-2', 'secondary body'],
        ['--p-text-3', 'meta / labels'],
        ['--p-text-4', 'lowest-emphasis text'],
        ['--primary', 'accent text and icons'],
      ])('%s (%s) reaches AA 4.5:1 on the page and card surfaces', (token, _role) => {
        const fg = flatten(t[token], bg)
        const onBg = contrast(fg, bg)
        const onCard = contrast(fg, surface)
        expect(
          Math.min(onBg, onCard),
          `${token} = ${t[token]} is ${onBg.toFixed(2)}:1 on --p-bg and ${onCard.toFixed(2)}:1 on --p-surface; needs 4.5:1`,
        ).toBeGreaterThanOrEqual(4.5)
      })

      it('--p-border-3 (the control outline) reaches 3:1 on every surface', () => {
        const border = flatten(t['--p-border-3'], bg)
        for (const name of ['--p-bg', '--p-surface', '--p-surface-2', '--p-surface-3'] as const) {
          const ratio = contrast(border, parseRgb(t[name])!)
          expect(
            ratio,
            `--p-border-3 = ${t['--p-border-3']} is ${ratio.toFixed(2)}:1 on ${name}; control boundaries need 3:1 (WCAG 1.4.11)`,
          ).toBeGreaterThanOrEqual(3)
        }
      })

      it('keeps the text ramp monotonically decreasing in contrast', () => {
        const ramp = ['--p-text-1', '--p-text-2', '--p-text-3', '--p-text-4'].map(k =>
          contrast(parseRgb(t[k])!, bg),
        )
        for (let i = 1; i < ramp.length; i++) {
          expect(
            ramp[i],
            `${['--p-text-1', '--p-text-2', '--p-text-3', '--p-text-4'][i]} (${ramp[i].toFixed(2)}:1) must stay dimmer than the step above it (${ramp[i - 1].toFixed(2)}:1)`,
          ).toBeLessThan(ramp[i - 1])
        }
      })
    })
  }
})
