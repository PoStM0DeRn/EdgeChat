import { NextRequest, NextResponse } from 'next/server'
import { stripe, getPriceId } from '@/lib/stripe'
import { getCurrentUser } from '@/lib/auth-helpers'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUser()
    if (!userId) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { billing } = await req.json() as { billing: 'monthly' | 'yearly' }
    const priceId = getPriceId(billing)
    if (!priceId) {
      return NextResponse.json({ error: 'Цена не настроена' }, { status: 500 })
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 })
    }

    const origin = req.headers.get('origin') || 'http://localhost:3000'

    let customerId = user.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: user.name || undefined,
        metadata: { userId },
      })
      customerId = customer.id
      await db.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } })
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/pricing`,
      metadata: { userId, billing },
      subscription_data: {
        metadata: { userId, billing },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'Ошибка создания платежа' }, { status: 500 })
  }
}
