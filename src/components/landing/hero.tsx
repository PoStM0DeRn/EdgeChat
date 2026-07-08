'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, MessageSquare } from 'lucide-react'
import type { Locale } from '@/lib/i18n'
import { t } from '@/lib/i18n'

interface HeroProps {
  locale: Locale
}

export function Hero({ locale }: HeroProps) {
  const text = t(locale).hero

  return (
    <section className="relative flex min-h-[90vh] flex-col items-center justify-center px-4 pt-24 pb-16">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,oklch(0.708_0_0/0.15),transparent)]" />

      <div className="relative mx-auto max-w-3xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-secondary/50 px-3 py-1 text-xs text-muted-foreground">
          <MessageSquare className="h-3 w-3" />
          {locale === 'ru' ? 'Open Source • Приватный AI' : 'Open Source • Private AI'}
        </div>

        <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-6xl">
          {text.title}
        </h1>

        <p className="mb-2 text-xl font-medium text-muted-foreground">
          {text.subtitle}
        </p>

        <p className="mb-8 text-base text-muted-foreground max-w-xl mx-auto">
          {text.description}
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link href="/register">
            <Button size="lg" className="gap-2">
              {text.cta}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="#features">
            <Button variant="outline" size="lg">
              {text.ctaSecondary}
            </Button>
          </a>
        </div>
      </div>

      <div className="relative mt-16 mx-auto w-full max-w-4xl">
        <div className="rounded-xl border bg-card p-1 shadow-2xl">
          <div className="rounded-lg bg-secondary/30 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-3 w-3 rounded-full bg-destructive/60" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
              <div className="h-3 w-3 rounded-full bg-green-500/60" />
              <span className="ml-2 text-xs text-muted-foreground font-mono">EdgeChat</span>
            </div>
            <div className="space-y-3 font-mono text-sm">
              <div className="flex gap-3">
                <span className="text-muted-foreground select-none">{'>'}</span>
                <span>{locale === 'ru' ? 'Привет! Как дела с деплоем?' : 'Hey! How is the deployment going?'}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-muted-foreground select-none">{'>'}</span>
                <span className="animate-pulse">▌</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
