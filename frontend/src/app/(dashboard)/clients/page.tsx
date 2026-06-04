'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Mail, Pencil, Phone, Plus, Search, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { clientApi } from '@/api/client.api'
import { formatDateTime, formatNumber } from '@/utils/format'
import type { Client } from '@/types/api.types'

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

const TEMP_CLIENT_DATA: FormState = {
  name: '테스트 거래처',
  customerType: '매출처',
  salesperson: '홍길동',
  businessNo: '123-45-67890',
  ceoName: '김대표',
  industry: '도소매',
  sector: '전자부품',
  phone: '02-1234-5678',
  mobile: '010-9876-5432',
  fax: '02-8765-4321',
  postalCode: '04524',
  address: '서울특별시 중구 세종대로 110',
  addressDetail: '10층',
  contactName: '박담당자',
  honorific: '귀하',
  email: 'test-client@example.com',
  website: 'https://example.com',
  employeeCount: 25,
  pricePolicy: '도매단가',
  taxType: '부가세별도',
  discountRate: 10,
  initialReceivable: 500000,
  unpaidOnly: true,
  registrationDate: today(),
  managementNo: 'MGR-2026-001',
  managerName: '박담당자',
  managerTitle: '영업팀장',
  memo: '임시 테스트용 거래처입니다.',
}

