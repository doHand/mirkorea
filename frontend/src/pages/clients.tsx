'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { ColDef } from 'ag-grid-community'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { clientApi } from '@/api/client.api'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { formatBusinessNoInput, formatNumber, formatPhoneInput } from '@/utils/format'
import { cn } from '@/utils/cn'
import { getApiErrorMessage } from '@/utils/error'
import { AppAgGrid } from '@/components/AppAgGrid'
import { GridPageLayout } from '@/components/grid/GridPageLayout'
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
  const parsed = Number(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function toMoneyNumber(value: string) {
  return toNumber(value.replace(/[^\d.-]/g, ''))
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '')
}

function validateClientForm(values: FormState) {
  if (!values.name.trim()) return '거래처명을 입력해주세요'
  if (!values.customerType.trim()) return '고객분류를 선택해주세요'

  const phoneDigits = onlyDigits(values.phone)
  const mobileDigits = onlyDigits(values.mobile)
  if (!phoneDigits && !mobileDigits) return '대표전화 또는 휴대폰 중 하나를 입력해주세요'
  if (phoneDigits && phoneDigits.length < 8) return '대표전화 번호를 확인해주세요'
  if (mobileDigits && mobileDigits.length < 10) return '휴대폰 번호를 확인해주세요'

  const businessNoDigits = onlyDigits(values.businessNo)
  if (businessNoDigits && businessNoDigits.length !== 10) return '사업자번호는 10자리로 입력해주세요'

  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    return '이메일 형식을 확인해주세요'
  }

  return null
}

function clientToForm(client: Client): FormState {
  return {
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
  }
}

