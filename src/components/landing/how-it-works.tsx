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
          <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl">{text.title}</h2>
          <p className="mt-2 text-muted-foreground">{text.subtitle}</p>
        </div>
        <div className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {text.steps.map((step, i) => {
            const Icon = stepIcons[i]
            return (
              <div key={step.title} className="relative text-center">
                {i < text.steps.length - 1 && (
                  <div className="hidden lg:block absolute left-[60%] top-6 w-[80%] h-px bg-gradient-to-r from-brand/40 to-transparent" />
                )}
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-brand/30 bg-brand/10 relative">
                  <Icon className="h-6 w-6 text-brand" />
                  <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-brand-foreground">
                    {i + 1}
                  </span>
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