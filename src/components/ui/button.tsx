import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** Embossed label-maker tape: near-black strip, light lettering, a raised top edge. */
const TAPE = 'bg-primary text-primary-foreground border-tape-edge shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_0_rgba(0,0,0,0.45)] [text-shadow:0_-1px_0_rgba(0,0,0,0.7)] enabled:hover:bg-primary-hover'

// No focus-visible styling here: the single global :focus-visible outline in styles.css applies.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-[3px] border px-2.5 py-1 font-semibold tracking-wide cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default: TAPE,
        destructive: 'bg-transparent text-destructive-foreground border-2 border-destructive font-bold enabled:hover:bg-destructive-soft',
        toggle: `${TAPE} aria-pressed:bg-yarn aria-pressed:border-yarn-edge aria-pressed:enabled:hover:bg-yarn`,
        menuitem: 'w-full justify-start gap-2.5 whitespace-nowrap rounded-[2px] border-transparent bg-transparent px-3 py-2 text-left font-medium text-primary-foreground enabled:hover:bg-white/10',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function Button({ className, variant, type = 'button', ...props }: ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({ variant }), className)} {...props} />
}
