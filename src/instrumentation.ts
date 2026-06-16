export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return

  const { warmDatabaseConnection } = await import('@/lib/db')
  await warmDatabaseConnection()
}
