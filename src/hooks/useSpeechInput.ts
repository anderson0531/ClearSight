'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getLocaleByEnglishName } from '@/i18n/locales'

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: SpeechRecognitionResultLike[]
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
}

export type SpeechInputError =
  | 'unsupported'
  | 'permission_denied'
  | 'no_microphone'
  | 'in_use'
  | 'secure_context'
  | 'network'
  | 'failed'

function getSpeechRecognitionCtor():
  | (new () => SpeechRecognitionLike)
  | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

function mapSpeechRecognitionError(error: string | undefined): SpeechInputError {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'permission_denied'
    case 'audio-capture':
      return 'no_microphone'
    case 'network':
      return 'network'
    default:
      return 'failed'
  }
}

async function requestMicrophoneAccess(
  signal: AbortSignal
): Promise<{ ok: true } | { ok: false; reason: SpeechInputError }> {
  if (typeof window === 'undefined') return { ok: false, reason: 'unsupported' }
  if (!window.isSecureContext) return { ok: false, reason: 'secure_context' }
  if (!navigator.mediaDevices?.getUserMedia) {
    // Older browsers: proceed and let SpeechRecognition surface errors.
    return { ok: true }
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      signal,
    } as MediaStreamConstraints & { signal?: AbortSignal })
    for (const track of stream.getTracks()) track.stop()
    return { ok: true }
  } catch (err) {
    if (signal.aborted) return { ok: false, reason: 'failed' }
    const name = err instanceof DOMException ? err.name : ''
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return { ok: false, reason: 'permission_denied' }
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return { ok: false, reason: 'no_microphone' }
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return { ok: false, reason: 'in_use' }
    }
    return { ok: false, reason: 'failed' }
  }
}

export interface UseSpeechInputOptions {
  /** Locale English name (e.g. "English") mapped to a BCP-47 speech tag. */
  language: string
  onFinalTranscript: (text: string) => void
}

export function useSpeechInput({ language, onFinalTranscript }: UseSpeechInputOptions) {
  const [isListening, setIsListening] = useState(false)
  const [isRequestingPermission, setIsRequestingPermission] = useState(false)
  const [error, setError] = useState<SpeechInputError | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const permissionAbortRef = useRef<AbortController | null>(null)
  const onFinalRef = useRef(onFinalTranscript)
  onFinalRef.current = onFinalTranscript

  const isSupported = typeof getSpeechRecognitionCtor() !== 'undefined'

  const stopListening = useCallback(() => {
    permissionAbortRef.current?.abort()
    permissionAbortRef.current = null
    setIsRequestingPermission(false)
    recognitionRef.current?.abort()
    recognitionRef.current = null
    setIsListening(false)
  }, [])

  const createRecognition = useCallback((Ctor: new () => SpeechRecognitionLike) => {
    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result?.isFinal) {
          finalText += result[0]?.transcript ?? ''
        }
      }
      const trimmed = finalText.trim()
      if (trimmed) onFinalRef.current(trimmed)
    }
    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return
      setError(mapSpeechRecognitionError(event.error))
      setIsListening(false)
    }
    recognition.onend = () => {
      setIsListening(false)
    }
    return recognition
  }, [])

  const startListening = useCallback(async () => {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) {
      setError('unsupported')
      return
    }

    setError(null)
    recognitionRef.current?.abort()
    recognitionRef.current = null

    const permissionAbort = new AbortController()
    permissionAbortRef.current = permissionAbort
    setIsRequestingPermission(true)

    const access = await requestMicrophoneAccess(permissionAbort.signal)
    if (permissionAbortRef.current === permissionAbort) {
      permissionAbortRef.current = null
    }
    setIsRequestingPermission(false)

    if (permissionAbort.signal.aborted) return
    if (!access.ok) {
      setError(access.reason)
      return
    }

    const recognition = createRecognition(Ctor)
    recognitionRef.current = recognition
    recognition.lang = getLocaleByEnglishName(language).ttsLanguageCode

    try {
      recognition.start()
      setIsListening(true)
    } catch {
      setError('failed')
      setIsListening(false)
      recognitionRef.current = null
    }
  }, [createRecognition, language])

  const toggleListening = useCallback(() => {
    if (isListening || isRequestingPermission) stopListening()
    else void startListening()
  }, [isListening, isRequestingPermission, startListening, stopListening])

  useEffect(() => {
    return () => {
      permissionAbortRef.current?.abort()
      recognitionRef.current?.abort()
      recognitionRef.current = null
    }
  }, [])

  useEffect(() => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.lang = getLocaleByEnglishName(language).ttsLanguageCode
    }
  }, [language, isListening])

  return {
    isSupported,
    isListening,
    isRequestingPermission,
    error,
    startListening,
    stopListening,
    toggleListening,
  }
}
