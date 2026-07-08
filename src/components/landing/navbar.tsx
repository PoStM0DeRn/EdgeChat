'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { Locale } from '@/lib/i18n'

interface NavbarProps {
  locale: Locale
  onLocaleChange: (locale: Locale) => void
}

export function Navbar({ locale, onLocaleChange }: NavbarProps) {
  const text = locale === 'ru' ? 'ru' : 'en'
  const labels = locale === 'ru'
    ? { features: 'Возможности', pricing: 'Тарифы', docs: 'Документация', login: 'Войти', start: 'Начать бесплатно' }
    : { features: 'Features', pricing: 'Pricing', docs: 'Docs', login: 'Log in', start: 'Get Started' }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/landing" className="flex items-center gap-2 font-bold text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background text-sm font-bold">
              E
            </div>
            EdgeChat
          </Link>
          <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{labels.features}</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">{labels.pricing}</a>
            <a href="https://github.com/PoStM0DeRn/EdgeChat" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">{labels.docs}</a>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onLocaleChange(locale === 'ru' ? 'en' : 'ru')}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border"
          >
            {locale === 'ru' ? 'EN' : 'RU'}
          </button>
          <Link href="/login">
            <Button variant="ghost" size="sm">{labels.login}</Button>
          </Link>
          <Link href="/register">
            <Button size="sm">{labels.start}</Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}
