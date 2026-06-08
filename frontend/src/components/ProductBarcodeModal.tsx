'use client'
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Barcode as BarcodeIcon, Check, Pencil, Plus, Star, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi } from '@/api/product.api'
import { cn } from '@/utils/cn'
import { formatDecimal, formatNumber } from '@/utils/format'
import type { Barcode, BarcodeUnitType, Product } from '@/types/api.types'

const TYPE_LABEL: Record<BarcodeUnitType, string> = {
  UNIT: '일반 바코드', CXD: 'CXD INBOX', CXD_BOX: 'CXD OUTBOX',
}
const TYPES: BarcodeUnitType[] = ['UNIT', 'CXD', 'CXD_BOX']
const TYPE_ORDER: Record<BarcodeUnitType, number> = { UNIT: 0, CXD: 1, CXD_BOX: 2 }
type BarcodeForm = { barcode: string; type: BarcodeUnitType; unitQty: number; isPrimary: boolean }
const emptyForm = (): BarcodeForm => ({ barcode: '', type: 'UNIT', unitQty: 1, isPrimary: false })
const stockForBarcode = (product: Product, barcode: Barcode, barcodes: Barcode[]) => {
  const stock = Number(product.stockQty ?? 0)
  if (barcode.type === 'CXD') return { qty: stock / Math.max(1, barcode.unitQty), unit: 'INBOX' }
  if (barcode.type === 'CXD_BOX') {
    const inboxUnitQty = barcodes.find((item) => item.type === 'CXD' && item.isPrimary)?.unitQty
      ?? barcodes.find((item) => item.type === 'CXD')?.unitQty
      ?? 1
    return { qty: stock / (Math.max(1, inboxUnitQty) * Math.max(1, barcode.unitQty)), unit: 'OUTBOX' }
  }
  return { qty: stock, unit: 'EA' }
}