const inputCls = 'wms-input w-full dark:border-gray-700 dark:bg-gray-800 transition-colors'
const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'
const CUSTOMER_TYPES = ['매출처', '매입처', '매출/매입처'] as const

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
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [panelEditing, setPanelEditing] = useState(false)
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
    onError: (error) => toast.error(getApiErrorMessage(error, '거래처 등록에 실패했습니다')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => clientApi.delete(id),
    onSuccess: () => {
      toast.success('거래처 삭제 완료')
      setSelectedClient(null)
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
    onError: (error) => toast.error(getApiErrorMessage(error, '거래처 삭제에 실패했습니다')),
  })

  const commitSearch = () => { setSearch(searchInput); setPage(1) }

  const selectClient = (client: Client) => {
    setSelectedClient(client)
    setPanelEditing(false)
  }

  const editInPanel = (client: Client) => {
    setSelectedClient(client)
    setPanelEditing(true)
  }

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, registrationDate: today() })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setForm({ ...EMPTY_FORM, registrationDate: today() })
  }
  useEscapeKey(closeModal, showModal)

  const resetSearch = () => {
    setSearchInput('')
    setSearch('')
    setPage(1)
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

  const columns = useMemo<ColDef<Client>[]>(() => [
    {
      headerName: '상호명',
      field: 'name',
      minWidth: 260,
      flex: 1.35,
      pinned: 'left',
      cellRenderer: (p: { data?: Client }) => p.data ? (
        <div className="flex h-full min-w-0 flex-col justify-center leading-tight">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate font-semibold text-gray-900 dark:text-white">{p.data.name}</span>
            {p.data.customerType && (
              <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
                {p.data.customerType}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-gray-400">
            {[p.data.address, p.data.addressDetail].filter(Boolean).join(' ') || p.data.memo || '-'}
          </p>
        </div>
      ) : '-',
    },
    {
      headerName: '사업자/대표',
      width: 155,
      valueGetter: (p) => [p.data?.businessNo, p.data?.ceoName].filter(Boolean).join(' / ') || '-',
      cellRenderer: (p: { data?: Client }) => p.data ? (
        <div className="flex h-full flex-col justify-center leading-tight">
          <span className="font-mono text-xs text-gray-700 dark:text-gray-200">{p.data.businessNo || '-'}</span>
          <span className="mt-0.5 text-xs text-gray-400">{p.data.ceoName || '-'}</span>
        </div>
      ) : '-',
    },
    {
      headerName: '업태/종목',
      minWidth: 145,
      flex: 0.75,
      valueGetter: (p) => [p.data?.industry, p.data?.sector].filter(Boolean).join(' / ') || '-',
      cellRenderer: (p: { data?: Client }) => {
        const values = [p.data?.industry, p.data?.sector].filter(Boolean)
        return values.length ? (
          <div className="flex h-full flex-col justify-center leading-tight text-xs text-gray-600 dark:text-gray-300">
            <span className="truncate">{values[0]}</span>
            {values[1] && <span className="truncate text-gray-400">{values[1]}</span>}
          </div>
        ) : '-'
      },
    },
    {
      headerName: '연락처',
      minWidth: 190,
      flex: 0.95,
      valueGetter: (p) => [p.data?.phone, p.data?.mobile, p.data?.email].filter(Boolean).join(' / ') || '-',
      cellRenderer: (p: { data?: Client }) => {
        const contacts = [p.data?.phone, p.data?.mobile, p.data?.email].filter(Boolean)
        return contacts.length ? (
          <div className="flex h-full flex-col justify-center leading-tight text-xs text-gray-600 dark:text-gray-300">
            <span className="truncate">{contacts[0]}</span>
            {contacts[1] && <span className="truncate text-gray-400">{contacts[1]}</span>}
          </div>
        ) : '-'
      },
    },
    {
      headerName: '담당',
      width: 130,
      valueGetter: (p) => [p.data?.contactName || p.data?.managerName, p.data?.salesperson].filter(Boolean).join(' / ') || '-',
      cellRenderer: (p: { data?: Client }) => (
        <div className="flex h-full flex-col justify-center leading-tight text-xs">
          <span className="truncate text-gray-700 dark:text-gray-200">{p.data?.contactName || p.data?.managerName || '-'}</span>
          {p.data?.salesperson && <span className="truncate text-gray-400">{p.data.salesperson}</span>}
        </div>
      ),
    },
    {
      headerName: '관리번호',
      width: 115,
      valueGetter: (p) => p.data?.managementNo || '-',
      cellClass: 'font-mono text-xs text-gray-500',
    },
    {
      headerName: '등록일',
      width: 112,
      valueGetter: (p) => p.data?.registrationDate || (p.data?.createdAt ? p.data.createdAt.slice(0, 10) : '-'),
    },
  ], [])

  return (
    <GridPageLayout
      title="거래처 관리"
      description={`전체 ${formatNumber(data?.total ?? 0)}건`}
      toolbar={
        <button
          onClick={openCreate}
          title="거래처 등록"
          aria-label="거래처 등록"
          className="wms-primary-button inline-flex h-8 items-center rounded px-3 text-xs font-semibold"
        >
          거래처 등록
        </button>
      }
    >

      <div className="rounded border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commitSearch()}
              placeholder="거래처명, 사업자번호, 담당자, 연락처 검색"
              className="wms-input w-full rounded dark:border-gray-700 dark:bg-gray-800"
            />
          </div>
          <button onClick={commitSearch} className="wms-primary-button h-9 rounded px-4 text-sm font-medium transition-colors">검색</button>
          <button onClick={resetSearch} className="wms-toolbar-action h-9 rounded px-3 text-sm font-medium transition-colors">초기화</button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="min-h-0 flex-1">
            <AppAgGrid
              rows={data?.items ?? []}
              columns={columns}
              loading={isLoading}
              onRowClicked={selectClient}
              onRowDoubleClicked={editInPanel}
              rowHeight={56}
              headerHeight={38}
            />
          </div>
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-2 text-sm dark:border-gray-800">
              <span className="text-xs text-gray-400">
                {formatNumber(page)} / {formatNumber(data.totalPages)} 페이지
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="wms-toolbar-action h-8 rounded px-3 text-xs font-semibold disabled:opacity-40"
                >
                  이전
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                  className="wms-toolbar-action h-8 rounded px-3 text-xs font-semibold disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </div>

        {selectedClient && (
          <ClientDetailPanel
            client={selectedClient}
            editing={panelEditing}
            onClose={() => setSelectedClient(null)}
            onEditingChange={setPanelEditing}
            onDelete={() => handleDelete(selectedClient)}
            onSaved={(client) => {
              setSelectedClient(client)
              setPanelEditing(false)
            }}
          />
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            {/* 헤더 */}
            <div className="wms-table-header flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white">
                  거래처 등록
                </h3>
              </div>
              <button onClick={closeModal} className="p-1 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors">
                닫기
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                const validationError = validateClientForm(form)
                if (validationError) {
                  toast.error(validationError)
                  return
                }
                createMutation.mutate()
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
                  <Field label="고객분류 *">
                    <CustomerTypeToggle value={form.customerType} onChange={(value) => set('customerType', value)} />
                  </Field>
                  <Field label="대표전화 *">
                    <input value={form.phone} onChange={(e) => set('phone', formatPhoneInput(e.target.value))} className={inputCls} placeholder="02-0000-0000" inputMode="numeric" aria-describedby="client-contact-required" />
                  </Field>
                  <Field label="영업사원">
                    <input value={form.salesperson} onChange={(e) => set('salesperson', e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="휴대폰 *">
                    <input value={form.mobile} onChange={(e) => set('mobile', formatPhoneInput(e.target.value))} className={inputCls} placeholder="010-0000-0000" inputMode="numeric" aria-describedby="client-contact-required" />
                  </Field>
                  <Field label="팩스번호">
                    <input value={form.fax} onChange={(e) => set('fax', formatPhoneInput(e.target.value))} className={inputCls} placeholder="02-0000-0000" inputMode="numeric" />
                  </Field>
                  <Field label="참고사항" className="col-span-2">
                    <input value={form.managerTitle} onChange={(e) => set('managerTitle', e.target.value)} className={inputCls} />
                  </Field>
                  <p id="client-contact-required" className="col-span-2 text-xs text-gray-400">대표전화와 휴대폰 중 하나는 필수입니다.</p>
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
                  <Field label="할인율">
                    <div className="relative">
                      <input type="number" min={0} max={100} value={form.discountRate} onChange={(e) => set('discountRate', toNumber(e.target.value))} className={cn(inputCls, 'pr-9')} />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-gray-400">%</span>
                    </div>
                  </Field>
                  <Field label="업체 직원수">
                    <input type="number" min={0} value={form.employeeCount} onChange={(e) => set('employeeCount', toNumber(e.target.value))} className={inputCls} />
                  </Field>
                  <Field label="초기 미수금">
                    <input
                      value={formatNumber(form.initialReceivable)}
                      onChange={(e) => set('initialReceivable', toMoneyNumber(e.target.value))}
                      className={inputCls}
                      inputMode="numeric"
                    />
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
                  disabled={createMutation.isPending}
                  className="wms-primary-button px-5 py-2 rounded text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  {createMutation.isPending
                    ? '저장 중...'
                    : '거래처 등록'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </GridPageLayout>
  )
}

function ClientDetailPanel({
  client,
  editing,
  onClose,
  onEditingChange,
  onDelete,
  onSaved,
}: {
  client: Client
  editing: boolean
  onClose: () => void
  onEditingChange: (editing: boolean) => void
  onDelete: () => void
  onSaved: (client: Client) => void
}) {
  useEscapeKey(onClose)
  const qc = useQueryClient()
  const [editForm, setEditForm] = useState<FormState>(() => clientToForm(client))
  useEffect(() => {
    setEditForm(clientToForm(client))
  }, [client])
  const address = [client.address, client.addressDetail].filter(Boolean).join(' ')
  const manager = client.contactName || client.managerName || '-'
  const typeLabel = editing ? (editForm.customerType || '거래처') : (client.customerType || '거래처')

  const updatePanelMutation = useMutation({
    mutationFn: () => clientApi.update(client.id, {
      ...editForm,
      employeeCount: toNumber(editForm.employeeCount),
      discountRate: toNumber(editForm.discountRate),
      initialReceivable: toNumber(editForm.initialReceivable),
      managerName: editForm.managerName || editForm.contactName,
    }),
    onSuccess: (updated) => {
      toast.success('거래처 수정 완료')
      qc.invalidateQueries({ queryKey: ['clients'] })
      onSaved(updated)
    },
    onError: (error) => toast.error(getApiErrorMessage(error, '거래처 수정에 실패했습니다')),
  })

  const setEdit = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setEditForm((prev) => ({ ...prev, [key]: value }))

  const openPanelAddressSearch = () => {
    if (!window.daum?.Postcode) {
      toast.error('주소검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        setEditForm((prev) => ({
          ...prev,
          postalCode: data.zonecode,
          address: data.roadAddress || data.jibunAddress,
          addressDetail: '',
        }))
      },
    }).open()
  }

  return (
    <aside className="wms-detail-panel-enter flex min-h-0 w-96 shrink-0 flex-col overflow-hidden rounded border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="min-w-0">
          <div className="mb-1 flex min-w-0 items-center gap-2">
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">{typeLabel}</span>
            {(editing ? editForm.managementNo : client.managementNo) && <span className="font-mono text-[11px] text-gray-400">{editing ? editForm.managementNo : client.managementNo}</span>}
          </div>
          {editing ? (
            <input
              value={editForm.name}
              onChange={(e) => setEdit('name', e.target.value)}
              className="w-full rounded border border-gray-200 bg-white px-2 py-1 text-sm font-bold text-gray-900 outline-none focus:border-[var(--color-primary)] dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            />
          ) : (
            <p className="truncate text-base font-bold text-gray-900 dark:text-white">{client.name}</p>
          )}
          <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">{editing ? [editForm.address, editForm.addressDetail].filter(Boolean).join(' ') || editForm.memo || '주소 정보 없음' : address || client.memo || '주소 정보 없음'}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="wms-toolbar-action ml-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <section className="grid grid-cols-2 gap-2">
          {editing ? (
            <>
              <EditField label="담당자" value={editForm.contactName} onChange={(value) => { setEdit('contactName', value); setEdit('managerName', value) }} />
              <EditField label="영업담당" value={editForm.salesperson} onChange={(value) => setEdit('salesperson', value)} />
              <EditField label="전화" value={editForm.phone} onChange={(value) => setEdit('phone', formatPhoneInput(value))} placeholder="02-0000-0000" inputMode="numeric" mono />
              <EditField label="휴대폰" value={editForm.mobile} onChange={(value) => setEdit('mobile', formatPhoneInput(value))} placeholder="010-0000-0000" inputMode="numeric" mono />
            </>
          ) : (
            <>
              <InfoTile label="담당자" value={manager} />
              <InfoTile label="영업담당" value={client.salesperson || '-'} />
              <InfoTile label="전화" value={client.phone || '-'} mono />
              <InfoTile label="휴대폰" value={client.mobile || '-'} mono />
            </>
          )}
        </section>

        <DetailSection title="사업자 정보">
          {editing ? (
            <>
              <EditRow label="고객분류">
                <CustomerTypeToggle value={editForm.customerType} onChange={(value) => setEdit('customerType', value)} compact />
              </EditRow>
              <EditRow label="사업자번호" value={editForm.businessNo} onChange={(value) => setEdit('businessNo', formatBusinessNoInput(value))} mono />
              <EditRow label="대표자" value={editForm.ceoName} onChange={(value) => setEdit('ceoName', value)} />
              <EditRow label="업태" value={editForm.industry} onChange={(value) => setEdit('industry', value)} />
              <EditRow label="종목" value={editForm.sector} onChange={(value) => setEdit('sector', value)} />
              <EditRow label="등록일" type="date" value={editForm.registrationDate} onChange={(value) => setEdit('registrationDate', value)} />
              <EditRow label="관리번호" value={editForm.managementNo} onChange={(value) => setEdit('managementNo', value)} mono />
            </>
          ) : (
            <>
              <DetailField label="사업자번호" value={client.businessNo || '-'} mono />
              <DetailField label="대표자" value={client.ceoName || '-'} />
              <DetailField label="업태" value={client.industry || '-'} />
              <DetailField label="종목" value={client.sector || '-'} />
              <DetailField label="등록일" value={client.registrationDate || client.createdAt.slice(0, 10)} />
            </>
          )}
        </DetailSection>

        <DetailSection title="연락처">
          {editing ? (
            <>
              <EditRow label="이메일" type="email" value={editForm.email} onChange={(value) => setEdit('email', value)} />
              <EditRow label="팩스" value={editForm.fax} onChange={(value) => setEdit('fax', formatPhoneInput(value))} />
              <EditRow label="웹사이트" value={editForm.website} onChange={(value) => setEdit('website', value)} />
            </>
          ) : (
            <>
              <DetailField label="이메일" value={client.email || '-'} />
              <DetailField label="팩스" value={client.fax || '-'} />
              <DetailField label="웹사이트" value={client.website || '-'} />
            </>
          )}
        </DetailSection>

        <DetailSection title="거래 조건">
          {editing ? (
            <>
              <EditRow label="우편번호">
                <div className="flex min-w-0 gap-2">
                  <input
                    value={editForm.postalCode}
                    onChange={(e) => setEdit('postalCode', e.target.value)}
                    className="min-w-0 flex-1 rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-800 outline-none focus:border-[var(--color-primary)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    placeholder="00000"
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    onClick={openPanelAddressSearch}
                    className="shrink-0 rounded border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
                  >
                    검색
                  </button>
                </div>
              </EditRow>
              <EditRow label="주소" value={editForm.address} onChange={(value) => setEdit('address', value)} />
              <EditRow label="상세주소" value={editForm.addressDetail} onChange={(value) => setEdit('addressDetail', value)} />
              <EditRow label="가격정책" value={editForm.pricePolicy} onChange={(value) => setEdit('pricePolicy', value)} />
              <EditRow label="세금구분" value={editForm.taxType} onChange={(value) => setEdit('taxType', value)} />
              <EditRow label="할인율" type="number" value={String(editForm.discountRate)} onChange={(value) => setEdit('discountRate', toNumber(value))} suffix="%" />
              <EditRow label="초기 미수금" value={formatNumber(editForm.initialReceivable)} onChange={(value) => setEdit('initialReceivable', toMoneyNumber(value))} inputMode="numeric" />
              <EditRow label="메모" value={editForm.memo} onChange={(value) => setEdit('memo', value)} />
            </>
          ) : (
            <>
              {client.postalCode && <DetailField label="우편번호" value={client.postalCode} mono />}
              <DetailField label="주소" value={address || '-'} />
              <DetailField label="가격정책" value={client.pricePolicy || '-'} />
              <DetailField label="세금구분" value={client.taxType || '-'} />
              <DetailField label="할인율" value={`${formatNumber(client.discountRate ?? 0)}%`} />
              <DetailField label="초기 미수금" value={`${formatNumber(client.initialReceivable ?? 0)}원`} />
              {client.memo && <DetailField label="메모" value={client.memo} />}
            </>
          )}
        </DetailSection>
      </div>

      <div className="flex gap-2 border-t border-gray-200 p-3 dark:border-gray-800">
        <button
          type="button"
          onClick={() => {
            if (editing) {
              const validationError = validateClientForm(editForm)
              if (validationError) {
                toast.error(validationError)
                return
              }
              updatePanelMutation.mutate()
              return
            }
            onEditingChange(true)
          }}
          disabled={updatePanelMutation.isPending}
          className="wms-toolbar-action flex-1 rounded py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {editing ? (updatePanelMutation.isPending ? '저장 중...' : '저장') : '수정'}
        </button>
        {editing ? (
          <button
            type="button"
            onClick={() => { setEditForm(clientToForm(client)); onEditingChange(false) }}
            className="flex-1 rounded border border-gray-200 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            취소
          </button>
        ) : (
          <button
            type="button"
            onClick={onDelete}
            className="flex-1 rounded border border-rose-200 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40"
          >
            삭제
          </button>
        )}
      </div>
    </aside>
  )
}

function CustomerTypeToggle({
  value,
  onChange,
  compact = false,
}: {
  value: string
  onChange: (value: string) => void
  compact?: boolean
}) {
  return (
    <div className={cn('grid gap-1', compact ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-3')}>
      {CUSTOMER_TYPES.map((type) => {
        const active = value === type
        return (
          <button
            key={type}
            type="button"
            onClick={() => onChange(active ? '' : type)}
            className={cn(
              'h-9 min-w-0 rounded border px-2 text-xs font-semibold transition-colors',
              active
                ? 'border-[var(--color-primary)] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200'
                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
            )}
          >
            {type}
          </button>
        )
      })}
    </div>
  )
}

function InfoTile({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-950/40">
      <p className="text-[11px] font-medium text-gray-400">{label}</p>
      <p className={cn('mt-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100', mono && 'font-mono text-xs')}>
        {value}
      </p>
    </div>
  )
}

function EditField({
  label,
  value,
  onChange,
  mono = false,
  placeholder,
  inputMode,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  mono?: boolean
  placeholder?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  return (
    <label className="rounded border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-950/40">
      <span className="text-[11px] font-medium text-gray-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className={cn(
          'mt-1 w-full rounded border border-gray-200 bg-white px-2 py-1 text-sm font-semibold text-gray-900 outline-none focus:border-[var(--color-primary)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100',
          mono && 'font-mono text-xs',
        )}
      />
    </label>
  )
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="border-b border-gray-100 px-3 py-2 dark:border-gray-800">
        <h3 className="text-xs font-bold text-gray-700 dark:text-gray-200">{title}</h3>
      </div>
      <dl className="divide-y divide-gray-100 dark:divide-gray-800">
        {children}
      </dl>
    </section>
  )
}

function EditRow({
  label,
  value,
  onChange,
  type = 'text',
  mono = false,
  children,
  suffix,
  inputMode,
}: {
  label: string
  value?: string
  onChange?: (value: string) => void
  type?: string
  mono?: boolean
  children?: React.ReactNode
  suffix?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  if (children) {
    return (
      <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 px-3 py-2">
        <span className="text-[11px] font-medium text-gray-400">{label}</span>
        {children}
      </div>
    )
  }

  return (
    <label className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 px-3 py-2">
      <span className="text-[11px] font-medium text-gray-400">{label}</span>
      <span className="relative min-w-0">
        <input
          type={type}
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          inputMode={inputMode}
          className={cn(
            'w-full min-w-0 rounded border border-gray-200 bg-white px-2 py-1 text-sm text-gray-800 outline-none focus:border-[var(--color-primary)] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100',
            mono && 'font-mono text-xs',
            suffix && 'pr-7',
          )}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs font-semibold text-gray-400">
            {suffix}
          </span>
        )}
      </span>
    </label>
  )
}

function DetailField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 px-3 py-2">
      <dt className="text-[11px] font-medium text-gray-400">{label}</dt>
      <dd className={cn(
        'min-w-0 break-words text-sm text-gray-800 dark:text-gray-100',
        mono && 'font-mono text-xs',
      )}>
        {value}
      </dd>
    </div>
  )
}
