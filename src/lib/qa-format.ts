import type { SerializedStoryQuestion } from '@/lib/qa'

export interface QAAnswerBlock {
  speaker?: string
  text: string
}

/** Build readable answer blocks from segments or plain answerText. */
export function formatQAAnswerBlocks(question: SerializedStoryQuestion): QAAnswerBlock[] {
  const segments = question.segments.filter((seg) => seg.text?.trim())
  if (segments.length > 0) {
    const speakers = new Set(segments.map((seg) => seg.speaker).filter(Boolean))
    const showSpeakers = speakers.size > 1 || segments.length > 1
    return segments.map((seg) => ({
      ...(showSpeakers && seg.speaker ? { speaker: seg.speaker } : {}),
      text: seg.text!.trim(),
    }))
  }

  return question.answerText
    .split(/\n\n+/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((text) => ({ text }))
}
