'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColDef } from 'ag-grid-community'
import { RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { auditLogApi } from '@/api/audit-log.api'
import { AppAgGrid } from '@/components/AppAgGrid'
import { GridActionButton } from '@/components/grid/GridActionButton'
import { GridPageLayout } from '@/components/grid/GridPageLayout'
import type { AuditLog } from '@/types/api.types'
import { formatDateTime, formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'

const ACTION_LABEL: Record<AuditLog['action'], string> = {
  POST: '등록', PUT: '수정', PATCH: '수정', DELETE: '삭제',
}
const ACTION_STYLE: Record<AuditLog['action'], string> = {
  POST: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  PUT: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
  PATCH: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
  DELETE: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
}
const TARGET_LABEL: Record<string, string> = {
  products: '상품',
  clients: '거래처',
  categories: '카테고리',
  warehouses: '창고',
  locations: '위치',
  zones: '구역',
  users: '사용자',
  quotes: '문서',
  inbound: '입고',
  outbound: '출고',
  stock: '재고',
  barcodes: '바코드',
}
const ACTION_FILTERS = [
  { value: '', label: '전체 작업' },
  { value: 'POST', label: '등록' },
  { value: 'UPDATE', label: '수정' },
  { value: 'DELETE', label: '삭제' },
]
const RESTORABLE = new Set(['products', 'clients'])

function getTargetLabel(targetType?: string) {
  if (!targetType) return '-'
  return TARGET_LABEL[targetType] ?? targetType
}

function getReadableSummary(log: AuditLog) {
  const target = getTargetLabel(log.targetType)
  const action = ACTION_LABEL[log.action] ?? log.action
  if (log.summary && log.summary !== `${log.action} · ${log.targetType}`) return log.summary
  return `${target} ${action} 작업`
}

function shortId(id?: string) {
  if (!id) return '-'
  return id.length > 12 ? `${id.slice(0, 8)}...` : id
}

function getActorLabel(actor?: string) {
  if (!actor) return '-'
  if (actor === 'system') return '시스템'
  return actor
}

export default function AuditLogsPage() {
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('')
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', search, action, page],
    queryFn: () => auditLogApi.findAll({ search: search || undefined, action: action || undefined, page, limit: 100 }),
  })
  const restore = useMutation({
    mutationFn: auditLogApi.restore,
    onSuccess: () => {
      toast.success('복원했습니다.')
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
    },
    onError: () => toast.error('복원할 수 없는 기록입니다.'),
  })

  const resetFilters = () => {
    setSearch('')
    setAction('')
    setPage(1)
  }

  // Action renderers stay with the page because restore permissions are business-specific.
  const columns = useMemo<ColDef<AuditLog>[]>(() => [
    { headerName: '일시', width: 165, valueGetter: (p) => p.data ? formatDateTime(p.data.createdAt) : '-' },
    {
      headerName: '작업',
      width: 95,
      valueGetter: (p) => p.data ? ACTION_LABEL[p.data.action] : '-',
      cellRenderer: (p: { data?: AuditLog }) => p.data
        ? <span className={cn('inline-flex rounded px-2 py-0.5 text-xs font-semibold', ACTION_STYLE[p.data.action])}>{ACTION_LABEL[p.data.action]}</span>
        : '-',
    },
    { headerName: '대상', width: 115, valueGetter: (p) => getTargetLabel(p.data?.targetType) },
    {
      headerName: '내용',
      minWidth: 260,
      flex: 1.4,
      valueGetter: (p) => p.data ? getReadableSummary(p.data) : '-',
      cellRenderer: (p: { data?: AuditLog }) => p.data ? (
        <div className="leading-tight">
          <p className="font-medium text-gray-900 dark:text-white">{getReadableSummary(p.data)}</p>
          <p className="mt-0.5 truncate text-[11px] text-gray-400 dark:text-slate-500">
            {[p.data.requestPath, p.data.targetId && `ID ${shortId(p.data.targetId)}`].filter(Boolean).join(' · ') || '-'}
          </p>
        </div>
      ) : '-',
    },
    { headerName: '작업자', width: 150, valueGetter: (p) => getActorLabel(p.data?.actor) },
    {
      headerName: '복원',
      width: 105,
      sortable: false,
      filter: false,
      cellRenderer: (p: { data?: AuditLog }) => p.data?.action === 'DELETE' && RESTORABLE.has(p.data.targetType)
        ? <GridActionButton onClick={() => restore.mutate(p.data!.id)} disabled={restore.isPending} className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">복원</GridActionButton>
        : '-',
    },
  ], [restore])

  return <GridPageLayout title="수정·삭제 로그" description="삭제된 상품과 거래처는 복원할 수 있습니다.">
    <div className="rounded border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-36 text-xs font-medium text-gray-500 dark:text-gray-400">
          작업
          <select value={action} onChange={(event) => { setAction(event.target.value); setPage(1) }} className="mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
            {ACTION_FILTERS.map((item) => <option key={item.value || 'all'} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="min-w-64 flex-1 text-xs font-medium text-gray-500 dark:text-gray-400">
          검색
          <input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1) }}
            placeholder="대상, 작업자, 경로, ID 검색"
            className="mt-1 w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </label>
        <button
          type="button"
          onClick={resetFilters}
          className="wms-toolbar-action inline-flex h-9 items-center gap-1.5 rounded px-3 text-xs font-semibold transition-colors"
        >
          <RotateCcw size={13} />
          초기화
        </button>
        <span className="ml-auto rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600 dark:bg-slate-800 dark:text-slate-300">
          최신 {formatNumber(data?.total ?? 0)}건
        </span>
      </div>
    </div>
    <div className="min-h-0 flex-1 overflow-hidden rounded border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <AppAgGrid rows={data?.items ?? []} columns={columns} loading={isLoading} />
    </div>
    {data && data.totalPages > 1 && (
      <div className="flex items-center justify-center gap-2">
        <button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900">이전</button>
        <span className="min-w-20 text-center text-sm text-gray-500">{page} / {data.totalPages}</span>
        <button onClick={() => setPage((current) => Math.min(data.totalPages, current + 1))} disabled={page === data.totalPages} className="rounded border border-gray-200 bg-white px-3 py-1.5 text-sm disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900">다음</button>
      </div>
    )}
  </GridPageLayout>
}
