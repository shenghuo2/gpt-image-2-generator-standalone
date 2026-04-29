import * as React from 'react'
import { cn } from '@/lib/utils'

function Badge({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors border-transparent bg-secondary text-secondary-foreground', className)}
      {...props}
    />
  )
}

export { Badge }
