import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AvatarStage from '@/components/AvatarStage'
import { GUIDE_LABEL, GUIDE_LINES } from '@/lib/guideLines'
import { buildSpeakText } from '@/lib/speakText'
import type { AskCitation } from '@/lib/askQuery'

/**
 * The 3D scene is mocked so that "was it loaded?" is observable. It lives in
 * its own chunk behind a dynamic import precisely so that a device without
 * WebGL never fetches three.js, and that is a claim about module loading rather
 * than about the DOM — there is nothing in the rendered output that would tell
 * us whether a 600KB renderer was downloaded.
 */
const sceneLoaded = vi.fn()
vi.mock('@/components/GuideScene', () => ({
  default: () => {
    sceneLoaded()
    return <div data-testid="guide-scene" />
  },
}))

/**
 * The guide is a presenter for a living person's likeness, so the things worth
 * testing are not its animation — that is three.js's problem — but the promises
 * the page makes around it: the label is always there, the captions stand in for
 * the voice, a visitor who cannot run WebGL still gets the answer, and nothing
 * speaks before a visitor has touched the page.
 */

const citation = (over: Partial<AskCitation> = {}): AskCitation => ({
  kind: 'document',
  kindLabel: 'Speech',
  collection: 'documents',
  collectionLabel: 'Speeches',
  title: 'Address on the state of the nation',
  href: '/archives/documents/state-of-the-nation',
  year: 2021,
  excerpt: 'The budget is not a statement of what we intend to do.',
  hasTranscript: true,
  matched: ['budget'],
  ...over,
})

const SPEAK = buildSpeakText(citation())

/** jsdom ships no speech API at all, so the engine and its utterance are faked. */
class FakeUtterance {
  text: string
  lang = ''
  rate = 1
  pitch = 1
  voice: SpeechSynthesisVoice | null = null
  onstart: ((event: Event) => void) | null = null
  onend: ((event: Event) => void) | null = null
  onboundary: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  constructor(text: string) {
    this.text = text
  }
}

