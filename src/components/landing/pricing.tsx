'use client'

import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import type { Locale } from '@/lib/i18n'
import { t } from '@/lib/i18n'

interface PricingProps {
  locale: Locale
}

export function Pricing({ locale }: PricingProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const [loading, setLoading] = useState<string | null>(null)
  const [yearly, setYearly] = useState(false)
  const [error, setError] = useState('')
  const text = t(locale).pricing

  const handleProClick = async () => {
    if (!session) {
      router.push('/register')
      return
    }
    const billing = yearly ? 'yearly' : 'monthly'
    setLoading(billing)
    setError('')
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billing }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Ошибка оформления подписки')
      }
    } catch {
      setError('Ошибка подключения к серверу')
    } finally {
      setLoading(null)
    }
  }

  const handleFreeClick = () => {
    if (!session) {
      router.push('/register')
    } else {
      router.push('/')
    }
  }

  const proFeatures = text.plans[1].features

  return (
    <section id="pricing" className="py-24 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{text.title}</h2>
          <p className="mt-2 text-muted-foreground">{text.subtitle}</p>
        </div>

        {/* Toggle Monthly / Yearly */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <button
            onClick={() => setYearly(false)}
            className={`text-sm font-medium transition-colors ${!yearly ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            {text.monthly}
          </button>
          <button
            onClick={() => setYearly(!yearly)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${yearly ? 'bg-foreground' : 'bg-input'}`}
            role="switch"
            aria-checked={yearly}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-background transition-transform ${yearly ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
            />
          </button>
          <button
            onClick={() => setYearly(true)}
            className={`text-sm font-medium transition-colors ${yearly ? 'text-foreground' : 'text-muted-foreground'}`}
          >
            {text.yearly}
            <span className="ml-1 text-xs text-green-600 font-semibold">
              {text.savePercent.replace('{p}', '17')}
            </span>
          </button>
        </div>

        {error && (
          <div className="mx-auto max-w-md mb-6 rounded-md bg-destructive/15 p-3 text-sm text-destructive text-center">
            {error}
          </div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 max-w-3xl mx-auto">
          {/* Free plan */}
          <div className="rounded-xl border bg-card p-6 transition-all hover:shadow-md">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">{text.plans[0].name}</h3>
              <p className="text-sm text-muted-foreground">{text.plans[0].description}</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold">{text.plans[0].price}</span>
            </div>
            <ul className="mb-6 space-y-2">
              {(text.plans[0].features as readonly string[]).map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-green-600" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button className="w-full" variant="outline" onClick={handleFreeClick}>
              {text.plans[0].cta}
            </Button>
          </div>

          {/* Pro plan */}
          <div className="relative rounded-xl border border-foreground bg-card p-6 transition-all shadow-lg scale-[1.02]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-3 py-0.5 text-xs font-medium text-background">
              {locale === 'ru' ? 'Популярный' : 'Popular'}
            </div>
            <div className="mb-4">
              <h3 className="text-lg font-semibold">{text.plans[1].name}</h3>
              <p className="text-sm text-muted-foreground">{text.plans[1].description}</p>
            </div>
            <div className="mb-6">
              <span className="text-4xl font-bold">
                {yearly ? text.plans[1].priceYearly : text.plans[1].priceMonthly}
              </span>
              <span className="text-muted-foreground text-sm">
                {yearly ? text.plans[1].periodYearly : text.plans[1].periodMonthly}
              </span>
            </div>
            <ul className="mb-6 space-y-2">
              {proFeatures.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-green-600" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button
              className="w-full"
              variant="default"
              onClick={handleProClick}
              disabled={loading === 'monthly' || loading === 'yearly'}
            >
              {loading === 'monthly' || loading === 'yearly' ? 'Загрузка...' : text.plans[1].cta}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
