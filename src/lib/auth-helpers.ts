import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

export async function getCurrentUser(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id: string })?.id
  return userId || null
}