function stubSpeech() {
  const utterances: FakeUtterance[] = []
  const synth = {
    speaking: false,
    paused: false,
    pending: false,
    speak: vi.fn((u: FakeUtterance) => {
      utterances.push(u)
      return synth
    }),
    cancel: vi.fn(),
    resume: vi.fn(),
    pause: vi.fn(),
    getVoices: () => [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal('speechSynthesis', synth)
  vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance)
  return { synth, utterances }
}

beforeEach(() => {
  window.localStorage.clear()
  sceneLoaded.mockClear()
  stubSpeech()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the label cannot be missed', () => {
  it('is on screen before anything has been asked', () => {
    render(<AvatarStage canRender3D={false} canSpeak={false} />)
    expect(screen.getByText(GUIDE_LABEL)).toBeInTheDocument()
  })

  it('is on screen while the guide is reading a quotation', () => {
    render(<AvatarStage canRender3D={false} canSpeak={false} state="speaking" text={SPEAK} />)
    expect(screen.getByText(GUIDE_LABEL)).toBeInTheDocument()
  })

  it('is on screen when the guide has found nothing', () => {
    render(<AvatarStage canRender3D={false} canSpeak={false} state="no-result" />)
    expect(screen.getByText(GUIDE_LABEL)).toBeInTheDocument()
  })
})

describe('captions stand in for the voice', () => {
  it('shows the guide line for a search in flight', () => {
    render(<AvatarStage canRender3D={false} canSpeak={false} state="thinking" />)
    expect(screen.getByText(GUIDE_LINES.searching)).toBeInTheDocument()
  })

  it('says what was searched and not found, without apologising to a person', () => {
    render(<AvatarStage canRender3D={false} canSpeak={false} state="no-result" />)
    expect(screen.getByText(GUIDE_LINES.noResult)).toBeInTheDocument()
  })

  it('rests on the quotation, attributed to the Speaker rather than the guide', () => {
    // Before a voice starts there is nothing to track, so the caption holds the
    // thing the visitor is here for. With no speech engine at all, this is the
    // only version of the line they will ever see.
    render(<AvatarStage canRender3D={false} canSpeak={false} state="speaking" text={SPEAK} />)
    expect(screen.getByText('The Speaker, quoted')).toBeInTheDocument()
    expect(screen.queryByText('Guide')).not.toBeInTheDocument()
  })

  it('shows the introduction in the guide’s own voice while it is speaking', async () => {
    const { synth, utterances } = stubSpeech()
    render(<AvatarStage canRender3D={false} canSpeak={true} state="speaking" text={SPEAK} />)
    fireEvent.click(screen.getByRole('button', { name: /read this aloud/i }))
    await waitFor(() => expect(utterances).toHaveLength(1))
    utterances[0]!.onstart?.(new Event('start'))
    expect(synth.speak).toHaveBeenCalled()
    expect(await screen.findByText('Guide')).toBeInTheDocument()
    expect(screen.getByText(GUIDE_LINES.introducing)).toBeInTheDocument()
  })

  it('links the quotation to the record it came from', () => {
    render(
      <AvatarStage
        canRender3D={false}
        canSpeak={false}
        state="speaking"
        text={SPEAK}
        source={{ title: citation().title, href: citation().href }}
      />,
    )
    expect(screen.getByRole('link', { name: citation().title })).toHaveAttribute(
      'href',
      citation().href,
    )
  })

  it('has nothing to attribute when the guide has nothing to say', () => {
    render(<AvatarStage canRender3D={false} canSpeak={false} state="media" />)
    expect(screen.getByText(GUIDE_LINES.mediaNote)).toBeInTheDocument()
  })
})

describe('the figure is optional, the answer is not', () => {
  it('gives a device with no WebGL the portrait instead of an apology', () => {
    // The portrait is inline SVG, so there is no longer a "this device cannot
    // show you the guide" state to report. A reader on a phone that cannot open
    // a WebGL context gets the same face as everyone else.
    render(<AvatarStage canRender3D={false} canSpeak={false} />)
    expect(screen.getByTestId('guide-portrait')).toBeInTheDocument()
    expect(screen.queryByText(/answer below is complete without it/i)).not.toBeInTheDocument()
  })

  it('never loads the three.js scene when the device cannot draw it', async () => {
    render(<AvatarStage canRender3D={false} canSpeak={false} />)
    await waitFor(() => expect(screen.getByTestId('guide-portrait')).toBeInTheDocument())
    // The point of splitting GuideScene out: a reader on mobile data in Ghana
    // must not be made to download a WebGL renderer to be shown a drawing.
    expect(sceneLoaded).not.toHaveBeenCalled()
    expect(screen.queryByTestId('guide-scene')).not.toBeInTheDocument()
  })

  it('never loads three.js just because the device can draw it', async () => {
    // There is no approved model. A renderer and a WebGL context for a mesh that
    // does not exist is pure cost, and it is what kept the guide looking broken
    // on every device in the meantime.
    render(<AvatarStage canRender3D canSpeak={false} />)
    await waitFor(() => expect(screen.getByTestId('guide-portrait')).toBeInTheDocument())
    expect(sceneLoaded).not.toHaveBeenCalled()
    expect(screen.queryByTestId('guide-scene')).not.toBeInTheDocument()
  })

  it('loads it when the device can draw it and an approved model exists', async () => {
    // The counterpart to the tests above: without this, "never loaded" would
    // pass even if the scene were wired to nothing at all.
    render(<AvatarStage canRender3D canSpeak={false} modelUrl="/avatar/guide.glb" />)
    expect(await screen.findByTestId('guide-scene')).toBeInTheDocument()
    expect(sceneLoaded).toHaveBeenCalled()
  })

  it('does not load it for a reader who asked for captions only either', async () => {
    render(<AvatarStage canRender3D canSpeak={false} showFigure={false} />)
    await waitFor(() => expect(screen.getByText(GUIDE_LABEL)).toBeInTheDocument())
    expect(sceneLoaded).not.toHaveBeenCalled()
  })

  it('draws no figure at all when asked for captions only', () => {
    const { container } = render(<AvatarStage canRender3D canSpeak={false} showFigure={false} />)
    expect(container.querySelector('canvas')).toBeNull()
    // The portrait is not a canvas, so the old assertion would have passed while
    // a face was still being drawn. Check the thing that is actually rendered.
    expect(screen.queryByTestId('guide-portrait')).not.toBeInTheDocument()
    // ...and the label survives, because it is not part of the figure.
    expect(screen.getByText(GUIDE_LABEL)).toBeInTheDocument()
  })

  it('leaves the captions alone when there is no speech engine', () => {
    render(<AvatarStage canRender3D={false} canSpeak={false} state="thinking" />)
    expect(screen.getByText(GUIDE_LINES.searching)).toBeInTheDocument()
    expect(screen.getByText(/no speech engine/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /read this aloud/i })).toBeDisabled()
  })
})

