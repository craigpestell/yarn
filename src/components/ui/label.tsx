import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/** Wrapping label (control is a child), stacked by default; `inline` puts the control beside the text. */
export function Label({ className, inline, ...props }: ComponentProps<'label'> & { inline?: boolean }) {
  return <label className={cn('flex gap-0.5 text-[0.85rem]', inline ? 'flex-row items-center gap-1.5' : 'flex-col', className)} {...props} />
}
