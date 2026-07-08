'use client'

import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import type { Locale } from '@/lib/i18n'
import { t } from '@/lib/i18n'

interface PricingProps {
  locale: Locale
}

export function Pricing({ locale }: PricingProps) {
  const text = t(locale).pricing

  return (
    <section id="pricing" className="py-24 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{text.title}</h2>
          <p className="mt-2 text-muted-foreground">{text.subtitle}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {text.plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-xl border bg-card p-6 transition-all ${
                plan.popular
                  ? 'border-foreground shadow-lg scale-[1.02]'
                  : 'hover:shadow-md'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-foreground px-3 py-0.5 text-xs font-medium text-background">
                  {locale === 'ru' ? 'Популярный' : 'Popular'}
                </div>
              )}
              <div className="mb-4">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>
              <div className="mb-6">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground text-sm">{plan.period}</span>
              </div>
              <ul className="mb-6 space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 shrink-0 text-green-600" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={plan.popular ? 'default' : 'outline'}
              >
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
