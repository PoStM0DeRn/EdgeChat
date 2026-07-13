import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

function subscriptionEndsAt(sub: any): Date {
  const ts = sub.current_period_end
  if (ts && typeof ts === 'number') return new Date(ts * 1000)
  const recurring = sub.items?.data?.[0]?.price?.recurring
  const interval = recurring?.interval || 'month'
  const count = recurring?.interval_count || 1
  const anchor = sub.billing_cycle_anchor || sub.start_date || Math.floor(Date.now() / 1000)
  const map: Record<string, number> = { day: 86400, week: 604800, month: 2592000, year: 31536000 }
  return new Date((anchor + (map[interval] || 2592000) * count) * 1000)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    let event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.metadata?.userId
        const subscriptionId = session.subscription as string

        if (userId && subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          await db.user.update({
            where: { id: userId },
            data: {
              plan: 'pro',
              stripeSubscriptionId: subscriptionId,
              subscriptionEndsAt: subscriptionEndsAt(subscription),
            },
          })
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const userId = subscription.metadata?.userId || (
          await stripe.subscriptions.retrieve(subscription.id).then(s =>
            stripe.customers.retrieve(s.customer as string).then(c => (c as any).metadata?.userId)
          )
        ).catch(() => null)

        if (userId) {
          const status = subscription.status
          if (status === 'active' || status === 'trialing') {
            await db.user.update({
              where: { id: userId },
              data: {
                plan: 'pro',
                stripeSubscriptionId: subscription.id,
                subscriptionEndsAt: subscriptionEndsAt(subscription),
              },
            })
          } else if (status !== 'incomplete' && status !== 'incomplete_expired') {
            await db.user.update({
              where: { id: userId },
              data: {
                plan: 'free',
                stripeSubscriptionId: null,
                subscriptionEndsAt: null,
              },
            })
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const userId = (
          await stripe.customers.retrieve(subscription.customer as string).catch(() => null)
        ) as any

        if (userId?.metadata?.userId) {
          await db.user.update({
            where: { id: userId.metadata.userId },
            data: {
              plan: 'free',
              stripeSubscriptionId: null,
              subscriptionEndsAt: null,
            },
          })
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}
