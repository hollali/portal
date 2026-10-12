import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AskVoice from '@/components/AskVoice'
import { DEFAULT_PREFS } from '@/lib/askPrefs'

const speechRecognitionDescriptor = Object.getOwnPropertyDescriptor(window, 'SpeechRecognition')
const recognitions: FakeRecognition[] = []

class FakeRecognition {
  lang = ''
  continuous = false
  interimResults = false
  maxAlternatives = 1
  onstart: SpeechRecognition['onstart'] = null
  onend: SpeechRecognition['onend'] = null
  onresult: SpeechRecognition['onresult'] = null
  onerror: SpeechRecognition['onerror'] = null
  onnomatch: SpeechRecognition['onnomatch'] = null

  constructor() {
    recognitions.push(this)
  }

  start() {
    this.onstart?.call(this as unknown as SpeechRecognition, new Event('start'))
  }

  stop() {
    this.onend?.call(this as unknown as SpeechRecognition, new Event('end'))
  }

  abort() {
    this.onend?.call(this as unknown as SpeechRecognition, new Event('end'))
  }

  fail(error: string) {
    this.onerror?.call(this as unknown as SpeechRecognition, {
      error,
      message: error,
    } as SpeechRecognitionErrorEvent)
    this.onend?.call(this as unknown as SpeechRecognition, new Event('end'))
  }
}

afterEach(() => {
  recognitions.length = 0
  if (speechRecognitionDescriptor) {
    Object.defineProperty(window, 'SpeechRecognition', speechRecognitionDescriptor)
  } else {
    Reflect.deleteProperty(window, 'SpeechRecognition')
  }
})

describe('/ask Voice error states', () => {
  it('explains browser speech-service failures and leaves a retry action available', () => {
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: FakeRecognition as unknown as SpeechRecognitionConstructor,
    })
    render(
      <AskVoice
        ask={vi.fn().mockResolvedValue(undefined)}
        onBackToChat={vi.fn()}
        notify={vi.fn()}
        prefs={DEFAULT_PREFS}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start listening' }))
    act(() => recognitions[0]?.fail('network'))

    expect(screen.getByRole('alert')).toHaveTextContent(/speech-recognition service could not be reached/i)
    expect(screen.queryByText('The mic had a problem — try again.')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('clears the ended recognition session so Try again can start a new one', () => {
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: FakeRecognition as unknown as SpeechRecognitionConstructor,
    })
    render(
      <AskVoice
        ask={vi.fn().mockResolvedValue(undefined)}
        onBackToChat={vi.fn()}
        notify={vi.fn()}
        prefs={DEFAULT_PREFS}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start listening' }))
    act(() => recognitions[0]?.fail('audio-capture'))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(recognitions).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Listening' })).toBeInTheDocument()
  })
})
