'use client'
import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useQuery } from '@tanstack/react-query'
import {
  Package, TrendingDown, Warehouse, Activity,
  ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { stockApi } from '@/api/stock.api'
import { QUERY_KEYS } from '@/constants/query-keys'
import { formatNumber } from '@/utils/format'
import { format, subDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { StockTransaction } from '@/types/api.types'

// recharts 전체를 하나의 동적 컴포넌트로 래핑 (Context 깨짐 방지)
const StockAreaChart = dynamic(
  () => import('@/components/StockAreaChart'),
  { ssr: false, loading: () => <div className="h-full flex items-center justify-center text-xs text-gray-400">차트 로딩 중...</div> }
)

const TX_META: Record<string, { label: string; cls: string }> = {
  INBOUND:         { label: '입고',    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  OUTBOUND:        { label: '출고',    cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  INBOUND_CANCEL:  { label: '입고취소', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
  OUTBOUND_CANCEL: { label: '출고취소', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
  ADJUST_INCREASE: { label: '조정+',   cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  ADJUST_DECREASE: { label: '조정-',   cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  MOVE_OUT:        { label: '이동출',  cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  MOVE_IN:         { label: '이동입',  cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  INITIAL:         { label: '초기화',  cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
}

export default function DashboardPage() {
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)

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

  const chartData = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const date    = subDays(new Date(), 6 - i)
      const label   = format(date, 'M/d', { locale: ko })
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      const dateStr = `${y}-${m}-${d}`
      const dayTxns = transactions.filter((t) => {
        const local = new Date(t.createdAt)
        const ty = local.getFullYear()
        const tm = String(local.getMonth() + 1).padStart(2, '0')
        const td = String(local.getDate()).padStart(2, '0')
        return `${ty}-${tm}-${td}` === dateStr
      })
      return {
        label,
        입고: dayTxns.filter((t) => t.txType === 'INBOUND').reduce((s, t) => s + t.qty, 0),
        출고: dayTxns.filter((t) => t.txType === 'OUTBOUND').reduce((s, t) => s + Math.abs(t.qty), 0),
      }
    }),
    [transactions]
  )

  const recentTxns = useMemo(
    () => [...transactions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8),
    [transactions]
  )

  if (!warehouse) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-500">
        <div className="text-center">
          <Warehouse size={40} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">상단에서 창고를 선택해주세요</p>
        </div>
      </div>
    )
  }

  const stats = [
    { label: '전체 SKU',     value: summary?.totalSkus ?? 0,  icon: Package,     bg: 'bg-brand-500',   iconBg: 'bg-brand-400',   sub: '등록 상품 종류' },
    { label: '총 재고 수량', value: summary?.totalQty ?? 0,   icon: Warehouse,   bg: 'bg-emerald-500', iconBg: 'bg-emerald-400', sub: '전체 보관 수량' },
    { label: '안전재고 미달', value: summary?.lowStockCount ?? 0, icon: TrendingDown, bg: 'bg-red-500', iconBg: 'bg-red-400',   sub: '보충 필요 품목' },
    { label: '7일 거래',     value: transactions.length,       icon: Activity,    bg: 'bg-violet-500',  iconBg: 'bg-violet-400',  sub: '입출고 트랜잭션' },
  ]

  return (
    <div className="space-y-5">
      {/* 헤딩 */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{warehouse.name}</h2>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
          {format(new Date(), 'yyyy년 M월 d일', { locale: ko })} 기준 현황
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
        {stats.map(({ label, value, icon: Icon, bg, iconBg, sub }) => (
          <div key={label} className={`${bg} rounded-2xl p-4 lg:p-5 text-white relative overflow-hidden`}>
            <div className={`${iconBg} w-9 h-9 rounded-xl flex items-center justify-center mb-3`}>
              <Icon size={18} className="text-white" />
            </div>
            <p className="text-2xl lg:text-3xl font-bold">{formatNumber(value)}</p>
            <p className="text-xs lg:text-sm font-semibold mt-1 opacity-90">{label}</p>
            <p className="text-[10px] lg:text-xs opacity-60 mt-0.5">{sub}</p>
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10" />
            <div className="absolute -right-2 -bottom-6 w-16 h-16 rounded-full bg-white/10" />
          </div>
        ))}
      </div>

      {/* 차트 + 최근 이력 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-4">최근 7일 입출고 현황</h3>
          <div className="w-full h-52 lg:h-60">
            <StockAreaChart data={chartData} />
          </div>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">최근 거래 이력</h3>
          <div className="space-y-2.5 overflow-y-auto" style={{ maxHeight: 260 }}>
            {recentTxns.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">거래 내역이 없습니다</p>
            ) : (
              recentTxns.map((txn) => {
                const meta = TX_META[txn.txType] ?? { label: txn.txType, cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' }
                const isIn = txn.txType === 'INBOUND'
                return (
                  <div key={txn.id} className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isIn ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-rose-50 dark:bg-rose-900/20'}`}>
                      {isIn
                        ? <ArrowUpCircle   size={14} className="text-emerald-500" />
                        : <ArrowDownCircle size={14} className="text-rose-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">
                        {txn.product?.name ?? '상품 정보 없음'}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">
                        {format(new Date(txn.createdAt), 'M/d HH:mm')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${meta.cls}`}>
                        {meta.label}
                      </span>
                      <p className={`text-xs font-bold mt-0.5 ${isIn ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isIn ? '+' : '-'}{formatNumber(Math.abs(txn.qty))}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* 안전재고 미달 */}
      {(lowStock as any[]).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            안전재고 미달 품목 ({(lowStock as any[]).length}건)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {(lowStock as any[]).slice(0, 6).map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/40">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">{inv.product?.name}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{inv.location?.code}</p>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{formatNumber(inv.quantity)}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">/ {formatNumber(inv.product?.safetyStock)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
