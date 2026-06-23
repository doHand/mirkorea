'use client'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { auditLogApi } from '@/api/audit-log.api'
import { formatDateTime } from '@/utils/format'

const ACTION_LABEL: Record<string, string> = { POST: '등록', PUT: '수정', PATCH: '수정', DELETE: '삭제' }
const RESTORABLE = new Set(['products', 'clients'])

export default function AuditLogsPage() {
  const [search, setSearch] = useState('')
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['audit-logs', search], queryFn: () => auditLogApi.findAll({ search, limit: 100 }) })
  const restore = useMutation({ mutationFn: auditLogApi.restore, onSuccess: () => { toast.success('복원했습니다.'); qc.invalidateQueries({ queryKey: ['audit-logs'] }) }, onError: () => toast.error('복원할 수 없는 기록입니다.') })
  return <div className="flex h-[calc(100vh-150px)] min-h-0 flex-col gap-3 overflow-hidden">
    <div className="flex items-center justify-between"><div><h2 className="flex items-center gap-2 text-lg font-bold">수정·삭제 로그</h2><p className="text-xs text-gray-500">삭제된 상품과 거래처는 여기서 복원할 수 있습니다.</p></div></div>
    <div className="flex gap-2 border p-2"><div className="relative flex-1"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="작업 또는 대상 검색" className="w-full border py-1.5 pl-3 pr-2 text-sm" /></div></div>
    <div className="min-h-0 flex-1 overflow-auto border bg-white dark:bg-gray-900"><table className="w-full text-sm"><thead className="sticky top-0 bg-[#2D4033] text-white"><tr><th className="p-2">일시</th><th className="p-2">작업</th><th className="p-2">대상</th><th className="p-2">작업자</th><th className="p-2">경로</th><th className="p-2">복원</th></tr></thead><tbody>{isLoading && <tr><td colSpan={6} className="p-8 text-center">불러오는 중…</td></tr>}{data?.items.map((log) => <tr key={log.id} className="border-b"><td className="p-2 text-xs">{formatDateTime(log.createdAt)}</td><td className="p-2">{ACTION_LABEL[log.action] || log.action}</td><td className="p-2">{log.targetType}</td><td className="p-2">{log.actor || '-'}</td><td className="p-2 font-mono text-xs">{log.requestPath}</td><td className="p-2 text-center">{log.action === 'DELETE' && RESTORABLE.has(log.targetType) && <button onClick={() => restore.mutate(log.id)} disabled={restore.isPending} className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs">복원</button>}</td></tr>)}</tbody></table></div>
  </div>
}
