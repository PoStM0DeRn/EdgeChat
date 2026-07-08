'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Locale } from '@/lib/i18n'
import { t } from '@/lib/i18n'

interface FAQProps {
  locale: Locale
}

export function FAQ({ locale }: FAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const text = t(locale).faq

  return (
    <section className="py-24 px-4 bg-secondary/30">
      <div className="mx-auto max-w-2xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{text.title}</h2>
        </div>
        <div className="space-y-3">
          {text.items.map((item, i) => (
            <div key={i} className="rounded-xl border bg-card overflow-hidden">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between p-4 text-left font-medium hover:bg-secondary/50 transition-colors"
              >
                {item.question}
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                    openIndex === i ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {openIndex === i && (
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  {item.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
