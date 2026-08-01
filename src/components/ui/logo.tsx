import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  showTagline?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function Logo({ showTagline = false, className, size = 'md' }: LogoProps) {
  const dimensions = { sm: 24, md: 32, lg: 48 }
  const px = dimensions[size]

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <Image
        src="/logo.png"
        alt="EdgeChat"
        width={px}
        height={px}
        className="shrink-0"
        style={{ width: px, height: px, objectFit: 'contain' }}
        unoptimized
      />
      <span className="font-bold leading-none" style={{ fontSize: px * 0.5 }}>
        EDGECHAT
        {showTagline && (
          <span className="block text-xs font-normal text-muted-foreground leading-tight mt-0.5">
            YOUR LOCAL AI, ANYWHERE
          </span>
        )}
      </span>
    </span>
  )
}
