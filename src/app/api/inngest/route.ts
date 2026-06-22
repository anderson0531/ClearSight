import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { generatePodcast } from '@/inngest/functions/generate-podcast'
import { renderPodcastIllustrations } from '@/inngest/functions/render-podcast-illustrations'
import { generateMusic } from '@/inngest/functions/generate-music'
import { relocalizePodcast } from '@/inngest/functions/relocalize-podcast'
import { qaAnswerAudio } from '@/inngest/functions/qa-answer-audio'

// Long-running generation. 300s is the Vercel Hobby cap; raise toward 800 on
// Pro. Inngest's step decomposition is what makes long generations reliable
// regardless of this ceiling — each step is its own invocation.
export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [generatePodcast, renderPodcastIllustrations, generateMusic, relocalizePodcast, qaAnswerAudio],
})
