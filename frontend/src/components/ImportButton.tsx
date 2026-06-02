'use client'
import { useRef, useState } from 'react'
import { Upload, X, AlertCircle, Loader2, FileSpreadsheet, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/utils/cn'
import type { SaleStatus } from '@/types/api.types'

interface ImportRow {
  code: string
  name: string
  category?: string
  brand?: string
  unit: string
  boxQty: number
  safetyStock: number
  reorderPoint: number
  costPrice?: number
  sellPrice?: number
  saleStatus: SaleStatus
  _error?: string
}

const STATUS_MAP: Record<string, SaleStatus> = {
  '판매중': 'ACTIVE',  '활성': 'ACTIVE',  ACTIVE: 'ACTIVE',
  '비활성': 'INACTIVE', INACTIVE: 'INACTIVE',
  '단종': 'DISCONTINUED', DISCONTINUED: 'DISCONTINUED',
}

interface Props {
  onImported?: () => void
}

export function ImportButton({ onImported }: Props) {
  const fileRef   = useRef<HTMLInputElement>(null)
  const [preview,   setPreview]   = useState<ImportRow[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [progress,  setProgress]  = useState(0)

  const parseExcel = async (file: File): Promise<ImportRow[]> => {
    const XLSX = await import('xlsx')
    const buf  = await file.arrayBuffer()
    const wb   = XLSX.read(buf, { type: 'array' })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const raw  = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws, { defval: '' })

    return raw.map((row) => {
      const str = (keys: string[]) => {
        for (const k of keys) {
          const v = row[k]
          if (v !== undefined && v !== '') return String(v)
        }
        return undefined
      }
      const num = (keys: string[]) => {
        const v = str(keys)
        const n = Number(v)
        return v !== undefined && !isNaN(n) ? n : undefined
      }

      const code      = str(['상품코드', 'code']) ?? ''
      const name      = str(['상품명',   'name']) ?? ''
      const statusRaw = str(['상태', 'saleStatus']) ?? 'ACTIVE'

      return {
        code,
        name,
        category:     str(['카테고리', 'category']),
        brand:        str(['브랜드',   'brand']),
        unit:         str(['단위',     'unit']) ?? 'EA',
        boxQty:       num(['박스입수', 'boxQty'])    ?? 1,
        safetyStock:  num(['안전재고', 'safetyStock']) ?? 0,
        reorderPoint: num(['재주문점', 'reorderPoint']) ?? 0,
        costPrice:    num(['원가',     'costPrice']),
        sellPrice:    num(['판매가',   'sellPrice']),
        saleStatus:   STATUS_MAP[statusRaw] ?? 'ACTIVE',
        _error: !code || !name ? '코드/명 필수' : undefined,
      }
    })
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const rows = await parseExcel(file)
      if (!rows.length) { toast.error('데이터가 없습니다'); return }
      setPreview(rows)
    } catch {
      toast.error('파일 파싱 실패 — Excel/CSV 형식인지 확인하세요')
    } finally {
      e.target.value = ''
    }
  }

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    const tpl = [{
      상품코드: 'PRD-001', 상품명: '샘플상품', 카테고리: '전자',
      브랜드: 'ACME', 단위: 'EA', 박스입수: 12,
      안전재고: 10, 재주문점: 5, 원가: 5000, 판매가: 8000, 상태: '판매중',
    }]
    const ws = XLSX.utils.json_to_sheet(tpl)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '상품')
    XLSX.writeFile(wb, '상품등록_템플릿.xlsx')
  }

  const handleImport = async () => {
    if (!preview) return
    const valid = preview.filter((r) => !r._error)
    if (!valid.length) { toast.error('가져올 항목이 없습니다'); return }

    setImporting(true)
    setProgress(0)
    const { productApi } = await import('@/api/product.api')
    let ok = 0, fail = 0

    for (let i = 0; i < valid.length; i++) {
      try {
        await productApi.create(valid[i])
        ok++
      } catch {
        fail++
      }
      setProgress(Math.round(((i + 1) / valid.length) * 100))
    }

    setImporting(false)
    if (ok > 0)   toast.success(`${ok}개 등록 완료`)
    if (fail > 0) toast.error(`${fail}개 실패 (중복 코드 등)`)
    setPreview(null)
    onImported?.()
  }

  const validCount = preview?.filter((r) => !r._error).length ?? 0
  const errorCount = preview?.filter((r) =>  r._error).length ?? 0

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFile}
      />

      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition-colors font-medium"
      >
        <Upload size={14} />
        가져오기
      </button>

      {preview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-gray-200 dark:border-gray-700">

            {/* 헤더 */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center shrink-0">
                  <FileSpreadsheet size={18} className="text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">엑셀 가져오기</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {preview.length}행 파싱 ·{' '}
                    <span className="text-emerald-600 dark:text-emerald-400">정상 {validCount}건</span>
                    {errorCount > 0 && <span className="text-red-500"> · 오류 {errorCount}건</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <Download size={12} />
                  템플릿
                </button>
                <button
                  onClick={() => { setPreview(null) }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* 테이블 */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    {['#','코드','상품명','카테고리','원가','판매가','확인'].map((h) => (
                      <th key={h} className={cn(
                        'px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400',
                        h === '#' ? 'text-left w-10' :
                        h === '확인' ? 'text-center' :
                        ['원가','판매가'].includes(h) ? 'text-right' : 'text-left'
                      )}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {preview.map((row, i) => (
                    <tr
                      key={i}
                      className={cn(
                        'transition-colors',
                        row._error
                          ? 'bg-red-50 dark:bg-red-900/10'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      )}
                    >
                      <td className="px-4 py-2 text-gray-400 tabular-nums">{i + 1}</td>
                      <td className="px-4 py-2 font-mono text-gray-700 dark:text-gray-300">
                        {row.code || <span className="text-red-500 font-sans">없음</span>}
                      </td>
                      <td className="px-4 py-2 text-gray-900 dark:text-gray-100 font-medium">
                        {row.name || <span className="text-red-500">없음</span>}
                      </td>
                      <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{row.category || '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {row.costPrice != null ? `₩${row.costPrice.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {row.sellPrice != null ? `₩${row.sellPrice.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {row._error ? (
                          <span className="inline-flex items-center gap-1 text-red-500">
                            <AlertCircle size={11} />{row._error}
                          </span>
                        ) : (
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 진행바 */}
            {importing && (
              <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                  <span>등록 중...</span><span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-violet-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* 푸터 */}
            <div className="flex gap-3 px-5 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setPreview(null)}
                className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {importing
                  ? <><Loader2 size={14} className="animate-spin" />가져오는 중...</>
                  : `${validCount}개 등록`
                }
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}
