'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const [jumpValue, setJumpValue] = useState('')

  if (totalPages <= 1) return null

  const handleJump = () => {
    const num = parseInt(jumpValue)
    if (num >= 1 && num <= totalPages) {
      onPageChange(num)
      setJumpValue('')
    }
  }

  const visiblePages: (number | '...')[] = []
  const maxVisible = 7

  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) visiblePages.push(i)
  } else {
    visiblePages.push(1)
    if (page > 3) visiblePages.push('...')
    const start = Math.max(2, page - 1)
    const end = Math.min(totalPages - 1, page + 1)
    for (let i = start; i <= end; i++) visiblePages.push(i)
    if (page < totalPages - 2) visiblePages.push('...')
    visiblePages.push(totalPages)
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-1 mt-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-sm transition-all hover:bg-[var(--primary)] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
      >
        <ChevronLeft size={14} /> Prev
      </button>

      {visiblePages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="px-2 text-sm" style={{ color: 'var(--muted)' }}>...</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className="inline-flex items-center justify-center rounded border px-2 py-1 text-sm transition-all hover:scale-105"
            style={{
              background: p === page ? 'var(--primary)' : 'var(--card)',
              borderColor: p === page ? 'var(--primary)' : 'var(--border)',
              color: p === page ? 'white' : 'var(--foreground)',
              fontWeight: p === page ? 700 : 400,
            }}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-sm transition-all hover:bg-[var(--primary)] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
      >
        Next <ChevronRight size={14} />
      </button>

      {totalPages > 5 && (
        <div className="flex items-center gap-1 ml-2">
          <span className="text-xs" style={{ color: 'var(--muted)' }}>Go to</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={jumpValue}
            onChange={e => setJumpValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJump()}
            placeholder="#"
            className="w-12 rounded border px-1 py-0.5 text-xs text-center"
            style={{ background: 'var(--background)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          />
          <button
            onClick={handleJump}
            className="rounded border px-1.5 py-0.5 text-xs transition-all hover:scale-105"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)', cursor: 'pointer' }}
          >
            Go
          </button>
        </div>
      )}
    </div>
  )
}
