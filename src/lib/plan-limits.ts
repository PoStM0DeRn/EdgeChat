import { db } from './db'

export const PLAN_LIMITS = {
  free: {
    documents: 10,
    sessions: 30,
    agentTokens: 3,
    customPrompts: true,
    chatRateLimit: 30,
    imageGenerations: 10,
  },
  pro: {
    documents: 50,
    sessions: Infinity,
    agentTokens: 10,
    customPrompts: true,
    chatRateLimit: 120,
    imageGenerations: 100,
  },
} as const

export type Plan = keyof typeof PLAN_LIMITS

export async function getUserPlan(userId: string): Promise<Plan> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { plan: true, subscriptionEndsAt: true },
  })
  if (!user) return 'free'
  if (user.plan === 'pro' && user.subscriptionEndsAt && user.subscriptionEndsAt < new Date()) {
    await db.user.update({
      where: { id: userId },
      data: { plan: 'free', stripeSubscriptionId: null, subscriptionEndsAt: null },
    })
    return 'free'
  }
  return (user.plan as Plan) || 'free'
}

export async function checkLimit(
  userId: string,
  resource: keyof typeof PLAN_LIMITS.free
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const plan = await getUserPlan(userId)
  const limit = PLAN_LIMITS[plan][resource]

  let current = 0

  if (resource === 'documents') {
    current = await db.document.count({ where: { userId } })
  } else if (resource === 'sessions') {
    current = await db.chatSession.count({ where: { userId } })
  } else if (resource === 'agentTokens') {
    current = await db.agentToken.count({ where: { userId, isActive: true } })
  } else if (resource === 'imageGenerations') {
    const userSessions = await db.chatSession.findMany({
      where: { userId },
      select: { id: true },
    })
    const sessionIds = userSessions.map((s) => s.id)
    current = await db.chatMessage.count({
      where: {
        sessionId: { in: sessionIds },
        imageUrl: { not: null },
      },
    })
  }

  const allowed = current < limit

  return { allowed, current, limit }
}
