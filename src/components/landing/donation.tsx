'use client'

import { Heart } from 'lucide-react'
import type { Locale } from '@/lib/i18n'
import { t } from '@/lib/i18n'
import { DONATION_URL } from '@/lib/donation'

interface DonationProps {
  locale: Locale
}

export function Donation({ locale }: DonationProps) {
  const text = t(locale).donation

  return (
    <section id="donate" className="py-24 px-4">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-6 inline-flex items-center justify-center rounded-full bg-brand/10 p-3">
          <Heart className="h-6 w-6 text-brand" />
        </div>
        <h2 className="mb-3 text-3xl font-bold tracking-tighter sm:text-4xl">{text.title}</h2>
        <p className="mx-auto mb-8 max-w-xl text-muted-foreground">{text.subtitle}</p>
        <a
          href={DONATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-6 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/90"
        >
          <Heart className="h-4 w-4" />
          {text.button}
        </a>
        <p className="mt-4 text-xs text-muted-foreground">{text.note}</p>
      </div>
    </section>
  )
}
