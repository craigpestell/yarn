import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const control = 'rounded border border-input bg-white px-1.5 py-1 text-foreground'

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  const kind = type === 'checkbox' ? 'size-4' : type === 'color' ? 'h-8 w-full cursor-pointer p-0.5' : control
  return <input type={type} className={cn('font-[inherit]', kind, className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(control, className)} {...props} />
}

/** Native select, Tailwind-styled (keeps selectOptions and platform behaviour). */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(control, className)} {...props} />
}
