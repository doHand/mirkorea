'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { categoryApi } from '@/api/product.api'
import { cn } from '@/utils/cn'
import type { ProductCategory } from '@/types/api.types'

interface Props {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  variant?: 'cell' | 'input'
}

export function CategorySelect({ value, onChange, placeholder = '카테고리 선택...', className, variant = 'input' }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [pos, setPos] = useState({ top: 0, left: 0, width: 200 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const isCell = variant === 'cell'

  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: () => categoryApi.findAll(),
    staleTime: 60_000,
  })

  const filtered = search.trim()
    ? categories.filter((c: ProductCategory) => c.name.toLowerCase().includes(search.toLowerCase()))
    : categories

  const openDropdown = useCallback(() => {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    // flip up if near bottom of viewport
    const spaceBelow = window.innerHeight - rect.bottom
    const dropH = Math.min(280, filtered.length * 40 + 70)
    const top = spaceBelow < dropH ? rect.top - dropH - 4 : rect.bottom + 4
    setPos({ top, left: rect.left, width: Math.max(200, rect.width) })
    setOpen(true)
    setSearch('')
  }, [filtered.length])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t)) return
      if (dropdownRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const select = (name: string) => {
    onChange(name)
    setOpen(false)
    setSearch('')
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openDropdown() }}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-lg text-sm transition-colors',
          isCell
            ? 'h-7 px-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
            : cn(
                'border border-gray-200 dark:border-gray-700 px-3 py-2.5',
                'bg-white dark:bg-gray-800 outline-none',
                'focus:ring-2 focus:ring-indigo-500/40',
              ),
          open && isCell && 'bg-indigo-50 dark:bg-indigo-900/20',
          className,
        )}
      >
        <span className={cn(
          'flex-1 truncate text-left',
          value
            ? isCell ? 'text-gray-800 dark:text-gray-200' : 'text-gray-900 dark:text-gray-100'
            : isCell ? 'text-gray-300 dark:text-gray-700' : 'text-gray-400 dark:text-gray-500',
        )}>
          {value || (isCell ? '—' : placeholder)}
        </span>
        {!isCell && value ? (
          <span
            role="button"
            onClick={(e) => { e.stopPropagation(); onChange('') }}
            className="shrink-0 text-gray-400 hover:text-rose-500 cursor-pointer"
          >
            닫기
          </span>
        ) : (
          <span className={cn('shrink-0 text-gray-400 transition-transform duration-150 text-xs', open && 'rotate-180 inline-block')}>▾</span>
        )}
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[9999] overflow-hidden rounded border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <div className="p-2 border-b border-gray-100 dark:border-gray-800">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false)
                if (e.key === 'Enter' && filtered.length === 1) select(filtered[0].name)
              }}
              placeholder="검색..."
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-gray-800 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {value && (
              <button
                type="button"
                onClick={() => select('')}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                없음 (지우기)
              </button>
            )}
            {filtered.length === 0 && (
              <p className="py-6 text-center text-xs text-gray-400">카테고리 없음</p>
            )}
            {filtered.map((c: ProductCategory) => (
              <button
                key={c.id}
                type="button"
                onClick={() => select(c.name)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors',
                  c.name === value
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                    : 'text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800',
                )}
              >
                <span className="flex-1 text-left">{c.name}</span>
                {c.name === value && <span className="shrink-0 text-indigo-500 text-xs">✓</span>}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
