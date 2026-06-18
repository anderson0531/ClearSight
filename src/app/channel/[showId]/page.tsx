import { notFound } from 'next/navigation'
import { ChannelHeader } from '@/components/channel/ChannelHeader'
import { ChannelBrowser } from '@/components/channel/ChannelBrowser'
import { categoriesForShow, getShowById } from '@/lib/shows'

interface ChannelPageProps {
  params: Promise<{ showId: string }>
  searchParams: Promise<{ category?: string | string[] }>
}

export default async function ChannelPage({ params, searchParams }: ChannelPageProps) {
  const { showId } = await params
  const show = getShowById(showId)
  if (!show) {
    notFound()
  }

  const { category } = await searchParams
  const initialCategory = Array.isArray(category) ? category[0] : category

  return (
    <main className="fade-in mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-6">
      <ChannelHeader show={show} />
      <ChannelBrowser
        showId={show.id}
        contentType={show.contentType}
        categories={categoriesForShow(show)}
        initialCategory={initialCategory}
      />
    </main>
  )
}
