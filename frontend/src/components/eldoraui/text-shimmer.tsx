// TextShimmer - attention-grabbing text with shimmer effect
import { cn } from '@/lib/utils'

interface TextShimmerProps {
  children: React.ReactNode
  className?: string
  speed?: number
}

export function TextShimmer({ children, className, speed = 1.5 }: TextShimmerProps) {
  return (
    <span
      className={cn(
        'inline-block bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-clip-text text-transparent animate-shimmer bg-[length:200%_100%]',
        className
      )}
      style={{
        animationDuration: `${speed}s`,
      }}
    >
      {children}
    </span>
  )
}