import { redirect } from 'next/navigation'

/**
 * On-demand generation no longer runs in the foreground. Requests are enqueued
 * as durable background jobs (see POST /api/generate) and tracked on the
 * On-Demand page, so this legacy route forwards there.
 */
export default function BriefingCreatePage() {
  redirect('/on-demand')
}
