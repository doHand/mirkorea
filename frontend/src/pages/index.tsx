'use client'
import { useMemo, useState, type ElementType } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  Package, TrendingDown, Activity,
  ArrowUpCircle, ArrowDownCircle, Boxes, ClipboardCheck,
  ScanLine, Users, ShieldCheck, PackageCheck,
  Building2, Receipt, Ruler, FileText,
} from 'lucide-react'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { useAuthStore } from '@/stores/auth.store'
import { stockApi } from '@/api/stock.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { formatNumber } from '@/utils/format'
import { format, subDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { StockTransaction, UserRole } from '@/types/api.types'

const ROLE_DASHBOARD: Record<UserRole, {
  eyebrow: string
  title: string
  actions: { label: string; href: string; icon: ElementType }[]
}> = {
  ADMIN: {
    eyebrow: '최고 관리자 대시보드',
    title: '기준정보, 권한, 전체 운영을 관리합니다',
    actions: [
      { label: '상품 마스터', href: '/product-attrs', icon: Package },
      { label: '사용자 관리', href: '/users', icon: Users },
      { label: '메뉴 권한', href: '/menu-permissions', icon: ShieldCheck },
      { label: '거래처 관리', href: '/clients', icon: Building2 },
      { label: '단위 관리', href: '/units', icon: Ruler },
    ],
  },
  MANAGER: {
    eyebrow: '세미 관리자 대시보드',
    title: '거래처별 재고와 발주 업무를 관리합니다',
    actions: [
      { label: '거래처별 상품재고', href: '/product-attrs', icon: Building2 },
      { label: '발주서 페이지', href: '/quotes', icon: Receipt },
      { label: '상품 마스터', href: '/product-attrs', icon: Package },
      { label: '거래 이력', href: '/transactions', icon: ClipboardCheck },
    ],
  },
  WORKER: {
    eyebrow: '직원 작업 대시보드',
    title: '스캔과 상품 확인에 집중합니다',
    actions: [
      { label: '바코드 스캔', href: '/scan', icon: ScanLine },
      { label: '상품 관리', href: '/products', icon: Package },
      { label: '입고 처리', href: '/inbound', icon: PackageCheck },
    ],
  },
  VIEWER: {
    eyebrow: '조회용 대시보드',
    title: '재고 현황과 흐름을 조회합니다',
    actions: [
      { label: '상품 조회', href: '/products', icon: Package },
      { label: '거래 조회', href: '/transactions', icon: ClipboardCheck },
      { label: '상품 마스터', href: '/product-attrs', icon: FileText },
    ],
  },
}

const DASHBOARD_MODE_LABEL: Record<UserRole, string> = {
  ADMIN: '최고 관리자',
  MANAGER: '세미 관리자',
  WORKER: '직원',
  VIEWER: '조회',
}

const DASHBOARD_MODE_PERMISSIONS: Record<UserRole, UserRole[]> = {
  ADMIN: ['ADMIN', 'MANAGER', 'WORKER', 'VIEWER'],
  MANAGER: ['MANAGER', 'WORKER', 'VIEWER'],
  WORKER: ['WORKER'],
  VIEWER: ['VIEWER'],
}

type LowStockClientGroup = {
  clientId: string
  clientName: string
  items: any[]
  totalShortage: number
}

function ProductRankCard({
  title,
  caption,
  items,
  icon: Icon,
  tone,
}: {
  title: string
  caption: string
  items: { id: string; name: string; code?: string; qty: number }[]
  icon: ElementType
  tone: 'emerald' | 'rose'
}) {
  const toneCls = tone === 'emerald'
    ? {
        iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
        iconText: 'text-emerald-600 dark:text-emerald-300',
        pill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
      }
    : {
        iconBg: 'bg-rose-50 dark:bg-rose-950/40',
        iconText: 'text-rose-600 dark:text-rose-300',
        pill: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
      }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white/95 dark:bg-slate-900 rounded-[18px] border border-white/80 dark:border-slate-700 p-4 shadow-lg shadow-slate-900/5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-950 dark:text-white">{title}</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{caption}</p>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded ${toneCls.iconBg}`}>
          <Icon size={17} className={toneCls.iconText} />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded border border-gray-100 bg-gray-50/80 px-4 py-6 text-center text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
          집계할 거래 내역이 없습니다
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-2.5 overflow-hidden">
          {items.slice(0, 4).map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded border border-gray-100 bg-gray-50/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70"
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${toneCls.pill}`}>
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">{item.name}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">{item.code ?? '-'}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold tabular-nums text-gray-950 dark:text-white">{formatNumber(item.qty)}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">수량</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function LowStockByClientCard({
  groups,
  totalItems,
  compact = false,
}: {
  groups: LowStockClientGroup[]
  totalItems: number
  compact?: boolean
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white/95 dark:bg-slate-900 rounded-[18px] border border-white/80 dark:border-rose-700/60 p-4 shadow-lg shadow-slate-900/5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-700/60 flex items-center justify-center">
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-950 dark:text-white">거래처별 안전재고 미달</h3>
            <p className="text-xs text-rose-600 dark:text-rose-200">
              {formatNumber(groups.length)}개 거래처 · {formatNumber(totalItems)}개 품목
            </p>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="rounded border border-gray-100 bg-gray-50/80 px-4 py-6 text-center text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300">
          현재 안전재고 미달 품목이 없습니다
        </div>
      ) : (
        <div className={compact ? 'min-h-0 flex-1 space-y-2 overflow-hidden' : 'grid grid-cols-1 xl:grid-cols-2 gap-2'}>
          {groups.slice(0, compact ? 3 : 4).map((group) => (
            <div
              key={group.clientId}
              className="rounded border border-rose-100 bg-rose-50/60 p-2.5 dark:border-rose-700/50 dark:bg-rose-950/35"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-950 dark:text-white">{group.clientName}</p>
                  <p className="text-[11px] text-rose-600 dark:text-rose-200">
                    {formatNumber(group.items.length)}개 품목 · 부족 {formatNumber(group.totalShortage)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white/80 px-2 py-1 text-xs font-bold tabular-nums text-rose-600 dark:bg-slate-900/70 dark:text-rose-200">
                  {formatNumber(group.items.length)}
                </span>
              </div>
              <div className="space-y-1.5">
                {group.items.slice(0, compact ? 1 : 2).map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-3 rounded border border-white/70 bg-white/75 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900/55"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-gray-800 dark:text-slate-100">{inv.product?.name}</p>
                      <p className="text-[10px] text-gray-500 dark:text-slate-300">{inv.location?.code ?? '-'}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-bold text-rose-600 dark:text-rose-100">{formatNumber(inv.quantity)}</p>
                      <p className="text-[10px] text-gray-400 dark:text-slate-300">/ {formatNumber(inv.product?.safetyStock)}</p>
                    </div>
                  </div>
                ))}
                {group.items.length > (compact ? 1 : 2) && (
                  <p className="px-1 text-right text-[11px] font-medium text-rose-500 dark:text-rose-200">
                    외 {formatNumber(group.items.length - (compact ? 1 : 2))}개 더 있음
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SquareQuickLinksCard({
  actions,
}: {
  actions: { label: string; href: string; icon: ElementType }[]
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white/95 dark:bg-slate-900 rounded-[18px] border border-white/80 dark:border-slate-700 p-4 shadow-lg shadow-slate-900/5">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-gray-950 dark:text-white">업무 바로가기</h3>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        {actions.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex aspect-square min-h-24 flex-col items-center justify-center gap-2 rounded border border-gray-200 bg-gray-50 text-center transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/35"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded bg-white text-gray-700 shadow-sm transition-colors group-hover:text-indigo-700 dark:bg-slate-900 dark:text-slate-100">
              <Icon size={18} />
            </span>
            <span className="px-2 text-xs font-bold text-gray-800 dark:text-slate-100">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const userRole = useAuthStore((s) => s.user?.role) ?? 'WORKER'
  const allowedModes = DASHBOARD_MODE_PERMISSIONS[userRole]
  const [selectedMode, setSelectedMode] = useState<UserRole>(userRole)
  const [quickLinksOpen, setQuickLinksOpen] = useState(false)
  const role = allowedModes.includes(selectedMode) ? selectedMode : allowedModes[0]
  const roleView = ROLE_DASHBOARD[role]

  const { data: summary } = useQuery({
    queryKey: QUERY_KEYS.invSummary(warehouse?.id ?? ''),
    queryFn:  () => stockApi.getSummary(warehouse!.id),
    enabled:  !!warehouse?.id,
  })

  const { data: lowStock = [] } = useQuery({
    queryKey: QUERY_KEYS.lowStock(warehouse?.id ?? ''),
    queryFn:  () => stockApi.getLowStock(warehouse!.id),
    enabled:  !!warehouse?.id,
  })

  const { data: txPage } = useQuery({
    queryKey: QUERY_KEYS.transactions({ warehouseId: warehouse?.id, limit: 200 }),
    queryFn:  () => stockApi.getTransactions({ warehouseId: warehouse!.id, limit: 200 }),
    enabled:  !!warehouse?.id,
  })

  const transactions: StockTransaction[] = txPage?.items ?? []

  const totalTransactions7 = useMemo(() => {
    const start = subDays(new Date(), 6)
    start.setHours(0, 0, 0, 0)
    return transactions.filter((txn) => new Date(txn.createdAt) >= start).length
  }, [transactions])

  const productRanks = useMemo(() => {
    const rankBy = (txType: 'INBOUND' | 'OUTBOUND') => {
      const map = new Map<string, { id: string; name: string; code?: string; qty: number }>()
      transactions
        .filter((txn) => txn.txType === txType)
        .forEach((txn) => {
          const id = txn.productId
          const current = map.get(id) ?? {
            id,
            name: txn.product?.name ?? '상품 정보 없음',
            code: txn.product?.code,
            qty: 0,
          }
          current.qty += Math.abs(txn.qty)
          map.set(id, current)
        })
      return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5)
    }

    return {
      inbound: rankBy('INBOUND'),
      outbound: rankBy('OUTBOUND'),
    }
  }, [transactions])

  const lowStockByClient = useMemo(() => {
    const groups = new Map<string, LowStockClientGroup>()

    ;(lowStock as any[]).forEach((inv) => {
      const clientId = inv.product?.client?.id ?? inv.product?.clientId ?? 'none'
      const clientName = inv.product?.client?.name ?? '거래처 미지정'
      const safetyStock = Number(inv.product?.safetyStock ?? 0)
      const quantity = Number(inv.quantity ?? 0)
      const shortage = Math.max(0, safetyStock - quantity)
      const group: LowStockClientGroup = groups.get(clientId) ?? {
        clientId,
        clientName,
        items: [],
        totalShortage: 0,
      }

      group.items.push(inv)
      group.totalShortage += shortage
      groups.set(clientId, group)
    })

    return [...groups.values()]
      .sort((a, b) => b.items.length - a.items.length || b.totalShortage - a.totalShortage)
  }, [lowStock])

  const lowStockPreview = useMemo(() => {
    return [...(lowStock as any[])]
      .sort((a, b) => {
        const aShortage = Number(a.product?.safetyStock ?? 0) - Number(a.quantity ?? 0)
        const bShortage = Number(b.product?.safetyStock ?? 0) - Number(b.quantity ?? 0)
        return bShortage - aShortage
      })
      .slice(0, 6)
  }, [lowStock])

  if (!warehouse) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <p className="text-sm">상단에서 창고를 선택해주세요</p>
        </div>
      </div>
    )
  }

  const stats = [
    {
      label: '전체 SKU',
      value: summary?.totalSkus ?? 0,
      icon: Package,
      sub: '등록 상품 종류',
      tone: 'text-white',
      bg: 'bg-gradient-to-br from-blue-500 to-indigo-600',
      border: 'border-blue-300/30',
    },
    {
      label: '총 재고 수량',
      value: summary?.totalQty ?? 0,
      icon: Boxes,
      sub: '전체 보관 수량',
      tone: 'text-white',
      bg: 'bg-gradient-to-br from-cyan-400 to-blue-500',
      border: 'border-cyan-200/40',
    },
    {
      label: '안전재고 미달',
      value: summary?.lowStockCount ?? 0,
      icon: TrendingDown,
      sub: '보충 필요 품목',
      tone: 'text-white',
      bg: 'bg-gradient-to-br from-rose-500 to-red-600',
      border: 'border-rose-200/40',
    },
    {
      label: '7일 거래',
      value: totalTransactions7,
      icon: Activity,
      sub: '입출고 트랜잭션',
      tone: 'text-white',
      bg: 'bg-gradient-to-br from-violet-500 to-fuchsia-500',
      border: 'border-violet-200/40',
    },
  ]

  return (
    <div className="flex min-h-[calc(100vh-10.5rem)] flex-col gap-3">
      <div className="rounded-[18px] border border-white/80 bg-white/95 p-2.5 shadow-lg shadow-slate-900/5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-gray-950 dark:text-white">{DASHBOARD_MODE_LABEL[role]} 대시보드</h2>
              <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-500 dark:bg-slate-800 dark:text-slate-300">
                {warehouse.name}
              </span>
              <span className="text-xs text-gray-400 dark:text-slate-400">
                {format(new Date(), 'M월 d일 EEEE', { locale: ko })}
              </span>
            </div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded border border-gray-200 bg-gray-50 p-1 dark:border-slate-700 dark:bg-slate-800">
              {allowedModes.map((mode) => (
                <button
                  key={mode}
                  onClick={() => setSelectedMode(mode)}
                  className={`h-8 shrink-0 rounded px-3 text-xs font-semibold transition-colors ${
                    role === mode
                      ? 'bg-gray-950 text-white dark:bg-white dark:text-slate-950'
                      : 'text-gray-500 hover:bg-white hover:text-gray-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
                  }`}
                >
                  {DASHBOARD_MODE_LABEL[mode]}
                </button>
              ))}
            </div>

            {(role === 'ADMIN' || role === 'MANAGER') && (
              <button
                onClick={() => setQuickLinksOpen((open) => !open)}
                className="inline-flex h-10 items-center gap-2 rounded border border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-gray-600 transition-colors hover:bg-white hover:text-gray-950 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                aria-expanded={quickLinksOpen}
              >
                업무 바로가기
                <span className={`transition-transform inline-block text-xs ${quickLinksOpen ? 'rotate-180' : ''}`}>▼</span>
              </button>
            )}
          </div>
        </div>

        {quickLinksOpen && (role === 'ADMIN' || role === 'MANAGER') && (
          <div className="mt-2 flex flex-wrap gap-2 border-t border-gray-100 pt-2 dark:border-slate-700">
            {roleView.actions.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex h-9 items-center gap-2 rounded border border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-gray-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-500"
              >
                <Icon size={14} />
                {label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, bg, border, tone, sub }) => (
          <div key={label} className={label === '안전재고 미달' ? 'group relative z-20' : 'relative'}>
            <div className={`relative overflow-hidden rounded-[16px] border ${border} ${bg} p-4 text-white shadow-xl shadow-slate-900/10`}>
              <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/18" />
              <div className="pointer-events-none absolute right-8 top-10 h-16 w-16 rounded bg-white/12 rotate-45" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-white/85">{label}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-white">{formatNumber(value)}</p>
                </div>
                {label === '안전재고 미달' ? (
                  <Link
                    href="/products?safety=1"
                    className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded border border-white/25 bg-white/18 backdrop-blur transition-colors hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/70"
                    title="안전재고 미달 상품만 보기"
                    aria-label="안전재고 미달 상품만 보기"
                  >
                    <Icon size={18} className={tone} />
                  </Link>
                ) : (
                  <div className="w-10 h-10 rounded border border-white/25 bg-white/18 flex items-center justify-center shrink-0 backdrop-blur">
                    <Icon size={18} className={tone} />
                  </div>
                )}
              </div>
              <div className="relative mt-3 flex items-center justify-between border-t border-white/20 pt-2">
                <p className="text-xs text-white/75">{sub}</p>
                <span className="h-1.5 w-10 rounded-full bg-white/50" />
              </div>
            </div>

            {label === '안전재고 미달' && (
              <div className="pointer-events-none invisible absolute left-0 top-[calc(100%+8px)] z-50 w-full min-w-72 translate-y-1 rounded border border-rose-200 bg-white p-3 opacity-0 shadow-2xl transition-all group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 dark:border-rose-800 dark:bg-slate-900">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-gray-950 dark:text-white">안전재고 미달 미리보기</p>
                  <span className="text-[10px] font-semibold text-rose-500">{formatNumber((lowStock as any[]).length)}개 품목</span>
                </div>
                {lowStockPreview.length === 0 ? (
                  <p className="rounded bg-gray-50 px-3 py-4 text-center text-xs text-gray-400 dark:bg-slate-800">미달 품목이 없습니다</p>
                ) : (
                  <div className="space-y-1.5">
                    {lowStockPreview.map((inv) => (
                      <div key={inv.id} className="flex items-center gap-2 rounded bg-rose-50/70 px-2.5 py-2 dark:bg-rose-950/35">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">{inv.product?.name ?? '상품 정보 없음'}</p>
                          <p className="truncate text-[10px] text-gray-400">{inv.product?.code ?? '-'} · {inv.location?.code ?? '위치 미지정'}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-bold tabular-nums text-rose-600 dark:text-rose-300">{formatNumber(inv.quantity ?? 0)}</p>
                          <p className="text-[10px] text-gray-400">안전 {formatNumber(inv.product?.safetyStock ?? 0)}</p>
                        </div>
                      </div>
                    ))}
                    {(lowStock as any[]).length > lowStockPreview.length && (
                      <p className="pt-1 text-center text-[10px] font-medium text-rose-500">
                        외 {formatNumber((lowStock as any[]).length - lowStockPreview.length)}개 더 있음
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {role === 'ADMIN' || role === 'MANAGER' ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-3 gap-3">
          <LowStockByClientCard
            groups={lowStockByClient}
            totalItems={(lowStock as any[]).length}
            compact
          />
          <ProductRankCard
            title="제일 많이 들어온 품목"
            caption="입고 수량 기준"
            items={productRanks.inbound}
            tone="emerald"
            icon={ArrowUpCircle}
          />
          <ProductRankCard
            title="제일 많이 나간 품목"
            caption="출고 수량 기준"
            items={productRanks.outbound}
            tone="rose"
            icon={ArrowDownCircle}
          />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(280px,1fr)_minmax(0,2fr)] gap-3">
          <SquareQuickLinksCard actions={roleView.actions} />
          <LowStockByClientCard
            groups={lowStockByClient}
            totalItems={(lowStock as any[]).length}
          />
        </div>
      )}

    </div>
  )
}
