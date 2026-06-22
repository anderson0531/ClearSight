import { redirect } from 'next/navigation'

export default async function SearchPageRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const query = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item)
    } else {
      query.set(key, value)
    }
  }

  const qs = query.toString()
  redirect(qs ? `/discover?${qs}` : '/discover')
}
