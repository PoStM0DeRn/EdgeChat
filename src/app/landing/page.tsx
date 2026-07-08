'use client'

import { useState } from 'react'
import { Navbar } from '@/components/landing/navbar'
import { Hero } from '@/components/landing/hero'
import { Features } from '@/components/landing/features'
import { HowItWorks } from '@/components/landing/how-it-works'
import { Pricing } from '@/components/landing/pricing'
import { FAQ } from '@/components/landing/faq'
import { Footer } from '@/components/landing/footer'
import type { Locale } from '@/lib/i18n'

export default function LandingPage() {
  const [locale, setLocale] = useState<Locale>('ru')

  return (
    <div className="min-h-screen">
      <Navbar locale={locale} onLocaleChange={setLocale} />
      <Hero locale={locale} />
      <Features locale={locale} />
      <HowItWorks locale={locale} />
      <Pricing locale={locale} />
      <FAQ locale={locale} />
      <Footer locale={locale} />
    </div>
  )
}
