import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Modal } from '@/components/ui'
import { Pagination } from '@/components/ui/Pagination'

describe('Modal', () => {
  it('renders children when open', () => {
    render(
      <Modal open onClose={() => {}}>
        <p>Modal content</p>
      </Modal>
    )
    expect(screen.getByText('Modal content')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <Modal open={false} onClose={() => {}}>
        <p>Modal content</p>
      </Modal>
    )
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument()
  })
})

describe('Pagination', () => {
  it('renders page buttons', () => {
    const onPageChange = () => {}
    render(
      <Pagination page={1} totalPages={5} onPageChange={onPageChange} />
    )
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('disables prev on first page', () => {
    const onPageChange = () => {}
    render(
      <Pagination page={1} totalPages={5} onPageChange={onPageChange} />
    )
    const prevBtn = screen.getByText('Prev', { exact: false }).closest('button')
    expect(prevBtn).toBeDisabled()
  })

  it('disables next on last page', () => {
    const onPageChange = () => {}
    render(
      <Pagination page={5} totalPages={5} onPageChange={onPageChange} />
    )
    const nextBtn = screen.getByText('Next', { exact: false }).closest('button')
    expect(nextBtn).toBeDisabled()
  })

  it('hides jump input when totalPages <= 5', () => {
    const onPageChange = () => {}
    render(
      <Pagination page={1} totalPages={5} onPageChange={onPageChange} />
    )
    expect(screen.queryByPlaceholderText('#')).not.toBeInTheDocument()
  })
})
