'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

/** Shared compact action button used inside AG Grid action cells. */
export function GridActionButton({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return <button
    type="button"
    {...props}
    className={`inline-flex items-center justify-center rounded border px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
  >
    {children}
  </button>
}
