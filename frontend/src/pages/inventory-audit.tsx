'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { inventoryAuditApi } from '@/api/inventory-audit.api'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { formatNumber } from '@/utils/format'
import { cn } from '@/utils/cn'
import * as ui from '@/styles/ui'
import type { InventoryAudit, InventoryAuditItem } from '@/types/api.types'

const today = () => new Date().toISOString().slice(0, 10)

export default function InventoryAuditPage() {
  const qc = useQueryClient()
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const [showCreate, setShowCreate]     = useState(false)
  const [detailId,   setDetailId]       = useState<string | null>(null)
  const [createDate, setCreateDate]     = useState(today())
  const [createMemo, setCreateMemo]     = useState('')
  useEscapeKey(() => setShowCreate(false), showCreate)
  useEscapeKey(() => setDetailId(null), !!detailId)

  const { data: audits = [], isLoading } = useQuery({
    queryKey: ['inventory-audits', warehouse?.id],
    queryFn: () => inventoryAuditApi.list(warehouse!.id),
    enabled: !!warehouse?.id,
    select: (items) => items.map((audit) => ({ ...audit, items: audit.items ?? [] })),
  })

  const createMut = useMutation({
    mutationFn: () => inventoryAuditApi.create({ warehouseId: warehouse!.id, auditDate: createDate, memo: createMemo }),
    onSuccess: (audit) => {
      toast.success('재고조사가 생성되었습니다')
      qc.invalidateQueries({ queryKey: ['inventory-audits'] })
      setShowCreate(false)
      setCreateMemo('')
      setDetailId(audit.id)
    },
    onError: () => toast.error('생성에 실패했습니다'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => inventoryAuditApi.delete(id),
    onSuccess: () => { toast.success('삭제되었습니다'); qc.invalidateQueries({ queryKey: ['inventory-audits'] }) },
    onError: () => toast.error('삭제에 실패했습니다'),
  })

  if (!warehouse) return (
    <div className="py-20 text-center text-gray-400">창고를 먼저 선택하세요</div>
  )

  return (
    <div className="flex h-[calc(100vh-150px)] min-h-0 flex-col gap-4 overflow-hidden">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">재고조사</h2>
          <p className="text-xs text-gray-400 mt-0.5">월별 실사 수량을 입력하면 재고가 자동으로 조정됩니다</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="self-start sm:self-auto flex items-center gap-1.5 rounded bg-[var(--color-primary)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
        >
새 재고조사
        </button>
      </div>

      {/* 목록 테이블 */}
      <div className="flex min-h-0 flex-1 flex-col border border-[#d8ddd8] bg-white shadow-sm dark:bg-gray-900">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className={ui.thead}>
                <th className={cn(ui.th, 'text-left')}>조사일</th>
                <th className={cn(ui.th, 'text-left')}>메모</th>
                <th className={ui.th}>항목 수</th>
                <th className={ui.th}>차이 발생</th>
                <th className={ui.th}>상태</th>
                <th className="w-24 px-3 py-3" />
              </tr>
            </thead>
            <tbody className={ui.tbody}>
              {isLoading && (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">로딩 중...</td></tr>
              )}
              {!isLoading && audits.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-gray-400">등록된 재고조사가 없습니다</td></tr>
              )}
              {audits.map((audit) => {
                const auditItems = audit.items ?? []
                const diffCount = auditItems.filter((i) => i.countedQty !== null && i.countedQty !== i.systemQty).length
                return (
                  <tr
                    key={audit.id}
                    className={cn(ui.tr, 'cursor-pointer')}
                    onClick={() => setDetailId(detailId === audit.id ? null : audit.id)}
                  >
                    <td className="px-3 py-3 font-medium text-gray-900 dark:text-gray-100">{audit.auditDate}</td>
                    <td className="px-3 py-3 text-gray-500 dark:text-gray-400">{audit.memo || '-'}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{formatNumber(auditItems.length)}건</td>
                    <td className="px-3 py-3 text-center">
                      {diffCount > 0
                        ? <span className="text-orange-600 font-semibold">{formatNumber(diffCount)}건</span>
                        : <span className="text-gray-400">없음</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <StatusBadge status={audit.status} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-center gap-1">
                        <button
                          title="상세 보기"
                          onClick={(e) => { e.stopPropagation(); setDetailId(detailId === audit.id ? null : audit.id) }}
                          className={ui.btnIconEdit}
                        >
                          {detailId === audit.id ? '▲' : '▼'}
                        </button>
                        {audit.status === 'DRAFT' && (
                          <button
                            title="삭제"
                            onClick={(e) => { e.stopPropagation(); if (confirm('삭제하시겠습니까?')) deleteMut.mutate(audit.id) }}
                            className={ui.btnIconDelete}
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 새 재고조사 모달 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/45 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 w-full max-w-sm border border-gray-200 dark:border-gray-700 shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white">새 재고조사 시작</h3>
              <button onClick={() => setShowCreate(false)} className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600">닫기</button>
            </div>
            <div className="p-5 space-y-4">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                조사일
                <input
                  type="date"
                  value={createDate}
                  onChange={(e) => setCreateDate(e.target.value)}
                  className="mt-1 w-full border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-[var(--color-primary)]"
                />
              </label>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                메모 (선택)
                <input
                  value={createMemo}
                  onChange={(e) => setCreateMemo(e.target.value)}
                  placeholder="예: 2026년 6월 월말 재고조사"
                  className="mt-1 w-full border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:border-[var(--color-primary)] placeholder-gray-400"
                />
              </label>
              <p className="text-xs text-gray-400">현재 창고의 전체 재고 항목이 불러와집니다.</p>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => setShowCreate(false)} className="flex-1 border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800">취소</button>
              <button
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending}
                className="flex-1 bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
              >
                {createMut.isPending ? '생성 중...' : '시작'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 상세 패널 */}
      {detailId && (
        <AuditDetailPanel
          auditId={detailId}
          onClose={() => setDetailId(null)}
          onConfirmed={() => { qc.invalidateQueries({ queryKey: ['inventory-audits'] }); setDetailId(null) }}
        />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: 'DRAFT' | 'CONFIRMED' }) {
  return status === 'CONFIRMED'
    ? <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">확정</span>
    : <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">작성 중</span>
}

function AuditDetailPanel({ auditId, onClose, onConfirmed }: {
  auditId: string
  onClose: () => void
  onConfirmed: () => void
}) {
  const qc = useQueryClient()
  const [counts, setCounts] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<'all' | 'diff' | 'empty'>('all')
  const [saving, setSaving] = useState(false)
  useEscapeKey(onClose, !saving)

  const { data: audit, isLoading } = useQuery({
    queryKey: ['inventory-audit', auditId],
    queryFn: () => inventoryAuditApi.get(auditId),
    staleTime: 0,
    select: (value) => ({ ...value, items: value.items ?? [] }),
  })

  const confirmMut = useMutation({
    mutationFn: () => inventoryAuditApi.confirm(auditId),
    onSuccess: () => { toast.success('재고조사가 확정되었습니다. 재고가 자동 조정되었습니다.'); onConfirmed() },
    onError: () => toast.error('확정에 실패했습니다'),
  })

  const handleSave = async () => {
    if (!audit) return
    setSaving(true)
    const dirtyItems = audit.items
      .filter((item) => counts[item.id] !== undefined)
      .map((item) => ({
        itemId: item.id,
        countedQty: counts[item.id] === '' ? null : Number(counts[item.id]),
      }))
    if (dirtyItems.length === 0) { setSaving(false); return }
    try {
      await inventoryAuditApi.updateCounts(auditId, dirtyItems)
      toast.success('저장되었습니다')
      setCounts({})
      qc.invalidateQueries({ queryKey: ['inventory-audit', auditId] })
      qc.invalidateQueries({ queryKey: ['inventory-audits'] })
    } catch {
      toast.error('저장에 실패했습니다')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirm = async () => {
    if (!audit) return
    // 저장 먼저
    const dirtyItems = audit.items
      .filter((item) => counts[item.id] !== undefined)
      .map((item) => ({ itemId: item.id, countedQty: counts[item.id] === '' ? null : Number(counts[item.id]) }))
    if (dirtyItems.length > 0) {
      try { await inventoryAuditApi.updateCounts(auditId, dirtyItems); setCounts({}) } catch { toast.error('저장 실패'); return }
    }
    if (!confirm('재고조사를 확정하면 차이 항목의 재고가 자동 조정됩니다.\n계속하시겠습니까?')) return
    confirmMut.mutate()
  }

  const getEffectiveCounted = (item: InventoryAuditItem): number | null => {
    const val = counts[item.id]
    if (val === undefined) return item.countedQty
    if (val === '') return null
    return Number(val)
  }

  const filteredItems = (audit?.items ?? []).filter((item) => {
    if (filter === 'diff') {
      const counted = getEffectiveCounted(item)
      return counted !== null && counted !== item.systemQty
    }
    if (filter === 'empty') return getEffectiveCounted(item) === null
    return true
  })

  const confirmed = audit?.status === 'CONFIRMED'
  const hasDirty  = Object.keys(counts).length > 0

  return (
    <div className="fixed inset-0 bg-black/45 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 w-full sm:max-w-5xl sm:max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700 shadow-2xl max-h-[92vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[var(--color-primary)] text-xs font-bold">실사</span>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">
                재고조사 상세 — {audit?.auditDate ?? '...'}
              </h3>
              {audit?.memo && <p className="text-xs text-gray-400 mt-0.5">{audit.memo}</p>}
            </div>
            {audit && <StatusBadge status={audit.status} />}
          </div>
          <button onClick={onClose} className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600">닫기</button>
        </div>

        {/* 필터 탭 */}
        {audit && (
          <div className="flex items-center gap-1 px-5 pt-3 shrink-0">
            {(['all', 'diff', 'empty'] as const).map((f) => {
              const label = f === 'all' ? `전체 ${audit.items.length}건` : f === 'diff' ? '차이 있음' : '미입력'
              return (
                <button key={f} onClick={() => setFilter(f)}
                  className={cn('px-3 py-1.5 text-xs font-medium border-b-2 -mb-px transition-colors',
                    filter === f
                      ? 'border-[var(--color-primary)] text-[var(--color-primary)] dark:text-[var(--color-primary)] dark:border-[var(--color-primary)]'
                      : 'border-transparent text-gray-400 hover:text-gray-700'
                  )}>
                  {label}
                </button>
              )
            })}
            <div className="ml-auto text-xs text-gray-400">
              {audit.items.filter((i) => i.countedQty !== null).length} / {audit.items.length}건 입력
            </div>
          </div>
        )}

        {/* 테이블 */}
        <div className="flex-1 overflow-auto min-h-0">
          {isLoading ? (
            <div className="py-20 text-center text-gray-400">로딩 중...</div>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className={ui.thead}>
                  <th className={cn(ui.th, 'text-left')}>상품명</th>
                  <th className={cn(ui.th, 'text-left')}>상품코드</th>
                  <th className={cn(ui.th, 'text-left')}>위치</th>
                  <th className={ui.thR}>시스템 수량</th>
                  <th className={ui.thR}>실사 수량</th>
                  <th className={ui.thR}>차이</th>
                </tr>
              </thead>
              <tbody className={ui.tbody}>
                {filteredItems.length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-gray-400">해당 항목이 없습니다</td></tr>
                )}
                {filteredItems.map((item) => {
                  const counted  = getEffectiveCounted(item)
                  const diff     = counted !== null ? counted - item.systemQty : null
                  const isDirty  = counts[item.id] !== undefined
                  return (
                    <tr key={item.id} className={cn(ui.tr, isDirty && 'bg-amber-50/50 dark:bg-amber-900/10')}>
                      <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-gray-100 max-w-[180px] truncate">
                        {item.product?.name ?? '-'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                        {item.product?.code ?? '-'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                        {item.location?.code ?? '-'}
                        {item.lotNumber && <span className="ml-1 text-[10px] text-gray-400">LOT:{item.lotNumber}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {formatNumber(item.systemQty)}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        {confirmed ? (
                          <span className="tabular-nums text-gray-700 dark:text-gray-300">
                            {counted !== null ? formatNumber(counted) : '-'}
                          </span>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            value={counts[item.id] ?? (item.countedQty !== null ? String(item.countedQty) : '')}
                            onChange={(e) => setCounts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            placeholder="미입력"
                            className="w-24 border border-gray-200 dark:border-gray-700 px-2 py-1 text-sm text-right bg-white dark:bg-gray-800 outline-none focus:border-[var(--color-primary)] tabular-nums placeholder-gray-300"
                          />
                        )}
                      </td>
                      <td className={cn('px-3 py-2.5 text-right tabular-nums font-semibold',
                        diff === null ? 'text-gray-300' :
                        diff > 0 ? 'text-blue-600 dark:text-blue-400' :
                        diff < 0 ? 'text-red-600 dark:text-red-400' :
                        'text-gray-400')}>
                        {diff === null ? '-' : diff > 0 ? `+${formatNumber(diff)}` : formatNumber(diff)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 푸터 */}
        {!confirmed && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
            <span className="text-xs text-gray-400">
              {hasDirty && <span className="text-amber-600 font-medium">저장되지 않은 변경사항이 있습니다</span>}
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!hasDirty || saving}
                className="px-4 py-2 text-sm border border-[var(--color-primary)]/30 text-[var(--color-primary)] dark:text-[var(--color-primary)] hover:bg-[#edf0ec] disabled:opacity-40"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirmMut.isPending}
                className="px-5 py-2 text-sm bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
              >
                {confirmMut.isPending ? '처리 중...' : '확정 (재고 조정)'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
