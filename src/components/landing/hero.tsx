'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowRight, MessageSquare } from 'lucide-react'
import { motion } from 'framer-motion'
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
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-xs text-brand">
            <MessageSquare className="h-3 w-3" />
            {t(locale).badge.text}
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-4 text-5xl font-bold tracking-tighter sm:text-7xl"
        >
          {text.title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-2 text-xl font-medium text-muted-foreground"
        >
          {text.subtitle}
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mb-8 text-base text-muted-foreground max-w-xl mx-auto"
        >
          {text.description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link href="/register">
            <Button size="lg" className="gap-2 bg-brand text-brand-foreground hover:bg-brand/90">
              {text.cta}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <a href="#features">
            <Button variant="outline" size="lg">
              {text.ctaSecondary}
            </Button>
          </a>
        </motion.div>
      </div>

      <div className="relative mt-16 mx-auto w-full max-w-3xl">
        <div className="rounded-xl border bg-card p-1 shadow-2xl">
          <div className="rounded-lg bg-secondary/30 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-3 w-3 rounded-full bg-destructive/60" />
              <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
              <div className="h-3 w-3 rounded-full bg-green-500/60" />
              <span className="ml-2 text-xs text-muted-foreground font-mono">EdgeChat</span>
            </div>
            <div className="space-y-2 font-mono text-sm">
              <div className="flex gap-3">
                <span className="text-green-500 select-none">$</span>
                <span className="text-muted-foreground">{locale === 'ru' ? '~ Chat: Придумай идею для поста' : '~ Chat: Brainstorm a post idea'}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-green-500 select-none">$</span>
                <span className="text-muted-foreground">{locale === 'ru' ? '~ ComfyUI: Открыть редактор' : '~ ComfyUI: Open editor'}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-green-500 select-none">$</span>
                <span className="text-muted-foreground">{locale === 'ru' ? '~ RAG: Найти в документах' : '~ RAG: Search documents'}</span>
              </div>
              <div className="flex gap-3 text-foreground/80">
                <span className="text-green-500 select-none">&gt;</span>
                <span className="animate-pulse">▌</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
