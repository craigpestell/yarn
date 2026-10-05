import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

// No focus-visible styling here: the single global :focus-visible outline in styles.css applies.
const buttonVariants = cva(
  'inline-flex items-center justify-center rounded border px-2.5 py-1 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground border-border-strong enabled:hover:bg-stone-200',
        destructive: 'bg-destructive-soft text-destructive-foreground border-destructive enabled:hover:bg-red-200',
        toggle: 'bg-primary text-primary-foreground border-border-strong enabled:hover:bg-stone-200 aria-pressed:bg-green-500 aria-pressed:border-green-700 aria-pressed:enabled:hover:bg-green-500',
        menuitem: 'w-full justify-start text-left bg-primary text-primary-foreground border-border-strong enabled:hover:bg-stone-200',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function Button({ className, variant, type = 'button', ...props }: ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({ variant }), className)} {...props} />
}
