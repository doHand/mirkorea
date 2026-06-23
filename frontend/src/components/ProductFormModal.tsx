'use client'
import { cn } from '@/utils/cn'
import { SALE_STATUS_LABEL } from '@/constants/stock.constants'
import { CategorySelect } from '@/components/CategorySelect'
import type { Product, SaleStatus, Barcode, ProductUnit, BarcodeUnitType, UnitType } from '@/types/api.types'

export const EMPTY_PRODUCT_FORM = {
  code: '',
  name: '',
  category: '',
  clientId:   '',
  locationId: '',
  unit: 'EA',
  baseUnit: 'EA' as UnitType,
  pUnitQty: 0,
  boxUnitQty: 1,
  plUnitQty: 0,
  spec: '',
  materialNo: '',
  boxQty: 1,
  safetyStock: 0,
  reorderPoint: 0,
  costPrice: 0,
  sellPrice: 0,
  priceB: 0,
  priceA: 0,
  priceC: 0,
  retailPrice: 0,
  memo: '',
  saleStatus: 'ACTIVE' as SaleStatus,
  initialStockEA: 0,
}

export type ProductForm = typeof EMPTY_PRODUCT_FORM

export type PendingBarcode = { barcode: string; type: BarcodeUnitType; unitQty: number; isPrimary: boolean }

const inputCls = 'w-full border border-gray-200 dark:border-gray-700 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#2D4033]/30 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-colors'
const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'

interface Props {
  show: boolean
  editing: Product | null
  form: ProductForm
  setForm: React.Dispatch<React.SetStateAction<ProductForm>>
  onClose: () => void
  onCreate: () => void
  onUpdate: () => void
  isCreating: boolean
  isUpdating: boolean
  units: ProductUnit[]
  barcodes: Barcode[]
  pendingBarcodes: PendingBarcode[]
  setPendingBarcodes: React.Dispatch<React.SetStateAction<PendingBarcode[]>>
  showAddBc: boolean
  setShowAddBc: React.Dispatch<React.SetStateAction<boolean>>
  newBcVal: string
  setNewBcVal: React.Dispatch<React.SetStateAction<string>>
  newBcType: BarcodeUnitType
  setNewBcType: React.Dispatch<React.SetStateAction<BarcodeUnitType>>
  newBcQty: number
  setNewBcQty: React.Dispatch<React.SetStateAction<number>>
  newBcPrimary: boolean
  setNewBcPrimary: React.Dispatch<React.SetStateAction<boolean>>
  onAddBarcode: () => void
  isAddingBarcode: boolean
  onDeleteBarcode: (id: string) => void
  selectedClientLabel: string | undefined
  selectedLocationLabel: string | undefined
  onOpenClientPicker: () => void
  onOpenLocationPicker: () => void
  onClearClient: () => void
  onClearLocation: () => void
}

