'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColDef } from 'ag-grid-community'
import toast from 'react-hot-toast'
import { productApi } from '@/api/product.api'
import { AppAgGrid } from '@/components/AppAgGrid'
import { GridActionButton } from '@/components/grid/GridActionButton'
import { GridPageLayout } from '@/components/grid/GridPageLayout'
import { formatNumber } from '@/utils/format'
import type { Product } from '@/types/api.types'

export default function LotPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const { data, isLoading } = useQuery({ queryKey: ['products', search], queryFn: () => productApi.findAll({ search, limit: 200 }) })
  const updateLot = useMutation({
    mutationFn: ({ id, isLotManaged }: { id: string; isLotManaged: boolean }) => productApi.update(id, { isLotManaged }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      toast.success(`LOT 관리 ${variables.isLotManaged ? '활성화' : '비활성화'}`)
    },
    onError: () => toast.error('변경에 실패했습니다.'),
  })
  const products = data?.items ?? []
  const columns = useMemo<ColDef<Product>[]>(() => [
    { headerName: '코드', field: 'code', width: 130 },
    { headerName: '상품명', field: 'name', minWidth: 180, flex: 1 },
    { headerName: '카테고리', width: 140, valueGetter: (p) => p.data?.category ?? '-' },
    {
      headerName: 'LOT 관리', width: 120, sortable: false, filter: false,
      cellRenderer: (p: { data?: Product }) => p.data ? <GridActionButton onClick={() => updateLot.mutate({ id: p.data!.id, isLotManaged: !p.data!.isLotManaged })} disabled={updateLot.isPending} className={p.data.isLotManaged ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-gray-300 text-gray-600'}>{p.data.isLotManaged ? '활성' : '비활성'}</GridActionButton> : '-',
    },
  ], [updateLot])

  return <GridPageLayout title="LOT 관리" description="LOT 추적이 필요한 상품을 활성화합니다." toolbar={<div className="flex items-center gap-3"><span className="text-xs text-gray-400">LOT 활성 <strong className="text-[#D2691E]">{formatNumber(products.filter((product) => product.isLotManaged).length)}</strong>개</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="코드 / 상품명" className="w-48 rounded border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900" /></div>}>
    <div className="min-h-0 flex-1 overflow-hidden rounded border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"><AppAgGrid rows={products} columns={columns} loading={isLoading} /></div>
  </GridPageLayout>
}
