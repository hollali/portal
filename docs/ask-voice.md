# Voice input in /ask

## Composer dictation

1. Select the microphone in the question composer and grant microphone access in
   the browser if prompted.
2. Speak. The recognized words appear in the composer, and the mic control shows
   that it is listening.
3. Select the mic again to stop, review or edit the transcript, then press Send.

Some browser speech services end an individual recognition session after a short
pause. Composer dictation automatically starts a fresh session while the mic is
still active, and only an explicit stop ends the listening session. Transient
browser speech-service network errors are retried up to three times with a
backoff; persistent service errors are surfaced, and typing remains available.

Composer dictation never sends a request on its own. The question is posted to
`/api/ask` only after Send (or the normal Enter-to-send action). Starting a new
chat, changing workspace pages, or leaving `/ask` stops active recognition.

## Voice page

The Voice page provides a separate hands-free flow and browser speech
synthesis/read-aloud controls. It can submit a completed recognized question
when capture ends; this differs from composer dictation, which waits for the
reader to press Send. Recognition errors explain whether the browser service,
microphone, permission, or selected language needs attention, and offer a retry.

## Read-aloud output

The Voice page can read an answer aloud with the browser's `speechSynthesis` API
and whichever system voice the reader selects. The chosen voice, rate and
automatic read-aloud preference are stored locally in the browser.

The current output is a synthetic system voice. It is **not** a recording of the
Speaker, and no voice-cloning provider is configured. Answer text is sent to the
browser's speech engine for playback; no answer audio is uploaded to `/ask`.
Voice cloning is outside the current approval policy — see rule 4 in
[`avatar-sources.md`](avatar-sources.md).

## Browser and microphone requirements

- Voice recognition requires a browser that exposes `SpeechRecognition` or
  `webkitSpeechRecognition`; support and behavior vary by browser and platform.
- Browsers generally require a secure context and user permission for the
  microphone. `localhost` is a secure context for local development; deployed
  sites should use HTTPS.
- If recognition is unsupported or microphone permission is denied, typed
  questions continue to work normally.
- Recognition is handled by the browser's speech service and may be processed
  according to that browser/provider's policy. The application does not upload
  raw microphone audio to `/api/ask`; it sends recognized text when the question
  is submitted.

Voice recognition and read-aloud are browser functionality, separate from the
future server-hosted local language model described in
[`ask-local-llm.md`](ask-local-llm.md).
