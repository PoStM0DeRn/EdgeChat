import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
})

export const STRIPE_PRICES = {
  monthly: process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY || '',
  yearly: process.env.NEXT_PUBLIC_STRIPE_PRICE_YEARLY || '',
}

export function getPriceId(billing: 'monthly' | 'yearly'): string {
  return billing === 'monthly' ? STRIPE_PRICES.monthly : STRIPE_PRICES.yearly
}
