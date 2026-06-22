'use client'
import { useQuery } from '@tanstack/react-query'
import { BellRing, CircleAlert, Pencil, Trash2 } from 'lucide-react'
import { auditLogApi } from '@/api/audit-log.api'
import { formatDateTime } from '@/utils/format'

const iconFor = (action: string) => action === 'DELETE' ? <Trash2 size={16} /> : action === 'PATCH' || action === 'PUT' ? <Pencil size={16} /> : <CircleAlert size={16} />
const labelFor = (action: string) => ({ POST: '새 작업', PUT: '수정됨', PATCH: '수정됨', DELETE: '삭제됨' }[action] || action)

export default function AlertsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['alerts'], queryFn: () => auditLogApi.findAll({ limit: 50 }), refetchInterval: 30000 })
  const alerts = data?.items ?? []
  return <div className="flex h-[calc(100vh-150px)] min-h-0 flex-col gap-3 overflow-hidden">
    <div><h2 className="flex items-center gap-2 text-lg font-bold"><BellRing size={18} /> 알림</h2><p className="text-xs text-gray-500">수정·삭제 등 최근 변경 사항을 30초마다 갱신합니다.</p></div>
    <div className="min-h-0 flex-1 overflow-auto border bg-white dark:bg-gray-900">
      {isLoading && <p className="p-6 text-sm text-gray-400">알림을 불러오는 중…</p>}
      {!isLoading && alerts.length === 0 && <p className="p-10 text-center text-sm text-gray-400">새 알림이 없습니다.</p>}
      {alerts.map((alert) => <div key={alert.id} className="flex gap-3 border-b px-4 py-3 last:border-0">
        <span className={alert.action === 'DELETE' ? 'mt-0.5 text-red-500' : 'mt-0.5 text-[#D2691E]'}>{iconFor(alert.action)}</span>
        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{labelFor(alert.action)} · {alert.targetType}</p><p className="mt-0.5 text-xs text-gray-500">{alert.summary}</p><p className="mt-1 text-xs text-gray-400">{alert.actor || 'system'} · {formatDateTime(alert.createdAt)}</p></div>
      </div>)}
    </div>
  </div>
}
