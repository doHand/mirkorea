'use client'
import { usePathname } from 'next/navigation'
import { useMenuPermissionStore } from '@/stores/menu-permission.store'

export function useMenuLabel(fallback = ''): string {
  const pathname = usePathname()
  const menus = useMenuPermissionStore((s) => s.menus)
  const menu = menus.find(
    (m) => m.href === pathname || (m.href !== '/' && pathname.startsWith(m.href))
  )
  return menu?.label ?? fallback
}
