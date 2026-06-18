import { redirect } from 'next/navigation'

/**
 * On-demand generation no longer runs in the foreground. Requests are enqueued
 * as durable background jobs (see POST /api/generate) and tracked in the
 * library, so this legacy route just forwards there.
 */
export default function BriefingCreatePage() {
  redirect('/library')
}
