'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, FileDown, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { inventoryAuditApi } from '@/api/inventory-audit.api'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useWarehouseStore } from '@/stores/warehouse.store'
import { formatNumber } from '@/utils/format'
import { writeRowsToExcel } from '@/utils/excel'
import { cn } from '@/utils/cn'
import * as ui from '@/styles/ui'
import type { InventoryAudit, InventoryAuditItem } from '@/types/api.types'

const today = () => new Date().toISOString().slice(0, 10)

export default function InventoryAuditPage() {
  const qc        = useQueryClient()
  const warehouse = useWarehouseStore((s) => s.selectedWarehouse)
  const [showCreate, setShowCreate] = useState(false)
  const [detailId,   setDetailId]   = useState<string | null>(null)
  const [createDate, setCreateDate] = useState(today())
  const [createMemo, setCreateMemo] = useState('')
  const [fromDate,   setFromDate]   = useState('')
  const [toDate,     setToDate]     = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  useEscapeKey(() => setShowCreate(false), showCreate)
  useEscapeKey(() => setDetailId(null), !!detailId && !showCreate)

  const { data: audits = [], isLoading } = useQuery({
    queryKey: ['inventory-audits', warehouse?.id],
    queryFn: () => inventoryAuditApi.list(warehouse!.id),
    enabled: !!warehouse?.id,
    select: (items) => items.map((a) => ({ ...a, items: a.items ?? [] })),
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
    onSuccess: () => {
      toast.success('삭제되었습니다')
      qc.invalidateQueries({ queryKey: ['inventory-audits'] })
      setDeleteConfirmId(null)
      if (detailId === deleteMut.variables) setDetailId(null)
    },
    onError: () => toast.error('삭제에 실패했습니다'),
  })

  const filteredAudits = audits.filter((a) => {
    if (fromDate && a.auditDate < fromDate) return false
    if (toDate   && a.auditDate > toDate)   return false
    return true
  })

  if (!warehouse) return (
    <div className="py-20 text-center text-gray-400">창고를 먼저 선택하세요</div>
  )

  return (
    <div className="flex h-[calc(100vh-150px)] min-h-0 flex-col gap-4 overflow-hidden">
      {/* 헤더 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h2 className={ui.h2Cls}>재고조사</h2>
          <p className={ui.subText}>월별 실사 수량을 입력하면 재고가 자동으로 조정됩니다</p>
        </div>
        <button onClick={() => setShowCreate(true)} className={ui.btnPrimary}>
          <Plus className="h-4 w-4" />
          새 재고조사
        </button>
      </div>

      {/* 필터 바 */}
      <div className={cn(ui.filterCard, 'shrink-0 items-center')}>
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap shrink-0">조사일</span>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className={cn(ui.formInput, '!w-36 shrink-0 text-sm')}
        />
        <span className="text-xs text-gray-400 shrink-0">~</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className={cn(ui.formInput, '!w-36 shrink-0 text-sm')}
        />
        {(fromDate || toDate) && (
          <button
            onClick={() => { setFromDate(''); setToDate('') }}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 shrink-0"
          >
            <X className="h-3.5 w-3.5" /> 초기화
          </button>
        )}
        <span className="ml-auto text-xs text-gray-400 shrink-0">
          {filteredAudits.length}건
        </span>
      </div>

      {/* 목록 */}
      <div className={cn(ui.tableWrap, 'flex min-h-0 flex-1 flex-col')}>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className={ui.thead}>
                <th className={cn(ui.th, 'text-left')}>조사일</th>
                <th className={cn(ui.th, 'text-left')}>메모</th>
                <th className={ui.th}>항목 수</th>
                <th className={ui.th}>입력 완료</th>
                <th className={ui.th}>차이 발생</th>
                <th className={ui.th}>상태</th>
                <th className="w-24 px-3 py-3" />
              </tr>
            </thead>
            <tbody className={ui.tbody}>
              {isLoading && (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400">로딩 중...</td></tr>
              )}
              {!isLoading && filteredAudits.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-gray-400">등록된 재고조사가 없습니다</td></tr>
              )}
              {filteredAudits.map((audit) => {
                const items     = audit.items ?? []
                const filled    = items.filter((i) => i.countedQty !== null).length
                const diffCount = items.filter((i) => i.countedQty !== null && i.countedQty !== i.systemQty).length
                const isOpen    = detailId === audit.id
                const isPendingDelete = deleteConfirmId === audit.id
                return (
                  <tr
                    key={audit.id}
                    className={cn(ui.tr, 'cursor-pointer', isOpen && 'bg-[var(--color-surface-muted)]')}
                    onClick={() => { setDetailId(isOpen ? null : audit.id); setDeleteConfirmId(null) }}
                  >
                    <td className="px-3 py-3 font-medium text-gray-900 dark:text-gray-100">{audit.auditDate}</td>
                    <td className="px-3 py-3 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">{audit.memo || '-'}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{formatNumber(items.length)}건</td>
                    <td className="px-3 py-3 text-center tabular-nums">
                      {items.length > 0 ? (
                        <span className={filled === items.length ? 'text-emerald-600 font-semibold' : 'text-gray-500'}>
                          {filled}/{items.length}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {diffCount > 0
                        ? <span className="text-orange-600 font-semibold">{formatNumber(diffCount)}건</span>
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <StatusBadge status={audit.status} />
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          title={isOpen ? '상세 닫기' : '자세히 보기'}
                          onClick={() => { setDetailId(isOpen ? null : audit.id); setDeleteConfirmId(null) }}
                          className={ui.btnIcon}
                        >
                          {isOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        {audit.status === 'DRAFT' && (
                          isPendingDelete ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => deleteMut.mutate(audit.id)}
                                disabled={deleteMut.isPending}
                                className="px-2 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded"
                              >
                                확인
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <button
                              title="삭제"
                              onClick={() => setDeleteConfirmId(audit.id)}
                              className={ui.btnIconDelete}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )
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
        <div className={ui.modalOverlay}>
          <div className={cn(ui.modalBox, 'w-full max-w-sm')}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900 dark:text-white">새 재고조사 시작</h3>
              <button onClick={() => setShowCreate(false)} className={ui.btnIcon}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <label className={ui.label}>
                조사일
                <input
                  type="date"
                  value={createDate}
                  onChange={(e) => setCreateDate(e.target.value)}
                  className={cn(ui.formInput, 'mt-1 w-full')}
                />
              </label>
              <label className={ui.label}>
                메모 <span className="text-gray-400 font-normal">(선택)</span>
                <input
                  value={createMemo}
                  onChange={(e) => setCreateMemo(e.target.value)}
                  placeholder="예: 2026년 6월 월말 재고조사"
                  className={cn(ui.formInput, 'mt-1 w-full')}
                />
              </label>
              <p className="text-xs text-gray-400">현재 창고의 전체 재고 항목이 불러와집니다.</p>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className={cn(ui.btnSecondary, 'flex-1')}>취소</button>
              <button
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending}
                className={cn(ui.btnPrimary, 'flex-1 justify-center disabled:opacity-50')}
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
    ? <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 rounded">확정</span>
    : <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 rounded">작성 중</span>
}

function AuditDetailPanel({ auditId, onClose, onConfirmed }: {
  auditId: string
  onClose: () => void
  onConfirmed: () => void
}) {
  const qc = useQueryClient()
  const [counts,  setCounts]  = useState<Record<string, string>>({})
  const [filter,  setFilter]  = useState<'all' | 'diff' | 'empty'>('all')
  const [search,  setSearch]  = useState('')
  const [saving,  setSaving]  = useState(false)
  const [exporting, setExporting] = useState(false)
  useEscapeKey(onClose, !saving)

  const { data: audit, isLoading } = useQuery({
    queryKey: ['inventory-audit', auditId],
    queryFn: () => inventoryAuditApi.get(auditId),
    staleTime: 0,
    select: (v) => ({ ...v, items: v.items ?? [] }),
  })

  const confirmMut = useMutation({
    mutationFn: () => inventoryAuditApi.confirm(auditId),
    onSuccess: () => { toast.success('재고조사가 확정되었습니다. 재고가 자동 조정되었습니다.'); onConfirmed() },
    onError: () => toast.error('확정에 실패했습니다'),
  })

  const handleSave = async () => {
    if (!audit) return
    setSaving(true)
    const dirty = audit.items
      .filter((item) => counts[item.id] !== undefined)
      .map((item) => ({ itemId: item.id, countedQty: counts[item.id] === '' ? null : Number(counts[item.id]) }))
    if (dirty.length === 0) { setSaving(false); return }
    try {
      await inventoryAuditApi.updateCounts(auditId, dirty)
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
    const dirty = audit.items
      .filter((item) => counts[item.id] !== undefined)
      .map((item) => ({ itemId: item.id, countedQty: counts[item.id] === '' ? null : Number(counts[item.id]) }))
    if (dirty.length > 0) {
      try { await inventoryAuditApi.updateCounts(auditId, dirty); setCounts({}) }
      catch { toast.error('저장 실패'); return }
    }
    confirmMut.mutate()
  }

  const handleExcel = async () => {
    if (!audit) return
    setExporting(true)
    try {
      const rows = audit.items.map((item) => {
        const counted = getEffectiveCounted(item, counts)
        return {
          '상품명':      item.product?.name ?? '-',
          '상품코드':    item.product?.code ?? '-',
          '위치':        item.location?.code ?? '-',
          'LOT':         item.lotNumber ?? '-',
          '시스템 수량': item.systemQty,
          '실사 수량':   counted ?? '',
          '차이':        counted !== null ? counted - item.systemQty : '',
        }
      })
      await writeRowsToExcel(rows, `재고조사_${audit.auditDate}.xlsx`, '재고조사')
    } catch {
      toast.error('엑셀 다운로드에 실패했습니다')
    } finally {
      setExporting(false)
    }
  }

  const items      = audit?.items ?? []
  const filled     = items.filter((i) => i.countedQty !== null).length
  const diffCount  = items.filter((i) => i.countedQty !== null && i.countedQty !== i.systemQty).length
  const confirmed  = audit?.status === 'CONFIRMED'
  const hasDirty   = Object.keys(counts).length > 0
  const pct        = items.length > 0 ? Math.round((filled / items.length) * 100) : 0

  const filteredItems = items.filter((item) => {
    if (search) {
      const q = search.toLowerCase()
      const nameMatch = item.product?.name?.toLowerCase().includes(q)
      const codeMatch = item.product?.code?.toLowerCase().includes(q)
      const locMatch  = item.location?.code?.toLowerCase().includes(q)
      if (!nameMatch && !codeMatch && !locMatch) return false
    }
    const counted = getEffectiveCounted(item, counts)
    if (filter === 'diff')  return counted !== null && counted !== item.systemQty
    if (filter === 'empty') return counted === null
    return true
  })

  return (
    <div className={ui.modalOverlay}>
      <div className="bg-white dark:bg-gray-900 w-full sm:max-w-5xl sm:max-h-[90vh] flex flex-col border border-[var(--color-line)] shadow-2xl max-h-[92vh] rounded">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-line)] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="shrink-0 px-2 py-0.5 text-xs font-bold bg-[var(--color-grid-header)] text-white rounded">실사</span>
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 dark:text-white truncate">
                재고조사 — {audit?.auditDate ?? '...'}
              </h3>
              {audit?.memo && <p className="text-xs text-gray-400 mt-0.5 truncate">{audit.memo}</p>}
            </div>
            {audit && <StatusBadge status={audit.status} />}
          </div>
          <button onClick={onClose} className={cn(ui.btnIcon, 'shrink-0 ml-3')}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 요약 바 */}
        {audit && (
          <div className="flex items-center gap-4 px-5 py-3 bg-[var(--color-surface-muted)] border-b border-[var(--color-line)] shrink-0 text-xs flex-wrap">
            <span className="text-gray-500">전체 <strong className="text-gray-800 dark:text-gray-200">{items.length}</strong>건</span>
            <span className="text-gray-500">입력 완료 <strong className={pct === 100 ? 'text-emerald-600' : 'text-gray-800 dark:text-gray-200'}>{filled}</strong>건</span>
            {diffCount > 0 && <span className="text-orange-600 font-semibold">차이 {diffCount}건</span>}
            <div className="flex items-center gap-2 ml-auto">
              <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', pct === 100 ? 'bg-emerald-500' : 'bg-[var(--color-primary)]')}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="tabular-nums text-gray-500">{pct}%</span>
            </div>
          </div>
        )}

        {/* 필터 & 검색 */}
        {audit && (
          <div className="flex items-center flex-wrap gap-x-3 gap-y-2 px-5 py-2.5 border-b border-[var(--color-line)] shrink-0">
            <div className="flex items-center gap-1 shrink-0">
              {(['all', 'diff', 'empty'] as const).map((f) => {
                const label = f === 'all' ? '전체' : f === 'diff' ? '차이 있음' : '미입력'
                return (
                  <button key={f} onClick={() => setFilter(f)}
                    className={cn('px-3 py-1 text-xs font-medium rounded transition-colors',
                      filter === f
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-gray-200'
                    )}>
                    {label}
                  </button>
                )
              })}
            </div>
            <div className="relative ml-auto shrink-0">
              <input
                type="text"
                autoComplete="off"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="상품명 / 코드 / 위치"
                className={cn(ui.formInput, '!w-48 text-xs')}
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
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
                  const counted = getEffectiveCounted(item, counts)
                  const diff    = counted !== null ? counted - item.systemQty : null
                  const isDirty = counts[item.id] !== undefined
                  return (
                    <tr key={item.id} className={cn(ui.tr, isDirty && 'bg-amber-50/50 dark:bg-amber-900/10')}>
                      <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-gray-100 max-w-[180px] truncate">
                        {item.product?.name ?? '-'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                        {item.product?.code ?? '-'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500 dark:text-gray-400">
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
                            className={cn(ui.formInput, 'w-24 text-right text-sm tabular-nums placeholder-gray-300')}
                          />
                        )}
                      </td>
                      <td className={cn('px-3 py-2.5 text-right tabular-nums font-semibold',
                        diff === null ? 'text-gray-300' :
                        diff > 0     ? 'text-blue-600 dark:text-blue-400' :
                        diff < 0     ? 'text-red-600 dark:text-red-400' :
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
        <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--color-line)] shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExcel}
              disabled={exporting || !audit}
              className={cn(ui.btnSecondary, 'gap-1.5 disabled:opacity-50')}
            >
              <FileDown className="h-4 w-4" />
              {exporting ? '내보내는 중...' : '엑셀'}
            </button>
            {hasDirty && (
              <span className="text-xs text-amber-600 font-medium">저장되지 않은 변경사항</span>
            )}
          </div>
          {!confirmed && (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!hasDirty || saving}
                className={cn(ui.btnSecondary, 'disabled:opacity-40')}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirmMut.isPending}
                className={cn(ui.btnPrimary, 'disabled:opacity-50')}
              >
                {confirmMut.isPending ? '처리 중...' : '확정 (재고 조정)'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getEffectiveCounted(item: InventoryAuditItem, counts: Record<string, string>): number | null {
  const val = counts[item.id]
  if (val === undefined) return item.countedQty
  if (val === '')         return null
  return Number(val)
}