export function ProductBarcodeModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<BarcodeForm>(emptyForm())
  const [adding, setAdding] = useState(false)

  const { data: barcodes = [], isLoading } = useQuery<Barcode[]>({
    queryKey: ['product-barcodes-manage', product.id],
    queryFn: () => productApi.findBarcodes(product.id),
  })

  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  const invalidate = () => {
    ;['all-barcodes', 'products', 'product-barcodes', 'barcodes'].forEach((key) =>
      qc.invalidateQueries({ queryKey: [key] }))
    qc.invalidateQueries({ queryKey: ['product-barcodes-manage', product.id] })
  }

  const addMutation = useMutation({
    mutationFn: () => productApi.addBarcode(product.id, form),
    onSuccess: () => { invalidate(); setAdding(false); setForm(emptyForm()); toast.success('바코드가 추가되었습니다') },
    onError: () => toast.error('바코드 추가 실패: 중복 여부를 확인해주세요'),
  })
  const editMutation = useMutation({
    mutationFn: () => productApi.updateBarcode(product.id, editingId!, form),
    onSuccess: () => { invalidate(); setEditingId(null); setForm(emptyForm()); toast.success('바코드가 수정되었습니다') },
    onError: () => toast.error('바코드 수정 실패: 중복 여부를 확인해주세요'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => productApi.deleteBarcode(product.id, id),
    onSuccess: () => { invalidate(); toast.success('바코드가 삭제되었습니다') },
    onError: () => toast.error('바코드 삭제에 실패했습니다'),
  })

  const startEdit = (barcode: Barcode) => {
    setAdding(false)
    setEditingId(barcode.id)
    setForm({ barcode: barcode.barcode, type: barcode.type, unitQty: barcode.unitQty, isPrimary: barcode.isPrimary })
  }

  const editor = (mode: 'add' | 'edit') => (
    <div className="space-y-3 rounded-md border border-[#E5D3B3] bg-[#F9F7F2] p-3 dark:border-gray-700 dark:bg-gray-800/60">
      <input
        autoFocus
        value={form.barcode}
        onChange={(e) => setForm({ ...form, barcode: e.target.value })}
        placeholder="바코드 번호"
        className="w-full rounded-md border border-[#D4BF99] bg-white px-3 py-2 font-mono text-sm outline-none focus:border-[#D2691E] dark:border-gray-700 dark:bg-gray-800"
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          바코드 유형
          <select value={form.type} onChange={(e) => {
            const type = e.target.value as BarcodeUnitType
            setForm({ ...form, type, unitQty: type === 'UNIT' ? 1 : form.unitQty })
          }}
            className="mt-1 w-full rounded-md border border-[#D4BF99] bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800">
            {TYPES.map((type) => <option key={type} value={type}>{TYPE_LABEL[type]}</option>)}
          </select>
        </label>
        {form.type === 'CXD' || form.type === 'CXD_BOX' ? (
          <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
            {form.type === 'CXD' ? 'INBOX SET 구성수량' : 'BOX 내 INBOX 수량'}
            <input type="number" min={1} value={form.unitQty}
              onChange={(e) => setForm({ ...form, unitQty: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border border-[#D4BF99] bg-white px-3 py-2 text-right text-sm dark:border-gray-700 dark:bg-gray-800" />
          </label>
        ) : (
          <div className="flex items-end">
            <div className="w-full rounded-md border border-[#D4BF99] bg-white px-3 py-2 text-right text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800">
              1회 스캔 = {form.type === 'UNIT' ? '1EA' : '1BOX'}
            </div>
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <input type="checkbox" checked={form.isPrimary} onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
          className="accent-[#D2691E]" />
        대표 바코드로 설정
      </label>
      <div className="flex gap-2">
        <button type="button" disabled={!form.barcode.trim() || addMutation.isPending || editMutation.isPending}
          onClick={() => mode === 'add' ? addMutation.mutate() : editMutation.mutate()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#2D4033] py-2 text-sm font-semibold text-white disabled:opacity-40">
          <Check size={13} /> {mode === 'add' ? '추가' : '저장'}
        </button>
        <button type="button" onClick={() => { setAdding(false); setEditingId(null); setForm(emptyForm()) }}
          className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-500 dark:border-gray-700">취소</button>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-4xl overflow-hidden rounded-md border border-[#D4BF99] bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-3 border-b border-[#E5D3B3] px-5 py-4 dark:border-gray-700">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#2D4033] text-white"><BarcodeIcon size={16} /></div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{product.name}</p>
            <p className="font-mono text-[11px] text-gray-400">{product.code}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"><X size={15} /></button>
        </div>
        <div className="max-h-[78vh] space-y-2 overflow-y-auto p-5">
          {isLoading && <p className="py-8 text-center text-sm text-gray-400">불러오는 중...</p>}
          {!isLoading && barcodes.length === 0 && !adding && <p className="py-8 text-center text-sm text-gray-400">등록된 바코드가 없습니다</p>}
          {[...barcodes].sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type]).map((barcode) => editingId === barcode.id ? (
            <div key={barcode.id}>{editor('edit')}</div>
          ) : (
            <div key={barcode.id} className="flex items-center gap-3 rounded-md border border-gray-100 px-4 py-3 dark:border-gray-800">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-mono text-sm">{barcode.barcode}</span>
                  <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                    현재 재고 : <span className="text-gray-900 dark:text-gray-100">{formatDecimal(stockForBarcode(product, barcode, barcodes).qty)}</span> ({stockForBarcode(product, barcode, barcodes).unit})
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-[#E5D3B3]/60 px-2 py-0.5 text-[10px] font-semibold text-[#2D4033]">{TYPE_LABEL[barcode.type]}</span>
                  {(barcode.type === 'CXD' || barcode.type === 'CXD_BOX') && (
                    <span className="whitespace-nowrap rounded-full bg-[#2D4033]/8 px-2 py-0.5 text-[10px] font-semibold text-[#2D4033] dark:text-emerald-300">
                      {barcode.type === 'CXD' ? '낱개 구성' : 'INBOX 포함'} {formatNumber(barcode.unitQty)}개
                    </span>
                  )}
                </div>
              </div>
              {barcode.isPrimary && <Star size={12} className="fill-[#D2691E] text-[#D2691E]" />}
              <button type="button" onClick={() => startEdit(barcode)} className="rounded-md p-1.5 text-gray-400 hover:bg-[#F9F7F2] hover:text-[#2D4033]"><Pencil size={13} /></button>
              <button type="button" onClick={() => { if (confirm('바코드를 삭제하시겠습니까?')) deleteMutation.mutate(barcode.id) }}
                className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={13} /></button>
            </div>
          ))}
          {adding ? editor('add') : (
            <button type="button" onClick={() => { setAdding(true); setEditingId(null); setForm(emptyForm()) }}
              className={cn('mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-[#D2691E] hover:bg-[#D2691E]/5')}>
              <Plus size={14} /> 바코드 추가
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
