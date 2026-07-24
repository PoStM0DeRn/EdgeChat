'use client'

import { Monitor, Download, Globe, Database, Bot, Code } from 'lucide-react'
import type { Locale } from '@/lib/i18n'
import { t } from '@/lib/i18n'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Monitor,
  Download,
  Globe,
  Database,
  Bot,
  Code,
}

interface FeaturesProps {
  locale: Locale
}

export function Features({ locale }: FeaturesProps) {
  const text = t(locale).features

  return (
    <section id="features" className="py-24 px-4">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{text.title}</h2>
          <p className="mt-2 text-muted-foreground">{text.subtitle}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {text.items.map((item) => {
            const Icon = iconMap[item.icon] || Shield
            return (
              <div
                key={item.title}
                className="group rounded-xl border bg-card p-6 transition-all hover:shadow-md hover:border-foreground/20"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <Icon className="h-5 w-5 text-foreground" />
                </div>
                <h3 className="mb-2 font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
