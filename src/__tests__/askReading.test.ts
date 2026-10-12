import { describe, expect, it, vi } from 'vitest'
import {
  generateAskReading,
  type AskReadingInput,
} from '@/lib/askReading'

const input: AskReadingInput = {
  question: 'What did the Speaker say about Parliament?',
  searchTerms: ['parliament'],
  contextTerms: [],
  evidence: [
    {
      ref: '/archives/speeches/parliamentary-independence',
      collection: 'Archive documents',
      title: 'Parliamentary independence',
      year: 2021,
      passage: 'The House must guard its independence.',
    },
  ],
}

describe('optional /ask reading provider', () => {
  it('is disabled by default and leaves deterministic answers untouched', async () => {
    await expect(generateAskReading(input)).resolves.toBeUndefined()
  })

  it('marks provider prose as generated and keeps only supplied source refs', async () => {
    const provider = {
      generate: vi.fn().mockResolvedValue({
        text: '  These records emphasize the House’s independence.  ',
        basedOn: [
          '/archives/speeches/parliamentary-independence',
          '/private/not-retrieved',
          '/archives/speeches/parliamentary-independence',
        ],
      }),
    }

    await expect(generateAskReading(input, provider)).resolves.toEqual({
      text: 'These records emphasize the House’s independence.',
      generated: true,
      basedOn: ['/archives/speeches/parliamentary-independence'],
    })
    expect(provider.generate).toHaveBeenCalledWith(input, undefined)
  })

  it('drops ungrounded output and provider failures without failing retrieval', async () => {
    const ungrounded = {
      generate: vi.fn().mockResolvedValue({
        text: 'This claim has no retrieved source.',
        basedOn: ['/not-in-evidence'],
      }),
    }
    const failed = {
      generate: vi.fn().mockRejectedValue(new Error('model unavailable')),
    }

    await expect(generateAskReading(input, ungrounded)).resolves.toBeUndefined()
    await expect(generateAskReading(input, failed)).resolves.toBeUndefined()
  })
})
