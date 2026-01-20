// frontend/src/components/ui/button.tsx
// Button component with variants - mobile-first responsive design
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-border bg-background hover:bg-muted',
        secondary: 'bg-muted text-foreground hover:bg-muted/80',
        ghost: 'hover:bg-muted',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        xs: 'h-8 px-2 py-1.5 sm:px-2.5 sm:py-2 sm:h-8 text-xs sm:text-xs',
        sm: 'h-9 px-2.5 py-1.5 sm:px-3 sm:py-2 sm:h-9 text-xs sm:text-sm',
        default: 'h-10 px-3 py-2 sm:px-4 sm:py-2 sm:h-9 text-sm sm:text-sm',
        lg: 'h-11 px-4 py-2.5 sm:px-6 sm:py-3 sm:h-10 text-sm sm:text-base',
        icon: 'h-9 w-9 sm:h-8 sm:w-8',
        'icon-sm': 'h-8 w-8 sm:h-7 sm:w-7',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