describe('nothing speaks before a visitor has touched the page', () => {
  it('stays quiet on load', async () => {
    const { synth } = stubSpeech()
    render(<AvatarStage canRender3D={false} canSpeak={true} state="speaking" text={SPEAK} />)
    // The caption is up, the voice is not.
    expect(await screen.findByText(SPEAK)).toBeInTheDocument()
    expect(synth.speak).not.toHaveBeenCalled()
  })

  it('reads aloud once the visitor asks it to', async () => {
    const { synth } = stubSpeech()
    render(<AvatarStage canRender3D={false} canSpeak={true} state="speaking" text={SPEAK} />)
    fireEvent.click(screen.getByRole('button', { name: /read this aloud/i }))
    await waitFor(() => expect(synth.speak).toHaveBeenCalledTimes(1))
    // The guide introduces the record, then reads it — two utterances, so the
    // Speaker's words are never in the same breath as the guide's.
    expect(synth.speak.mock.calls[0]![0].text).toBe(GUIDE_LINES.introducing)
  })

  it('speaks by itself only after a real interaction', async () => {
    const { synth } = stubSpeech()
    render(<AvatarStage canRender3D={false} canSpeak={true} state="speaking" text={SPEAK} />)
    fireEvent.pointerDown(window)
    await waitFor(() => expect(synth.speak).toHaveBeenCalled())
  })

  it('reports its own speech state so the page can pose the guide', async () => {
    const onSpeakingChange = vi.fn()
    const { synth, utterances } = stubSpeech()
    render(
      <AvatarStage
        canRender3D={false}
        canSpeak={true}
        state="speaking"
        text={SPEAK}
        onSpeakingChange={onSpeakingChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /read this aloud/i }))
    await waitFor(() => expect(utterances).toHaveLength(1))
    utterances[0]!.onstart?.(new Event('start'))
    expect(onSpeakingChange).toHaveBeenCalledWith(true)
    expect(synth.speak).toHaveBeenCalled()
  })

  it('stops on request', async () => {
    const { synth, utterances } = stubSpeech()
    render(<AvatarStage canRender3D={false} canSpeak={true} state="speaking" text={SPEAK} />)
    fireEvent.click(screen.getByRole('button', { name: /read this aloud/i }))
    await waitFor(() => expect(utterances).toHaveLength(1))
    utterances[0]!.onstart?.(new Event('start'))
    await waitFor(() => expect(screen.getByRole('button', { name: /stop the guide/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /stop the guide/i }))
    expect(synth.cancel).toHaveBeenCalled()
  })

  it('has nothing to play when there is no quotation', () => {
    render(<AvatarStage canRender3D={false} canSpeak={true} state="speaking" text="" />)
    expect(screen.getByRole('button', { name: /read this aloud/i })).toBeDisabled()
  })
})