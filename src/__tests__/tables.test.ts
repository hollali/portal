import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Guards the two table defects that are invisible in a desktop screenshot:
 * a `<th>` without `scope="col"`, and a card-layout `<td>` with no
 * `data-label` (which silently renders with an empty label on mobile).
 */
const ROOTS = ['src/app/(portal)', 'src/components']

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.tsx') ? [full] : []
  })
}

const files = ROOTS.flatMap(walk)

/** Splits a file into `<table>...</table>` blocks. */
function tablesIn(source: string): string[] {
  return source.match(/<table[\s>][\s\S]*?<\/table>/g) ?? []
}

describe('admin tables', () => {
  it('finds the tables it is meant to check', () => {
    // Guards against a broken path or glob silently making this suite vacuous.
    expect(files.length).toBeGreaterThan(10)
    expect(tablesIn(files.map(f => readFileSync(f, 'utf8')).join('\n')).length).toBeGreaterThan(5)
  })

  describe.each(files)('%s', file => {
    const source = readFileSync(file, 'utf8')

    it('gives every column header an explicit scope', () => {
      const offenders = tablesIn(source).flatMap(table => {
        const thead = table.match(/<thead>[\s\S]*?<\/thead>/)?.[0] ?? ''
        return [...thead.matchAll(/<th\b([^>]*)>/g)]
          .map(m => m[1])
          // The row-header cells in the key/value health table are correct
          // as-is; only column headers in a thead are checked.
          .filter(attrs => !/scope=/.test(attrs))
          .map(attrs => attrs.trim().slice(0, 40))
      })
      expect(offenders).toEqual([])
    })

    it('labels every cell of a card-layout table', () => {
      const offenders: string[] = []
      for (const wrapper of source.match(/table-wrap table-cards[\s\S]*?<\/table>/g) ?? []) {
        const tbody = wrapper.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0]
        if (!tbody) continue
        for (const m of tbody.matchAll(/<td\b([^>]*)>/g)) {
          const attrs = m[1]
          if (!/data-label=/.test(attrs) && !/className="[^"]*select-cell/.test(attrs)) {
            offenders.push(attrs.trim().slice(0, 40) || '(no attributes)')
          }
        }
      }
      expect(offenders).toEqual([])
    })
  })
})
