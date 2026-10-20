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

  aborted = false

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
    this.aborted = true
    this.onend?.call(this as unknown as SpeechRecognition, new Event('end'))
  }

  emit(text: string) {
    const alternative = { transcript: text, confidence: 1 } as SpeechRecognitionAlternative
    const result = Object.assign([alternative], { isFinal: true }) as unknown as SpeechRecognitionResult
    const event = { resultIndex: 0, results: [result] } as unknown as SpeechRecognitionEvent
    this.onresult?.call(this as unknown as SpeechRecognition, event)
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

describe('/ask Voice session lifecycle', () => {
  it('stops claiming to listen after the reader ends the session', () => {
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
    expect(screen.getByText('Listening', { selector: '.ask-voice-status' })).toBeInTheDocument()
    act(() => recognitions[0]?.emit('What did he say about the budget?'))
    fireEvent.click(screen.getByRole('button', { name: 'End session' }))

    expect(screen.getByText('Session ended', { selector: '.ask-voice-status' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Session ended' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'End session' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask what was said' })).toBeEnabled()
  })

  it('releases the microphone when the reader leaves the page', () => {
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: FakeRecognition as unknown as SpeechRecognitionConstructor,
    })
    const page = render(
      <AskVoice
        ask={vi.fn().mockResolvedValue(undefined)}
        onBackToChat={vi.fn()}
        notify={vi.fn()}
        prefs={DEFAULT_PREFS}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start listening' }))
    expect(recognitions[0]?.aborted).toBe(false)
    page.unmount()
    expect(recognitions[0]?.aborted).toBe(true)
  })
})

describe('/ask Voice read-aloud controls', () => {
  it('leaves the speaking state when cancel does not emit an end event', async () => {
    const synthDescriptor = Object.getOwnPropertyDescriptor(window, 'speechSynthesis')
    const utteranceDescriptor = Object.getOwnPropertyDescriptor(window, 'SpeechSynthesisUtterance')
    const cancel = vi.fn()

    class FakeUtterance {
      text: string
      lang = ''
      rate = 1
      voice: SpeechSynthesisVoice | null = null
      onstart: SpeechSynthesisUtterance['onstart'] = null
      onend: SpeechSynthesisUtterance['onend'] = null
      onerror: SpeechSynthesisUtterance['onerror'] = null

      constructor(text: string) {
        this.text = text
      }
    }

    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: FakeRecognition as unknown as SpeechRecognitionConstructor,
    })
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: FakeUtterance,
    })
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel,
        getVoices: () => [],
        speak: (utterance: FakeUtterance) => {
          utterance.onstart?.call(
            utterance as unknown as SpeechSynthesisUtterance,
            new Event('start') as SpeechSynthesisEvent,
          )
        },
      },
    })

    try {
      const ask = vi.fn(async (
        _question: string,
        options?: { onResult?: (result: unknown) => void },
      ) => {
        options?.onResult?.({ summary: 'The archive answer.' })
      })

      render(
        <AskVoice
          ask={ask}
          onBackToChat={vi.fn()}
          notify={vi.fn()}
          prefs={{ ...DEFAULT_PREFS, readAloud: false }}
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Start listening' }))
      act(() => recognitions[0]?.emit('What did he say about the budget?'))
      fireEvent.click(screen.getByRole('button', { name: 'Ask what was said' }))

      expect(await screen.findByRole('heading', { name: 'Answer ready' })).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Read the answer aloud' }))
      expect(screen.getByRole('heading', { name: 'Speaking' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Stop speaking' }))
      expect(cancel).toHaveBeenCalled()
      expect(screen.getByRole('heading', { name: 'Answer ready' })).toBeInTheDocument()
    } finally {
      if (synthDescriptor) {
        Object.defineProperty(window, 'speechSynthesis', synthDescriptor)
      } else {
        Reflect.deleteProperty(window, 'speechSynthesis')
      }
      if (utteranceDescriptor) {
        Object.defineProperty(window, 'SpeechSynthesisUtterance', utteranceDescriptor)
      } else {
        Reflect.deleteProperty(window, 'SpeechSynthesisUtterance')
      }
    }
  })
})
