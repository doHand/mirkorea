'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { cn } from '@/utils/cn'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  isPending?: boolean
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  variant = 'default',
  isPending = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEscapeKey(onClose, open && !isPending)

  if (!open) return null

  const danger = variant === 'danger'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-sm rounded border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-start gap-3 px-5 py-4">
          <div
            className={cn(
              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded',
              danger
                ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300'
                : 'bg-[#edf0ec] text-[var(--color-primary)] dark:bg-gray-800',
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
            <p className="mt-1 text-sm leading-5 text-gray-500 dark:text-gray-400">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            title="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              'rounded px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50',
              danger
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]',
            )}
          >
            {isPending ? '처리 중...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
