import { redirect } from 'next/navigation'

/** Legacy marketing URL — landing page now lives at `/`. */
export default function WelcomeRedirectPage() {
  redirect('/')
}
