import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth-helpers'
import { getUserPlan } from '@/lib/plan-limits'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ plan: 'free', subscriptionEndsAt: null })
    }

    const plan = await getUserPlan(userId)

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { subscriptionEndsAt: true },
    })

    return NextResponse.json({
      plan,
      subscriptionEndsAt: user?.subscriptionEndsAt?.toISOString() || null,
    })
  } catch {
    return NextResponse.json({ plan: 'free', subscriptionEndsAt: null })
  }
}
