import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getTranslateTargetCode } from '@/i18n/locales'
import { translateTexts } from '@/lib/translate'

const bodySchema = z.object({
  texts: z.array(z.string()).max(200),
  target: z.string().min(2).max(12),
})

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { texts, target } = parsed.data
  const translateTarget = getTranslateTargetCode(target)
  try {
    const translations = await translateTexts(texts, translateTarget)
    return NextResponse.json({ translations })
  } catch {
    // Never break the UI over a translation failure — return source text.
    return NextResponse.json({ translations: texts })
  }
}
