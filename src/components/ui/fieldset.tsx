import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Fieldset({ className, ...props }: ComponentProps<'fieldset'>) {
  return <fieldset className={cn('flex flex-col gap-1.5 rounded-[3px] border border-dashed border-border p-2', className)} {...props} />
}

export function FieldError({ className, ...props }: ComponentProps<'p'>) {
  return <p role="alert" className={cn('mt-1 text-destructive', className)} {...props} />
}
