import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { generatePodcast } from '@/inngest/functions/generate-podcast'
import { renderPodcastIllustrations } from '@/inngest/functions/render-podcast-illustrations'
import { generateMusic } from '@/inngest/functions/generate-music'
import { relocalizePodcast } from '@/inngest/functions/relocalize-podcast'
import { qaAnswerAudio } from '@/inngest/functions/qa-answer-audio'
import { generateChannelIntroFn } from '@/inngest/functions/generate-channel-intro'
import { illustrateChannelIntroFn } from '@/inngest/functions/illustrate-channel-intro'

export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generatePodcast,
    renderPodcastIllustrations,
    generateMusic,
    relocalizePodcast,
    qaAnswerAudio,
    generateChannelIntroFn,
    illustrateChannelIntroFn,
  ],
})
