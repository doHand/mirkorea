'use client'
import type { ReactNode } from 'react'
import { Menu, Sun, Moon } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
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

  const today = format(new Date(), 'M월 d일 EEEE', { locale: ko })

  return (
    <header className="h-16 bg-white/70 dark:bg-slate-900/90 backdrop-blur-md border-b border-white/70 dark:border-slate-700/80 flex items-center px-4 lg:px-6 gap-3 shrink-0 sticky top-0 z-30">
      {/* 모바일 햄버거 */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-xl bg-white/70 hover:bg-white dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-200 transition-colors shadow-sm"
        aria-label="메뉴 열기"
      >
        <Menu size={20} />
      </button>

      <div className="min-w-0 flex-1">
        {children}
      </div>

      {/* 날짜 */}
      <span className="hidden md:block text-xs text-gray-400 dark:text-slate-300 font-medium tabular-nums">
        {today}
      </span>

      {/* 다크 모드 토글 */}
      <button
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/80 hover:bg-white dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-100 transition-colors shadow-sm"
        aria-label="테마 전환"
      >
        {resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* 사용자 */}
      <div className="flex items-center gap-2 pl-1">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm shadow-blue-500/25">
          {user?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
        </div>
        <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-slate-100 max-w-[120px] truncate">
          {user?.fullName}
        </span>
      </div>
    </header>
  )
}
