'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { clientApi } from '@/api/client.api'
import { formatBusinessNoInput, formatDateTime, formatNumber, formatPhoneInput } from '@/utils/format'
import { cn } from '@/utils/cn'
import { editableRowProps } from '@/utils/table'
import * as ui from '@/styles/ui'
import type { Client } from '@/types/api.types'

declare global {
  interface Window {
    daum?: {
      Postcode: new (opts: {
        oncomplete: (data: { zonecode: string; roadAddress: string; jibunAddress: string }) => void
      }) => { open: () => void }
    }
  }
}

const today = () => new Date().toISOString().slice(0, 10)

const EMPTY_FORM = {
  name: '',
  customerType: '',
  salesperson: '',
  businessNo: '',
  ceoName: '',
  industry: '',
  sector: '',
  phone: '',
  mobile: '',
  fax: '',
  postalCode: '',
  address: '',
  addressDetail: '',
  contactName: '',
  honorific: '귀하',
  email: '',
  website: '',
  employeeCount: 0,
  pricePolicy: '매출단가적용',
  taxType: '부가세없음',
  discountRate: 0,
  initialReceivable: 0,
  unpaidOnly: false,
  registrationDate: today(),
  managementNo: '',
  managerName: '',
  managerTitle: '',
  memo: '',
}

type FormState = typeof EMPTY_FORM

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const inputCls = 'wms-input w-full dark:border-gray-700 dark:bg-gray-800 transition-colors'
const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  )
}

