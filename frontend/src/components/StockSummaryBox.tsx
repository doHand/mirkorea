'use client'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'

interface Props {
  currentStock: number
  changeAmount: number
  unit?: string
  type?: 'inbound' | 'outbound'
  className?: string
}

export function StockSummaryBox({ currentStock, changeAmount, unit = 'EA', type = 'inbound', className }: Props) {
  const isOut = type === 'outbound'
  const afterStock = isOut ? currentStock - changeAmount : currentStock + changeAmount
  const insufficient = isOut && afterStock < 0

  return (
    <div className={cn(
      'rounded border p-3',
      insufficient
        ? 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20'
        : isOut
          ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20'
          : 'border-emerald-200 bg-[#f0f7f1] dark:border-emerald-900/50 dark:bg-emerald-950/20',
      className,
    )}>
      <div className="grid grid-cols-3 divide-x divide-gray-200 dark:divide-gray-700">
        <div className="px-3 text-center first:pl-0 last:pr-0">
          <p className="text-[11px] text-gray-500">현재 재고</p>
          <p className="mt-0.5 text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatNumber(currentStock)}<span className="ml-0.5 text-xs font-normal text-gray-400">{unit}</span>
          </p>
        </div>
        <div className="px-3 text-center">
          <p className="text-[11px] text-gray-500">{isOut ? '출고 예정' : '입고 예정'}</p>
          <p className={cn(
            'mt-0.5 text-base font-bold tabular-nums',
            isOut ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400',
          )}>
            {isOut ? '-' : '+'}{formatNumber(changeAmount)}<span className="ml-0.5 text-xs font-normal">{unit}</span>
          </p>
        </div>
        <div className="px-3 text-center">
          <p className="text-[11px] text-gray-500">{isOut ? '출고 후' : '입고 후'} 예상</p>
          <p className={cn(
            'mt-0.5 text-base font-bold tabular-nums',
            insufficient ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100',
          )}>
            {formatNumber(Math.max(0, afterStock))}<span className="ml-0.5 text-xs font-normal text-gray-400">{unit}</span>
          </p>
        </div>
      </div>
      {insufficient && (
        <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
          현재 재고({formatNumber(currentStock)}{unit})보다 출고 수량({formatNumber(changeAmount)}{unit})이 많습니다. 출고 가능 수량을 확인해주세요.
        </p>
      )}
    </div>
  )
}
