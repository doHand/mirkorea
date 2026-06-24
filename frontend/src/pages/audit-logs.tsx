'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColDef } from 'ag-grid-community'
import toast from 'react-hot-toast'
import { auditLogApi } from '@/api/audit-log.api'
import { AppAgGrid } from '@/components/AppAgGrid'
import { GridActionButton } from '@/components/grid/GridActionButton'
import { GridPageLayout } from '@/components/grid/GridPageLayout'
import type { AuditLog } from '@/types/api.types'
import { formatDateTime } from '@/utils/format'

const ACTION_LABEL: Record<AuditLog['action'], string> = {
  POST: '등록', PUT: '수정', PATCH: '수정', DELETE: '삭제',
}
const RESTORABLE = new Set(['products', 'clients'])

export default function AuditLogsPage() {
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', search],
    queryFn: () => auditLogApi.findAll({ search, limit: 100 }),
  })
  const restore = useMutation({
    mutationFn: auditLogApi.restore,
    onSuccess: () => {
      toast.success('복원했습니다.')
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
    },
    onError: () => toast.error('복원할 수 없는 기록입니다.'),
  })

  // Action renderers stay with the page because restore permissions are business-specific.
  const columns = useMemo<ColDef<AuditLog>[]>(() => [
    { headerName: '일시', width: 165, valueGetter: (p) => p.data ? formatDateTime(p.data.createdAt) : '-' },
    { headerName: '작업', width: 90, valueGetter: (p) => p.data ? ACTION_LABEL[p.data.action] : '-' },
    { headerName: '대상', width: 120, field: 'targetType' },
    { headerName: '작업자', width: 120, valueGetter: (p) => p.data?.actor ?? '-' },
    { headerName: '경로', minWidth: 220, flex: 1, valueGetter: (p) => p.data?.requestPath ?? '-' },
    {
      headerName: '복원', width: 100, sortable: false, filter: false,
      cellRenderer: (p: { data?: AuditLog }) => p.data?.action === 'DELETE' && RESTORABLE.has(p.data.targetType)
        ? <GridActionButton onClick={() => restore.mutate(p.data!.id)} disabled={restore.isPending} className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">복원</GridActionButton>
        : '-',
    },
  ], [restore])

  return <GridPageLayout title="수정·삭제 로그" description="삭제된 상품과 거래처는 복원할 수 있습니다.">
    <div className="border p-2"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="작업 또는 대상 검색" className="w-full border py-1.5 pl-3 pr-2 text-sm" /></div>
    <div className="min-h-0 flex-1 border bg-white dark:bg-gray-900"><AppAgGrid rows={data?.items ?? []} columns={columns} loading={isLoading} /></div>
  </GridPageLayout>
}
