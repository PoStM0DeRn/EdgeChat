import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { getUserPlan, type Plan } from './plan-limits'

export async function getCurrentUser(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id: string })?.id
  return userId || null
}

export async function getCurrentUserPlan(): Promise<Plan> {
  const userId = await getCurrentUser()
  if (!userId) return 'free'
  return getUserPlan(userId)
}
