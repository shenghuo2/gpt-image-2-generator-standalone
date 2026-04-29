import * as React from 'react'
import { cn } from '@/lib/utils'

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'ghost' | 'outline'; size?: 'default' | 'sm' | 'icon' }
>(({ className, variant = 'default', size = 'default', ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
      variant === 'default' && 'bg-primary text-primary-foreground hover:bg-primary/90',
      variant === 'ghost' && 'hover:bg-accent hover:text-accent-foreground',
      variant === 'outline' && 'border border-input bg-background hover:bg-accent',
      size === 'default' && 'h-9 px-4 py-2 text-sm',
      size === 'sm' && 'h-7 px-3 text-xs',
      size === 'icon' && 'h-8 w-8',
      className
    )}
    {...props}
  />
))
Button.displayName = 'Button'

export { Button }
