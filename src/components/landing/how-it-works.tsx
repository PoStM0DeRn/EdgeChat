'use client'

import { Download, Zap, Link2, MessageCircle } from 'lucide-react'
import type { Locale } from '@/lib/i18n'
import { t } from '@/lib/i18n'

const stepIcons = [Download, Zap, Link2, MessageCircle]

interface HowItWorksProps {
  locale: Locale
}

export function HowItWorks({ locale }: HowItWorksProps) {
  const text = t(locale).howItWorks

  return (
    <section className="py-24 px-4 bg-secondary/30">
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{text.title}</h2>
          <p className="mt-2 text-muted-foreground">{text.subtitle}</p>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {text.steps.map((step, i) => {
            const Icon = stepIcons[i]
            return (
              <div key={step.title} className="text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-foreground/20 bg-background">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  {locale === 'ru' ? `Шаг ${i + 1}` : `Step ${i + 1}`}
                </div>
                <h3 className="mb-1 font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
