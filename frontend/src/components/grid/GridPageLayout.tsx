'use client'

import type { ReactNode } from 'react'

/**
 * Shared shell for full-height operational list pages.
 * Individual pages provide only their business filters, toolbar, and grid content.
 */
export function GridPageLayout({
  title,
  description,
  toolbar,
  children,
}: {
  title: string
  description?: string
  toolbar?: ReactNode
  children: ReactNode
}) {
  return <div className="flex h-[calc(100vh-150px)] min-h-0 flex-col gap-4 overflow-hidden">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-gray-400">{description}</p>}
      </div>
      {toolbar && <div className="self-start sm:self-auto">{toolbar}</div>}
    </header>
    {children}
  </div>
}
