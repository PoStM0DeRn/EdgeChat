'use client'

import Link from 'next/link'
import type { Locale } from '@/lib/i18n'
import { t } from '@/lib/i18n'

interface FooterProps {
  locale: Locale
}

export function Footer({ locale }: FooterProps) {
  const text = t(locale).footer

  return (
    <footer className="border-t py-12 px-4">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/landing" className="flex items-center gap-2 font-bold text-lg mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background text-sm font-bold">
                E
              </div>
              EdgeChat
            </Link>
            <p className="text-sm text-muted-foreground">{text.description}</p>
          </div>
          <div>
            <h4 className="font-semibold mb-3">{text.product}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#features" className="hover:text-foreground transition-colors">{text.features}</a></li>
              <li><a href="#pricing" className="hover:text-foreground transition-colors">{text.pricing}</a></li>
              <li><a href="https://github.com/PoStM0DeRn/EdgeChat" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">{text.docs}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">{text.company}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">{text.about}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{text.contact}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{text.blog}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">{text.legal}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">{text.privacy}</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">{text.terms}</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
          {text.copyright}
        </div>
      </div>
    </footer>
  )
}