type FormState = typeof EMPTY_FORM

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={`grid grid-cols-[92px_1fr] items-center gap-2 text-[12px] text-gray-700 ${className}`}>
      <span className="text-right font-medium">{label}</span>
      {children}
    </label>
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

  const commitSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

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

  const fillTemporaryData = () => {
    setForm(TEMP_CLIENT_DATA)
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

  const setValue = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const inputCls = 'h-7 w-full border border-gray-400 bg-white px-2 text-[12px] text-gray-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500'
  const selectCls = `${inputCls} pr-6`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">거래처 관리</h2>
          {data && <p className="mt-0.5 text-xs text-gray-400">전체 {formatNumber(data.total)}건</p>}
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm shadow-indigo-500/20 transition-colors hover:bg-indigo-700"
        >
          <Plus size={15} />거래처 등록
        </button>
      </div>

      <div className="flex gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="relative flex flex-1 gap-1.5">
          <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && commitSearch()}
              placeholder="거래처명, 사업자번호, 담당자, 연락처 검색"
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <button onClick={commitSearch} className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700">검색</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-800/60">
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">상호명/고객</th>
                <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 md:table-cell">사업자번호</th>
                <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 lg:table-cell">대표자</th>
                <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 lg:table-cell">업태/종목</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500">연락처</th>
                <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 xl:table-cell">등록일</th>
                <th className="w-20 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {isLoading && <tr><td colSpan={7} className="py-12 text-center text-gray-400">불러오는 중...</td></tr>}
              {!isLoading && data?.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-400">
                    <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                    거래처가 없습니다
                  </td>
                </tr>
              )}
              {data?.items.map((client) => (
                <tr key={client.id} className="group transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {client.name}
                    {client.address && <p className="max-w-[240px] truncate text-xs text-gray-400">{client.address}</p>}
                  </td>
                  <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-400 md:table-cell">{client.businessNo || '-'}</td>
                  <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-400 lg:table-cell">{client.ceoName || '-'}</td>
                  <td className="hidden px-4 py-3 text-gray-600 dark:text-gray-400 lg:table-cell">{[client.industry, client.sector].filter(Boolean).join(' / ') || '-'}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    <div className="flex flex-col gap-0.5 text-xs">
                      {client.phone && <span className="flex items-center gap-1"><Phone size={11} />{client.phone}</span>}
                      {client.mobile && <span className="flex items-center gap-1"><Phone size={11} />{client.mobile}</span>}
                      {client.email && <span className="flex items-center gap-1"><Mail size={11} />{client.email}</span>}
                      {!client.phone && !client.mobile && !client.email && '-'}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-gray-400 xl:table-cell">{formatDateTime(client.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button onClick={() => openEdit(client)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-900/30" title="수정">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(client)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30" title="삭제">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
            {Array.from({ length: data.totalPages }, (_, index) => index + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`h-8 w-8 rounded-lg text-sm transition-colors ${n === page ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}
              >
                {formatNumber(n)}
              </button>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4 pt-10">
          <div className="w-full max-w-[780px] border border-gray-500 bg-[#f0f0ec] shadow-2xl">
            <div className="flex h-10 items-center justify-between bg-[#7a7a78] px-3 text-white">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Building2 size={18} />
                고객/거래처 등록 및 수정
              </div>
              <button onClick={closeModal} className="flex h-7 items-center gap-1 border border-gray-500 bg-[#ececec] px-3 text-xs font-semibold text-gray-900 hover:bg-white">
                <X size={14} />닫기(F12)
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault()
                editing ? updateMutation.mutate() : createMutation.mutate()
              }}
              className="px-7 py-5"
            >
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                  <Field label="고객/거래처">
                    <input autoFocus required value={form.name} onChange={(event) => setValue('name', event.target.value)} className={`${inputCls} bg-blue-100`} />
                  </Field>
                  <Field label="고객분류">
                    <select value={form.customerType} onChange={(event) => setValue('customerType', event.target.value)} className={selectCls}>
                      <option value="">선택</option>
                      <option value="매출처">매출처</option>
                      <option value="매입처">매입처</option>
                      <option value="매출/매입처">매출/매입처</option>
                    </select>
                  </Field>
                  <Field label="대표전화">
                    <input value={form.phone} onChange={(event) => setValue('phone', event.target.value)} className={inputCls} />
                  </Field>
                  <Field label="영업사원">
                    <input value={form.salesperson} onChange={(event) => setValue('salesperson', event.target.value)} className={inputCls} />
                  </Field>
                  <Field label="휴대폰">
                    <input value={form.mobile} onChange={(event) => setValue('mobile', event.target.value)} className={inputCls} />
                  </Field>
                  <Field label="팩스번호">
                    <input value={form.fax} onChange={(event) => setValue('fax', event.target.value)} className={inputCls} />
                  </Field>
                </div>

                <Field label="참고사항" className="grid-cols-[92px_1fr]">
                  <input value={form.managerTitle} onChange={(event) => setValue('managerTitle', event.target.value)} className={inputCls} />
                </Field>

                <div className="my-2 border-t border-gray-400" />

                <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                  <Field label="사업자No">
                    <input value={form.businessNo} onChange={(event) => setValue('businessNo', event.target.value)} className={inputCls} />
                  </Field>
                  <div className="grid grid-cols-[92px_1fr_48px_1fr] items-center gap-2 text-[12px] text-gray-700">
                    <span className="text-right font-medium">대표자명</span>
                    <input value={form.ceoName} onChange={(event) => setValue('ceoName', event.target.value)} className={inputCls} />
                    <span className="text-right font-medium">종사업</span>
                    <input value={form.managementNo} onChange={(event) => setValue('managementNo', event.target.value)} className={inputCls} />
                  </div>
                  <Field label="업태">
                    <input value={form.industry} onChange={(event) => setValue('industry', event.target.value)} className={inputCls} />
                  </Field>
                  <Field label="종목">
                    <input value={form.sector} onChange={(event) => setValue('sector', event.target.value)} className={inputCls} />
                  </Field>
                </div>

                <div className="grid grid-cols-[92px_130px_1fr] items-center gap-2 text-[12px] text-gray-700">
                  <span className="text-right font-medium">주소검색</span>
                  <input value={form.postalCode} onChange={(event) => setValue('postalCode', event.target.value)} className={inputCls} />
                  <span className="text-gray-700">(도로명+건물번호나, 읍/동/면을 입력요망.)</span>
                </div>
                <Field label="업체주소">
                  <input value={form.address} onChange={(event) => setValue('address', event.target.value)} className={inputCls} />
                </Field>
                <Field label="상세주소">
                  <input value={form.addressDetail} onChange={(event) => setValue('addressDetail', event.target.value)} className={inputCls} />
                </Field>

                <div className="my-2 border-t border-gray-400" />

                <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                  <Field label="받는이">
                    <input value={form.contactName} onChange={(event) => { setValue('contactName', event.target.value); setValue('managerName', event.target.value) }} className={inputCls} />
                  </Field>
                  <Field label="존칭어">
                    <select value={form.honorific} onChange={(event) => setValue('honorific', event.target.value)} className={selectCls}>
                      <option value="귀하">귀하</option>
                      <option value="님">님</option>
                      <option value="담당자님">담당자님</option>
                    </select>
                  </Field>
                </div>
                <Field label="E-MAIL">
                  <input type="email" value={form.email} onChange={(event) => setValue('email', event.target.value)} className={inputCls} />
                </Field>
                <Field label="홈페이지">
                  <input value={form.website} onChange={(event) => setValue('website', event.target.value)} className={inputCls} />
                </Field>

                <div className="my-2 border-t border-gray-400" />

                <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                  <Field label="업체직원">
                    <input type="number" min={0} value={form.employeeCount} onChange={(event) => setValue('employeeCount', toNumber(event.target.value))} className={inputCls} />
                  </Field>
                  <Field label="세액기준">
                    <select value={form.taxType} onChange={(event) => setValue('taxType', event.target.value)} className={selectCls}>
                      <option value="부가세없음">부가세없음</option>
                      <option value="부가세별도">부가세별도</option>
                      <option value="부가세포함">부가세포함</option>
                    </select>
                  </Field>
                  <Field label="가격등급">
                    <select value={form.pricePolicy} onChange={(event) => setValue('pricePolicy', event.target.value)} className={selectCls}>
                      <option value="매출단가적용">매출단가적용</option>
                      <option value="도매단가">도매단가</option>
                      <option value="소매단가">소매단가</option>
                    </select>
                  </Field>
                  <Field label="할인적용">
                    <div className="flex items-center gap-1">
                      <input type="number" min={0} value={form.discountRate} onChange={(event) => setValue('discountRate', toNumber(event.target.value))} className={`${inputCls} text-right`} />
                      <span>%</span>
                    </div>
                  </Field>
                  <Field label="초기미수">
                    <input type="number" value={form.initialReceivable} onChange={(event) => setValue('initialReceivable', toNumber(event.target.value))} className={`${inputCls} text-right`} />
                  </Field>
                  <label className="flex h-7 items-center gap-2 text-[12px] text-gray-700">
                    <input type="checkbox" checked={form.unpaidOnly} onChange={(event) => setValue('unpaidOnly', event.target.checked)} />
                    거래명세 미수금인쇄
                  </label>
                </div>

                <div className="my-2 border-t border-gray-400" />

                <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                  <Field label="등록일자">
                    <input type="date" value={form.registrationDate} onChange={(event) => setValue('registrationDate', event.target.value)} className={inputCls} />
                  </Field>
                  <Field label="관리번호">
                    <input value={form.managementNo} onChange={(event) => setValue('managementNo', event.target.value)} className={`${inputCls} text-right`} />
                  </Field>
                </div>

                <Field label="메모사항" className="items-start">
                  <textarea value={form.memo} onChange={(event) => setValue('memo', event.target.value)} rows={5} className="w-full resize-none border border-gray-400 bg-white px-2 py-1 text-[12px] text-gray-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500" />
                </Field>
              </div>

              <div className="mt-3 flex flex-col gap-2 border-t border-gray-400 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[12px] text-gray-500">고객/거래처명이 없을시 자동저장이 안됩니다.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={fillTemporaryData}
                    className="border border-gray-500 bg-white px-4 py-2 text-[12px] font-semibold hover:bg-gray-50"
                  >
                    임시 데이터 채우기
                  </button>
                  <button type="button" className="border border-gray-500 bg-[#ececec] px-4 py-2 text-[12px] font-semibold hover:bg-white">
                    연속입력(F6)
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="border border-gray-500 bg-[#ececec] px-5 py-2 text-[12px] font-semibold hover:bg-white disabled:opacity-50"
                  >
                    저장후 전표작성
                  </button>
                </div>
              </div>
              <p className="mt-2 text-center text-[13px] font-bold text-red-600">한글자료 입력시, 꼭 엔터를 치시기바랍니다.</p>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
