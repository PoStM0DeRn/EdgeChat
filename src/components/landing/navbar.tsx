'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { Heart } from 'lucide-react'
import { DONATION_URL } from '@/lib/donation'
import type { Locale } from '@/lib/i18n'

interface NavbarProps {
  locale: Locale
  onLocaleChange: (locale: Locale) => void
}

export function Navbar({ locale, onLocaleChange }: NavbarProps) {
  const text = locale === 'ru' ? 'ru' : 'en'
  const labels = locale === 'ru'
    ? { features: 'Возможности', donate: 'Поддержать', docs: 'Документация', login: 'Войти', start: 'Начать бесплатно' }
    : { features: 'Features', donate: 'Donate', docs: 'Docs', login: 'Log in', start: 'Get Started' }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/">
            <Logo />
          </Link>
          <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{labels.features}</a>
            <a href="#donate" className="hover:text-foreground transition-colors">{labels.donate}</a>
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
          <a href={DONATION_URL} target="_blank" rel="noopener noreferrer" className="hidden sm:inline-flex">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Heart className="h-3.5 w-3.5 text-brand" />
              {labels.donate}
            </Button>
          </a>
          <Link href="/login" className="hidden sm:inline-flex">
            <Button variant="ghost" size="sm">{labels.login}</Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="bg-brand text-brand-foreground hover:bg-brand/90">{labels.start}</Button>
          </Link>
        </div>
      </div>
    </nav>
  )
}
