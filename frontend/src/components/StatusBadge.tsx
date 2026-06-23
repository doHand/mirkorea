'use client'
import { cn } from '@/utils/cn'

interface Props {
  label: string
  variant?: 'blue' | 'amber' | 'emerald' | 'purple' | 'red' | 'gray' | 'orange' | 'indigo'
  className?: string
}

const V: Record<string, string> = {
  blue:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  amber:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  purple:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  red:     'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  gray:    'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  orange:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  indigo:  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
}

export function StatusBadge({ label, variant = 'gray', className }: Props) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
      V[variant] ?? V.gray,
      className,
    )}>
      {label}
    </span>
  )
}
