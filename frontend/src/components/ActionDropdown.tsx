'use client'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/utils/cn'

export interface DropdownItem {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}

interface Props {
  label: string
  items: DropdownItem[]
  className?: string
  buttonClassName?: string
}

export function ActionDropdown({ label, items, className, buttonClassName }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700',
          'text-gray-600 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-800',
          'transition-colors font-medium',
          buttonClassName,
        )}
      >
        {label}
        <span className={cn('text-[10px] text-gray-400 transition-transform', open && 'rotate-180')}>▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] rounded border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 overflow-hidden">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              disabled={item.disabled}
              onClick={() => { item.onClick(); setOpen(false) }}
              className={cn(
                'w-full text-left px-3 py-2.5 text-sm transition-colors disabled:opacity-40',
                item.danger
                  ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                  : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
