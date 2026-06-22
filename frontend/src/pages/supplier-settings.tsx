'use client'

import { Building2, RotateCcw, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { DEFAULT_SUPPLIER_INFO, useSupplierInfoStore } from '@/stores/supplier-info.store'
import type { SupplierInfo } from '@/stores/supplier-info.store'
import { formatBusinessNoInput, formatPhoneInput } from '@/utils/format'

const FIELDS: Array<{ key: keyof SupplierInfo; label: string; placeholder: string }> = [
  { key: 'name', label: '상호', placeholder: '미르코리아' },
  { key: 'businessNo', label: '사업번호', placeholder: '000-00-00000' },
  { key: 'ceo', label: '대표자', placeholder: '대표자명' },
  { key: 'phone', label: '전화번호', placeholder: '031-000-0000' },
  { key: 'fax', label: '팩스번호', placeholder: '031-000-0000' },
  { key: 'address', label: '주소', placeholder: '사업장 주소' },
]

export default function SupplierSettingsPage() {
  const info = useSupplierInfoStore((state) => state.info)
  const update = useSupplierInfoStore((state) => state.update)
  const reset = useSupplierInfoStore((state) => state.reset)

  const handleReset = () => {
    if (!confirm('공급자 정보를 기본값으로 되돌리시겠습니까?')) return
    reset()
    toast.success('공급자 정보를 기본값으로 되돌렸습니다')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900 dark:text-white">
            <Building2 size={18} className="text-indigo-500" />
            공급자 정보 관리
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">거래명세서/견적서 출력에 들어가는 공급자 사업번호와 기본 정보를 관리합니다.</p>
        </div>
        <button
          onClick={handleReset}
          title="기본값 복원"
          aria-label="기본값 복원"
          className="responsive-icon-action self-start border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 sm:self-auto"
        >
          <RotateCcw size={14} /><span className="responsive-action-label">기본값</span>
        </button>
      </div>

      <div className="max-w-3xl rounded border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">출력용 공급자 정보</h3>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          {FIELDS.map((field) => (
            <label key={field.key} className={field.key === 'address' ? 'sm:col-span-2' : ''}>
              <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400">{field.label}</span>
              <input
                value={info[field.key]}
                onChange={(event) => update({
                  [field.key]: field.key === 'phone' || field.key === 'fax'
                    ? formatPhoneInput(event.target.value)
                    : field.key === 'businessNo'
                      ? formatBusinessNoInput(event.target.value)
                      : event.target.value,
                })}
                placeholder={field.placeholder}
                inputMode={field.key === 'phone' || field.key === 'fax' || field.key === 'businessNo' ? 'numeric' : undefined}
                className="w-full rounded border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              />
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4 dark:border-gray-800">
          <p className="text-xs text-gray-400">입력하면 자동 저장되고, 다음 출력부터 바로 반영됩니다.</p>
          <button
            onClick={() => toast.success('공급자 정보가 저장되어 있습니다')}
            className="flex items-center gap-1.5 rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            <Save size={14} />저장 확인
          </button>
        </div>
      </div>

      <div className="max-w-3xl overflow-hidden rounded border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="bg-blue-50 px-5 py-3 text-sm font-semibold text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">거래명세서 표시 예시</div>
        <div className="grid grid-cols-1 border-t border-blue-700 text-sm text-blue-900 dark:text-blue-200 sm:grid-cols-[80px_1fr]">
          <div className="flex items-center justify-center border-b border-blue-700 bg-blue-50 py-2 font-semibold dark:bg-blue-900/20 sm:border-b-0 sm:border-r sm:py-0">공급자</div>
          <div>
            <div className="grid grid-cols-[90px_1fr] border-b border-blue-700">
              <div className="border-r border-blue-700 bg-blue-50 px-2 py-1 font-semibold dark:bg-blue-900/20">사업번호</div>
              <div className="px-2 py-1 font-semibold">{info.businessNo || DEFAULT_SUPPLIER_INFO.businessNo}</div>
            </div>
            <div className="grid grid-cols-[90px_1fr] border-b border-blue-700">
              <div className="border-r border-blue-700 bg-blue-50 px-2 py-1 font-semibold dark:bg-blue-900/20">상호</div>
              <div className="px-2 py-1">{info.name}</div>
            </div>
            <div className="grid grid-cols-[90px_1fr] border-b border-blue-700 sm:grid-cols-[90px_1fr_80px_1fr]">
              <div className="border-r border-blue-700 bg-blue-50 px-2 py-1 font-semibold dark:bg-blue-900/20">전화번호</div>
              <div className="border-r border-blue-700 px-2 py-1">{info.phone}</div>
              <div className="border-r border-blue-700 bg-blue-50 px-2 py-1 font-semibold dark:bg-blue-900/20">대표자</div>
              <div className="px-2 py-1">{info.ceo}</div>
            </div>
            <div className="grid grid-cols-[90px_1fr]">
              <div className="border-r border-blue-700 bg-blue-50 px-2 py-1 font-semibold dark:bg-blue-900/20">주소</div>
              <div className="px-2 py-1">{info.address}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
