'use client'
import { useState, type ReactNode } from 'react'
import { Menu, Warehouse } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { auditLogApi } from '@/api/audit-log.api'
import { formatDateTime } from '@/utils/format'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useTheme } from 'next-themes'

interface Props {
  onMenuClick?: () => void
  children?: ReactNode
}

export function HeaderBar({ onMenuClick, children }: Props) {
  const { user }                    = useAuthStore()
  const { resolvedTheme, setTheme } = useTheme()
  const warehouse                   = useWarehouseStore((s) => s.selectedWarehouse)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const { data: alerts } = useQuery({ queryKey: ['alerts'], queryFn: () => auditLogApi.findAll({ limit: 8 }), refetchInterval: 30000 })

  const today = format(new Date(), 'M/d (EEE)', { locale: ko })

  return (
    <header className="app-header dark:bg-slate-900 shrink-0 sticky top-0 z-30 border-b dark:border-slate-700">
      {/* 상단 컨트롤 행 */}
      <div className="h-[38px] flex items-center px-3 lg:px-4 gap-2">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 dark:text-slate-400 transition-colors"
          aria-label="메뉴 열기"
        >
          <Menu size={17} />
        </button>

        <div className="hidden lg:flex items-center gap-2">
          <span className="app-brand-accent h-2 w-2 rounded-full" />
          <span className="app-header-title text-[11px] font-bold uppercase tracking-[0.12em]">Operations console</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          {warehouse && (
            <div className="app-tabs hidden sm:flex items-center gap-1 px-2 py-0.5 rounded border dark:bg-slate-800 dark:border-slate-700">
              <Warehouse size={11} className="app-header-icon shrink-0" />
              <span className="text-[11px] font-medium text-gray-600 dark:text-slate-300 max-w-[80px] truncate">
                {warehouse.name}
              </span>
            </div>
          )}

          <span className="hidden md:block text-[11px] text-gray-400 dark:text-slate-500 font-medium tabular-nums px-1">
            {today}
          </span>

          <div className="h-4 w-px bg-gray-200 dark:bg-slate-700" />

          <button
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="px-1.5 py-0.5 text-[10px] font-medium rounded hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
            aria-label="테마 전환"
          >
            {resolvedTheme === 'dark' ? '라이트' : '다크'}
          </button>

          <div className="relative">
          <button onClick={() => setAlertsOpen((open) => !open)} className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-gray-100 dark:hover:bg-slate-800" title="알림 보기">
            <div className="app-user-avatar w-6 h-6 rounded flex items-center justify-center text-white font-bold text-xs shrink-0">
              {user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            <span className="hidden sm:block text-[12px] font-medium text-gray-700 dark:text-slate-300 max-w-[100px] truncate">
              {user?.fullName}
            </span>
            {!!alerts?.items.length && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{alerts.items.length}</span>}
          </button>
          {alertsOpen && <div className="absolute right-0 top-8 z-50 w-80 overflow-hidden rounded border border-gray-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center gap-2 border-b px-3 py-2 text-sm font-bold"><span className="app-notification-title text-xs font-bold">알림</span> 최근 알림</div>
            <div className="max-h-80 overflow-auto">{!alerts?.items.length && <p className="p-5 text-center text-xs text-gray-400">새 알림이 없습니다.</p>}{alerts?.items.map((alert) => <div key={alert.id} className="border-b px-3 py-2 last:border-0"><p className="text-xs font-semibold">{alert.targetType} · {alert.action}</p><p className="mt-0.5 truncate text-[11px] text-gray-500">{alert.summary}</p><p className="mt-1 text-[10px] text-gray-400">{formatDateTime(alert.createdAt)}</p></div>)}</div>
          </div>}
          </div>
        </div>
      </div>

      {/* 탭 행 — border-b가 있고 활성 탭이 이를 끊어냄 */}
      <div className="app-tabs flex items-end px-2 lg:px-3 dark:bg-slate-900 border-t dark:border-slate-800">
        {children}
      </div>
    </header>
  )
}
