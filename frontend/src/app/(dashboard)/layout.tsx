'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { SidebarNav } from '@/layouts/sidebar-nav'
import { HeaderBar } from '@/layouts/header-bar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const isAuth = useAuthStore((s) => s.isAuth)

  useEffect(() => {
    if (!isAuth) router.push('/login')
  }, [isAuth, router])

  if (!isAuth) return null

  return (
    <div className="flex h-screen bg-gray-50">
      <SidebarNav />
      <div className="flex-1 flex flex-col min-w-0">
        <HeaderBar />
        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>
    </div>
  )
}