export default function ClientsPage() {
  const qc = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const postcodeScriptLoaded = useRef(false)

  useEffect(() => {
    if (postcodeScriptLoaded.current) return
    const script = document.createElement('script')
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    script.onload = () => { postcodeScriptLoaded.current = true }
    document.head.appendChild(script)
  }, [])

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { search, page }],
    queryFn: () => clientApi.findAll({ search: search || undefined, page }),
    placeholderData: (prev) => prev,
  })

  const payload = () => ({
    ...form,
    employeeCount: toNumber(form.employeeCount),
    discountRate: toNumber(form.discountRate),
    initialReceivable: toNumber(form.initialReceivable),
    managerName: form.managerName || form.contactName,
  })

  const createMutation = useMutation({
    mutationFn: () => clientApi.create(payload()),
    onSuccess: () => {
      toast.success('거래처 등록 완료')
      qc.invalidateQueries({ queryKey: ['clients'] })
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => clientApi.update(editing!.id, payload()),
    onSuccess: () => {
      toast.success('거래처 수정 완료')
      qc.invalidateQueries({ queryKey: ['clients'] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientApi.delete(id),
    onSuccess: () => {
      toast.success('거래처 삭제 완료')
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
  })

  const commitSearch = () => { setSearch(searchInput); setPage(1) }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, registrationDate: today() })
    setShowModal(true)
  }

  const openEdit = (client: Client) => {
    setEditing(client)
    setForm({
      name: client.name ?? '',
      customerType: client.customerType ?? '',
      salesperson: client.salesperson ?? '',
      businessNo: client.businessNo ?? '',
      ceoName: client.ceoName ?? '',
      industry: client.industry ?? '',
      sector: client.sector ?? '',
      phone: client.phone ?? '',
      mobile: client.mobile ?? '',
      fax: client.fax ?? '',
      postalCode: client.postalCode ?? '',
      address: client.address ?? '',
      addressDetail: client.addressDetail ?? '',
      contactName: client.contactName ?? '',
      honorific: client.honorific ?? '귀하',
      email: client.email ?? '',
      website: client.website ?? '',
      employeeCount: client.employeeCount ?? 0,
      pricePolicy: client.pricePolicy ?? '매출단가적용',
      taxType: client.taxType ?? '부가세없음',
      discountRate: client.discountRate ?? 0,
      initialReceivable: client.initialReceivable ?? 0,
      unpaidOnly: Boolean(client.unpaidOnly),
      registrationDate: client.registrationDate ?? today(),
      managementNo: client.managementNo ?? '',
      managerName: client.managerName ?? '',
      managerTitle: client.managerTitle ?? '',
      memo: client.memo ?? '',
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditing(null)
    setForm({ ...EMPTY_FORM, registrationDate: today() })
  }

  const handleDelete = (client: Client) => {
    if (!confirm(`"${client.name}" 거래처를 삭제하시겠습니까?`)) return
    deleteMutation.mutate(client.id)
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const openAddressSearch = () => {
    if (!window.daum?.Postcode) {
      toast.error('주소검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        setForm((prev) => ({
          ...prev,
          postalCode: data.zonecode,
          address: data.roadAddress || data.jibunAddress,
          addressDetail: '',
        }))
      },
    }).open()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">거래처 관리</h2>
          {data && <p className="mt-0.5 text-xs text-gray-400">전체 {formatNumber(data.total)}건</p>}
        </div>
        <button
          onClick={openCreate}
          title="거래처 등록"
          aria-label="거래처 등록"
          className="responsive-icon-action bg-indigo-600 text-white shadow-sm shadow-indigo-500/20 hover:bg-indigo-700"
        >
          <span className="responsive-action-label">거래처 등록</span>
        </button>
      </div>

      <div className="flex gap-2 border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
        <div className="relative flex-1">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitSearch()}
            placeholder="거래처명, 사업자번호, 담당자, 연락처 검색"
            className="wms-input w-full rounded dark:border-gray-700 dark:bg-gray-800"
          />
        </div>
        <button onClick={commitSearch} className="wms-primary-button rounded px-3 py-1.5 text-sm font-medium transition-colors">검색</button>
      </div>

      <div className="overflow-hidden border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead>
              <tr className={ui.thead}>
                <th className={cn(ui.th, 'text-left')}>상호명</th>
                <th className={cn(ui.th, 'hidden text-left md:table-cell')}>사업자번호</th>
                <th className={cn(ui.th, 'hidden text-left lg:table-cell')}>대표자</th>
                <th className={cn(ui.th, 'hidden text-left lg:table-cell')}>업태/종목</th>
                <th className={cn(ui.th, 'text-left')}>연락처</th>
                <th className={cn(ui.th, 'hidden text-left xl:table-cell')}>등록일</th>
                <th className="w-20 px-4 py-3" />
              </tr>
            </thead>
            <tbody className={ui.tbody}>
              {isLoading && <tr><td colSpan={7} className="py-12 text-center text-gray-400">불러오는 중...</td></tr>}
              {!isLoading && data?.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    거래처가 없습니다
                  </td>
                </tr>
              )}
              {data?.items.map((client) => {
                const { className: editableClass, ...editableHandlers } = editableRowProps(true, () => openEdit(client))
                return (
                <tr key={client.id} {...editableHandlers}
                  className={cn('group', ui.tr, editableClass)}>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {client.name}
                    {client.customerType && (
                      <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400">{client.customerType}</span>
                    )}
                    {client.address && <p className="mt-0.5 max-w-[240px] truncate text-xs text-gray-400">{client.address}</p>}
                  </td>
                  <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-400 md:table-cell">{client.businessNo || '-'}</td>
                  <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-400 lg:table-cell">{client.ceoName || '-'}</td>
                  <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-400 lg:table-cell">{[client.industry, client.sector].filter(Boolean).join(' / ') || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    <div className="flex flex-col gap-0.5 text-xs">
                      {client.phone && <span className="flex items-center gap-1">{client.phone}</span>}
                      {client.mobile && <span className="flex items-center gap-1">{client.mobile}</span>}
                      {client.email && <span className="flex items-center gap-1">{client.email}</span>}
                      {!client.phone && !client.mobile && !client.email && '-'}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-gray-400 xl:table-cell">{formatDateTime(client.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button onClick={(e) => { e.stopPropagation(); openEdit(client) }} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30" title="수정">
                        수정
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(client) }} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30" title="삭제">
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
            {Array.from({ length: data.totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={cn(
                  'h-8 w-8 rounded-lg text-sm transition-colors',
                  n === page ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            {/* 헤더 */}
            <div className="wms-table-header flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white">
                  {editing ? `${editing.name} 수정` : '거래처 등록'}
                </h3>
              </div>
              <button onClick={closeModal} className="p-1 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                닫기
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                editing ? updateMutation.mutate() : createMutation.mutate()
              }}
              className="p-4 space-y-4"
            >
              {/* ── 기본 정보 ── */}
              <section>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 pb-1 mb-2">기본 정보</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="거래처명 *" className="col-span-2 sm:col-span-1">
                    <input
                      autoFocus
                      required
                      value={form.name}
                      onChange={(e) => set('name', e.target.value)}
                      className={cn(inputCls, 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800 font-medium')}
                      placeholder="거래처명을 입력하세요"
                    />
                  </Field>
                  <Field label="고객분류">
                    <select value={form.customerType} onChange={(e) => set('customerType', e.target.value)} className={inputCls}>
                      <option value="">선택</option>
                      <option>매출처</option>
                      <option>매입처</option>
                      <option>매출/매입처</option>
                    </select>
                  </Field>
                  <Field label="대표전화">
                    <input value={form.phone} onChange={(e) => set('phone', formatPhoneInput(e.target.value))} className={inputCls} placeholder="02-0000-0000" inputMode="numeric" />
                  </Field>
                  <Field label="영업사원">
                    <input value={form.salesperson} onChange={(e) => set('salesperson', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="휴대폰">
                    <input value={form.mobile} onChange={(e) => set('mobile', formatPhoneInput(e.target.value))} className={inputCls} placeholder="010-0000-0000" inputMode="numeric" />
                  </Field>
                  <Field label="팩스번호">
                    <input value={form.fax} onChange={(e) => set('fax', formatPhoneInput(e.target.value))} className={inputCls} placeholder="02-0000-0000" inputMode="numeric" />
                  </Field>
                  <Field label="참고사항" className="col-span-2">
                    <input value={form.managerTitle} onChange={(e) => set('managerTitle', e.target.value)} className={inputCls} />
                  </Field>
                </div>
              </section>

              {/* ── 사업자 정보 ── */}
              <section className="border-t border-gray-100 dark:border-gray-700 pt-5">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 pb-1 mb-2 w-full block">사업자 정보</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="사업자번호">
                    <input value={form.businessNo} onChange={(e) => set('businessNo', formatBusinessNoInput(e.target.value))} className={inputCls} placeholder="000-00-00000" inputMode="numeric" />
                  </Field>
                  <Field label="종사업장번호">
                    <input value={form.managementNo} onChange={(e) => set('managementNo', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="대표자명">
                    <input value={form.ceoName} onChange={(e) => set('ceoName', e.target.value)} className={inputCls} />
                  </Field>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 col-span-1">
                    <Field label="업태">
                      <input value={form.industry} onChange={(e) => set('industry', e.target.value)} className={inputCls} />
                    </Field>
                    <Field label="종목">
                      <input value={form.sector} onChange={(e) => set('sector', e.target.value)} className={inputCls} />
                    </Field>
                  </div>
                </div>
              </section>

              {/* ── 주소 정보 ── */}
              <section className="border-t border-gray-100 dark:border-gray-700 pt-5">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 pb-1 mb-2 w-full block">주소 정보</p>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>우편번호</label>
                    <div className="flex gap-2">
                      <input
                        value={form.postalCode}
                        onChange={(e) => set('postalCode', e.target.value)}
                        className={cn(inputCls, 'w-32')}
                        placeholder="00000"
                        readOnly
                      />
                      <button
                        type="button"
                        onClick={openAddressSearch}
                        className="flex items-center gap-1.5 px-4 rounded-xl border border-indigo-300 bg-indigo-50 text-indigo-600 text-sm font-medium hover:bg-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-900/50 transition-colors"
                      >
                        검색
                      </button>
                    </div>
                  </div>
                  <Field label="업체주소">
                    <input
                      value={form.address}
                      onChange={(e) => set('address', e.target.value)}
                      className={inputCls}
                      placeholder="주소 검색 버튼을 이용하거나 직접 입력"
                    />
                  </Field>
                  <Field label="상세주소">
                    <input
                      value={form.addressDetail}
                      onChange={(e) => set('addressDetail', e.target.value)}
                      className={inputCls}
                      placeholder="동, 호수 등 상세주소"
                    />
                  </Field>
                </div>
              </section>

              {/* ── 담당자 정보 ── */}
              <section className="border-t border-gray-100 dark:border-gray-700 pt-5">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 pb-1 mb-2 w-full block">담당자 정보</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="받는이(담당자)">
                    <input
                      value={form.contactName}
                      onChange={(e) => { set('contactName', e.target.value); set('managerName', e.target.value) }}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="존칭어">
                    <select value={form.honorific} onChange={(e) => set('honorific', e.target.value)} className={inputCls}>
                      <option>귀하</option>
                      <option>님</option>
                      <option>담당자님</option>
                    </select>
                  </Field>
                  <Field label="이메일">
                    <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} placeholder="example@email.com" />
                  </Field>
                  <Field label="홈페이지">
                    <input value={form.website} onChange={(e) => set('website', e.target.value)} className={inputCls} placeholder="https://" />
                  </Field>
                </div>
              </section>

              {/* ── 거래 정보 ── */}
              <section className="border-t border-gray-100 dark:border-gray-700 pt-5">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 pb-1 mb-2 w-full block">거래 정보</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="가격등급">
                    <select value={form.pricePolicy} onChange={(e) => set('pricePolicy', e.target.value)} className={inputCls}>
                      <option>매출단가적용</option>
                      <option>도매단가</option>
                      <option>소매단가</option>
                    </select>
                  </Field>
                  <Field label="세액기준">
                    <select value={form.taxType} onChange={(e) => set('taxType', e.target.value)} className={inputCls}>
                      <option>부가세없음</option>
                      <option>부가세별도</option>
                      <option>부가세포함</option>
                    </select>
                  </Field>
                  <Field label="할인율 (%)">
                    <input type="number" min={0} max={100} value={form.discountRate} onChange={(e) => set('discountRate', toNumber(e.target.value))} className={inputCls} />
                  </Field>
                  <Field label="업체 직원수">
                    <input type="number" min={0} value={form.employeeCount} onChange={(e) => set('employeeCount', toNumber(e.target.value))} className={inputCls} />
                  </Field>
                  <Field label="초기 미수금">
                    <input type="number" value={form.initialReceivable} onChange={(e) => set('initialReceivable', toNumber(e.target.value))} className={inputCls} />
                  </Field>
                  <div className="flex items-end pb-0.5">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={form.unpaidOnly}
                        onChange={(e) => set('unpaidOnly', e.target.checked)}
                        className="w-4 h-4 rounded accent-indigo-600"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">거래명세 미수금 인쇄</span>
                    </label>
                  </div>
                </div>
              </section>

              {/* ── 관리 정보 ── */}
              <section className="border-t border-gray-100 dark:border-gray-700 pt-5">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 pb-1 mb-2 w-full block">관리 정보</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="등록일자">
                    <input type="date" value={form.registrationDate} onChange={(e) => set('registrationDate', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="관리번호">
                    <input value={form.managementNo} onChange={(e) => set('managementNo', e.target.value)} className={inputCls} />
                  </Field>
                </div>
              </section>

              {/* ── 메모 ── */}
              <section className="border-t border-gray-100 dark:border-gray-700 pt-5">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 pb-1 mb-2 w-full block">메모</p>
                <textarea
                  value={form.memo}
                  onChange={(e) => set('memo', e.target.value)}
                  rows={3}
                  className={cn(inputCls, 'resize-none')}
                  placeholder="메모를 입력하세요..."
                />
              </section>

              {/* 버튼 */}
              <div className="flex justify-end gap-2 border-t border-gray-100 dark:border-gray-700 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="wms-primary-button px-5 py-2 rounded text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? '저장 중...'
                    : editing ? '수정 완료' : '거래처 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
