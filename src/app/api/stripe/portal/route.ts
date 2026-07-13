import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getCurrentUser } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user?.stripeCustomerId) {
      return NextResponse.json({ error: 'Нет активной подписки' }, { status: 400 })
    }

    const origin = req.headers.get('origin') || 'http://localhost:3000'

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    console.error('Portal error:', err)
    return NextResponse.json({ error: 'Ошибка портала' }, { status: 500 })
  }
}
