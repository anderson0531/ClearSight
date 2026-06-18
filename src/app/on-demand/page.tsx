import { redirect } from 'next/navigation'

// On-demand generation now lives on each ClearSight podcast channel page.
// Old links/bookmarks to the standalone page redirect home.
export default function OnDemandPage() {
  redirect('/')
}