export function ProductFormModal({
  show, editing, form, setForm, onClose,
  onCreate, onUpdate, isCreating, isUpdating,
  units, barcodes, pendingBarcodes, setPendingBarcodes,
  showAddBc, setShowAddBc,
  newBcVal, setNewBcVal, newBcType, setNewBcType, newBcQty, setNewBcQty, newBcPrimary, setNewBcPrimary,
  onAddBarcode, isAddingBarcode, onDeleteBarcode,
  selectedClientLabel, selectedLocationLabel,
  onOpenClientPicker, onOpenLocationPicker, onClearClient, onClearLocation,
}: Props) {
  if (!show) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        {/* 모달 헤더 */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-[#2D4033]">
          <div className="shrink-0 text-white">
            {editing ? '수정' : '+'}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">
              {editing ? editing.name : '새 상품 등록'}
            </h3>
            {editing && <p className="text-[10px] text-[#E5D3B3]/70 font-mono">{editing.code}</p>}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* ── 기본 정보 ── */}
          <section>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 pb-1 mb-2">기본 정보</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>상품코드 *</label>
                <input
                  type="text"
                  placeholder="PRD-001"
                  value={form.code}
                  disabled={editing !== null}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                  className={cn(inputCls, 'disabled:bg-gray-50 disabled:text-gray-400 dark:disabled:bg-gray-800 dark:disabled:text-gray-500')}
                />
              </div>
              <div>
                <label className={labelCls}>상품명 *</label>
                <input
                  type="text"
                  placeholder="상품명 입력"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>자재번호</label>
                <input type="text" placeholder="자재번호" value={form.materialNo}
                  onChange={(e) => setForm((p) => ({ ...p, materialNo: e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>카테고리(품목분류)</label>
                <CategorySelect
                  value={form.category}
                  onChange={(val) => setForm((p) => ({ ...p, category: val }))}
                />
              </div>
              <div>
                <label className={labelCls}>거래처</label>
                <button
                  type="button"
                  onClick={onOpenClientPicker}
                  className={cn(
                    inputCls,
                    'w-full flex items-center justify-between gap-2 text-left cursor-pointer',
                    form.clientId ? '' : 'text-gray-400 dark:text-gray-500',
                  )}
                >
                  <span className="truncate">
                    {form.clientId ? (selectedClientLabel || '거래처 선택...') : '거래처 선택...'}
                  </span>
                  <span className="shrink-0 text-gray-400 text-xs">검색</span>
                </button>
                {form.clientId && (
                  <button
                    type="button"
                    onClick={onClearClient}
                    className="mt-1 flex items-center gap-1 text-xs text-gray-400 hover:text-rose-500 transition-colors"
                  >
                    선택 해제
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* ── 바코드 관리 ── */}
          <section className="border-t border-gray-100 dark:border-gray-700 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-700 pb-1 w-full">
                QR 바코드
              </p>
              <button
                type="button"
                onClick={() => setShowAddBc((v) => !v)}
                className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
              >
                + 바코드 추가
              </button>
            </div>

            {/* 신규 등록 모드: 임시 바코드 목록 */}
            {!editing && (
              <>
                {pendingBarcodes.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {pendingBarcodes.map((bc, idx) => (
                      <div key={idx} className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-gray-50 dark:bg-gray-800 group">
                        <span className="font-mono text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{bc.barcode}</span>
                        <span className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0',
                          bc.type === 'CXD_BOX' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                            : bc.type === 'CXD' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
                        )}>
                          {bc.type === 'CXD_BOX' ? 'CXD BOX' : bc.type === 'CXD' ? 'CXD 낱개' : '낱개'}
                        </span>
                        <span className="text-xs text-gray-400 tabular-nums shrink-0">×{bc.unitQty}</span>
                        {bc.isPrimary && <span className="text-amber-400 shrink-0">★</span>}
                        <button
                          type="button"
                          onClick={() => setPendingBarcodes((prev) => prev.filter((_, i) => i !== idx))}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-rose-500 dark:text-gray-600 dark:hover:text-rose-400 transition-all shrink-0"
                        >
                          닫기
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {pendingBarcodes.length === 0 && !showAddBc && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 py-2">바코드를 미리 추가할 수 있습니다 (선택사항)</p>
                )}
              </>
            )}

            {/* 수정 모드: 저장된 바코드 목록 */}
            {editing && (
              <>
                {barcodes.length === 0 && !showAddBc && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 py-2">등록된 바코드가 없습니다. 위 버튼으로 추가하세요.</p>
                )}
                {barcodes.length > 0 && (
                  <div className="space-y-1.5 mb-3">
                    {barcodes.map((bc) => (
                      <div key={bc.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-gray-50 dark:bg-gray-800 group">
                        <span className="font-mono text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{bc.barcode}</span>
                        <span className={cn(
                          'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0',
                          bc.type === 'CXD_BOX' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                            : bc.type === 'CXD' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
                        )}>
                          {bc.type === 'CXD_BOX' ? 'CXD BOX' : bc.type === 'CXD' ? 'CXD 낱개' : '낱개'}
                        </span>
                        <span className="text-xs text-gray-400 tabular-nums shrink-0">×{bc.unitQty}</span>
                        {bc.isPrimary && <span className="text-amber-400 shrink-0">★</span>}
                        <button
                          type="button"
                          onClick={() => { if (confirm('이 바코드를 삭제할까요?')) onDeleteBarcode(bc.id) }}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-rose-500 dark:text-gray-600 dark:hover:text-rose-400 transition-all shrink-0"
                        >
                          닫기
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {showAddBc && (
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-900/10">
                <input
                  autoFocus
                  type="text"
                  placeholder="바코드 값"
                  value={newBcVal}
                  onChange={(e) => setNewBcVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || !newBcVal.trim()) return
                    if (editing) { onAddBarcode() }
                    else {
                      setPendingBarcodes((prev) => [...prev, { barcode: newBcVal.trim(), type: newBcType, unitQty: newBcQty, isPrimary: newBcPrimary }])
                      setNewBcVal(''); setNewBcType('UNIT'); setNewBcQty(1); setNewBcPrimary(false); setShowAddBc(false)
                    }
                  }}
                  className="font-mono text-sm px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 flex-1 min-w-32"
                />
                <select
                  value={newBcType}
                  onChange={(e) => setNewBcType(e.target.value as BarcodeUnitType)}
                  className="text-xs px-2.5 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none"
                >
                  <option value="UNIT">낱개</option>
                  <option value="CXD">CXD 낱개</option>
                  <option value="CXD_BOX">CXD BOX</option>
                </select>
                <input
                  type="number" min={1}
                  value={newBcQty}
                  onChange={(e) => setNewBcQty(Number(e.target.value))}
                  className="w-14 text-xs px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-right tabular-nums focus:outline-none"
                />
                <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
                  <input type="checkbox" checked={newBcPrimary} onChange={(e) => setNewBcPrimary(e.target.checked)} className="rounded accent-indigo-600" />
                  기본
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (!newBcVal.trim()) return
                    if (editing) { onAddBarcode() }
                    else {
                      setPendingBarcodes((prev) => [...prev, { barcode: newBcVal.trim(), type: newBcType, unitQty: newBcQty, isPrimary: newBcPrimary }])
                      setNewBcVal(''); setNewBcType('UNIT'); setNewBcQty(1); setNewBcPrimary(false); setShowAddBc(false)
                    }
                  }}
                  disabled={!newBcVal.trim() || (!!editing && isAddingBarcode)}
                  className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                >
                  {editing && isAddingBarcode ? '저장 중...' : '저장'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddBc(false)}
                  className="px-2.5 py-1.5 text-xs text-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  취소
                </button>
              </div>
            )}
          </section>

          {/* ── 단위 설정 ── */}
          <section className="border-t border-gray-100 dark:border-gray-700 pt-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 pb-1 mb-3">단위 설정</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <label className={labelCls}>기준단위</label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                  className={inputCls}
                >
                  {!units.some((u) => u.code === form.unit) && (
                    <option value={form.unit}>{form.unit || '선택'}</option>
                  )}
                  {units.map((u) => (
                    <option key={u.id} value={u.code}>
                      {u.code}{u.label ? ` (${u.label})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>규격 <span className="font-normal text-gray-400">(예: 12P / 24BOX / 5PL)</span></label>
                <input type="text" placeholder="예: 12P / 24BOX / 5PL" value={form.spec}
                  onChange={(e) => {
                    const val = e.target.value
                    const pM  = val.match(/(\d+)\s*P\b/i)
                    const bM  = val.match(/(\d+)\s*BOX/i)
                    const plM = val.match(/(\d+)\s*PL\b/i)
                    setForm((p) => ({
                      ...p, spec: val,
                      ...(pM  ? { pUnitQty:   Number(pM[1])  } : {}),
                      ...(bM  ? { boxUnitQty: Number(bM[1])  } : {}),
                      ...(plM ? { plUnitQty:  Number(plM[1]) } : {}),
                    }))
                  }}
                  className={inputCls} />
                {(form.pUnitQty > 0 || form.boxUnitQty > 0 || form.plUnitQty > 0) && (
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                    {[
                      form.pUnitQty   > 0 ? `1P = ${form.pUnitQty}EA`        : '',
                      form.boxUnitQty > 0 ? `1OUTBOX = ${form.boxUnitQty}EA` : '',
                      form.plUnitQty  > 0 ? `1PL = ${form.plUnitQty}EA`      : '',
                    ].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* ── 재고 설정 ── */}
          <section className="border-t border-gray-100 dark:border-gray-700 pt-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 pb-1 mb-3">재고 설정</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={labelCls}>안전재고</label>
                <input type="number" min={0} value={form.safetyStock}
                  onChange={(e) => setForm((p) => ({ ...p, safetyStock: +e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>재주문점</label>
                <input type="number" min={0} value={form.reorderPoint}
                  onChange={(e) => setForm((p) => ({ ...p, reorderPoint: +e.target.value }))}
                  className={inputCls} />
              </div>
              {!editing && (
                <div>
                  <label className={labelCls}>초기 재고 <span className="text-gray-400 font-normal">(EA)</span></label>
                  <input type="number" min={0} value={form.initialStockEA}
                    onChange={(e) => setForm((p) => ({ ...p, initialStockEA: +e.target.value }))}
                    className={inputCls} placeholder="0" />
                </div>
              )}
              <div className="sm:col-span-3">
                <label className={labelCls}>보관위치</label>
                <button
                  type="button"
                  onClick={onOpenLocationPicker}
                  className={cn(
                    inputCls,
                    'w-full flex items-center justify-between gap-2 text-left cursor-pointer',
                    form.locationId ? '' : 'text-gray-400 dark:text-gray-500',
                  )}
                >
                  <span className="truncate">
                    {form.locationId ? (selectedLocationLabel || '위치 선택...') : '위치 선택...'}
                  </span>
                  <span className="shrink-0 text-gray-400 text-xs">주소</span>
                </button>
                {form.locationId && (
                  <button
                    type="button"
                    onClick={onClearLocation}
                    className="mt-1 flex items-center gap-1 text-xs text-gray-400 hover:text-rose-500 transition-colors"
                  >
                    선택 해제
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* ── 가격 ── */}
          <section className="border-t border-gray-100 dark:border-gray-700 pt-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 pb-1 mb-2">가격 정보</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={labelCls}>매입단가 (₩)</label>
                <input type="number" min={0} value={form.costPrice}
                  onChange={(e) => setForm((p) => ({ ...p, costPrice: +e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>매출단가 (₩)</label>
                <input type="number" min={0} value={form.sellPrice}
                  onChange={(e) => setForm((p) => ({ ...p, sellPrice: +e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>소매단가 (₩)</label>
                <input type="number" min={0} value={form.retailPrice}
                  onChange={(e) => setForm((p) => ({ ...p, retailPrice: +e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>해피미르 단가 (₩)</label>
                <input type="number" min={0} value={form.priceA}
                  onChange={(e) => setForm((p) => ({ ...p, priceA: +e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>SSG 단가 (₩)</label>
                <input type="number" min={0} value={form.priceB}
                  onChange={(e) => setForm((p) => ({ ...p, priceB: +e.target.value }))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>C단가 (₩)</label>
                <input type="number" min={0} value={form.priceC}
                  onChange={(e) => setForm((p) => ({ ...p, priceC: +e.target.value }))}
                  className={inputCls} />
              </div>
            </div>
          </section>

          {/* ── 상태 & 메모 ── */}
          <section className="border-t border-gray-100 dark:border-gray-700 pt-3">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 pb-1 mb-2">상태 & 메모</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>판매 상태</label>
                <select
                  value={form.saleStatus}
                  onChange={(e) => setForm((p) => ({ ...p, saleStatus: e.target.value as SaleStatus }))}
                  className={inputCls}
                >
                  {Object.entries(SALE_STATUS_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>간단메모</label>
                <textarea
                  rows={3}
                  placeholder="메모 입력..."
                  value={form.memo}
                  onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))}
                  className={cn(inputCls, 'resize-none')}
                />
              </div>
            </div>
          </section>

          <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <button onClick={onClose}
              className="flex-1 py-2 border border-gray-200 dark:border-gray-700 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              취소
            </button>
            <button
              onClick={() => editing ? onUpdate() : onCreate()}
              disabled={!form.code || !form.name || isCreating || isUpdating}
              className="flex-1 py-2 bg-[#2D4033] text-white rounded text-sm font-semibold hover:bg-[#253628] disabled:opacity-50 transition-colors"
            >
              {(isCreating || isUpdating) ? '처리 중...' : (editing ? '수정 완료' : '등록')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
