'use client'
import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { cn } from '@/utils/cn'
import { formatNumber } from '@/utils/format'

export type ImportRow = Record<string, unknown> & { _error?: string }

export interface ImportConfig {
  templateFilename: string
  templateRows: Record<string, unknown>[]
  sheetName?: string
  parse: (raw: Record<string, string | number>[]) => ImportRow[]
  previewColumns: Array<{
    key: string
    label: string
    align?: 'left' | 'right' | 'center'
    mono?: boolean
    format?: (value: unknown) => React.ReactNode
  }>
  save: (validRows: ImportRow[], setProgress: (pct: number) => void) => Promise<{ ok: number; fail: number }>
}

interface Props {
  config: ImportConfig
  onImported?: () => void
  label?: string
  className?: string
  labelClassName?: string
}

export function ImportButton({ config, onImported, label = '가져오기', className, labelClassName }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportRow[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  useEscapeKey(() => setPreview(null), !!preview && !importing)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws, { defval: '' })
      const rows = config.parse(raw)
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
    const ws = XLSX.utils.json_to_sheet(config.templateRows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, config.sheetName ?? '데이터')
    XLSX.writeFile(wb, config.templateFilename)
  }

  const handleImport = async () => {
    if (!preview) return
    const valid = preview.filter(r => !r._error)
    if (!valid.length) { toast.error('가져올 항목이 없습니다'); return }
    setImporting(true)
    setProgress(0)
    try {
      const { ok, fail } = await config.save(valid, setProgress)
      if (ok > 0) toast.success(`${ok}개 등록 완료`)
      if (fail > 0) toast.error(`${fail}개 실패 (중복 코드 등)`)
      setPreview(null)
      onImported?.()
    } finally {
      setImporting(false)
    }
  }

  const validCount = preview?.filter(r => !r._error).length ?? 0
  const errorCount = preview?.filter(r => r._error).length ?? 0

  return (
    <>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />

      <button
        onClick={() => fileRef.current?.click()}
        title={label}
        aria-label={label}
        className={className ?? 'responsive-icon-action bg-accent-500 text-white hover:bg-accent-600'}
      >
        <Upload size={15} aria-hidden="true" />
        <span className={labelClassName ?? 'responsive-action-label'}>{label}</span>
      </button>

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-none p-4">
          <div className="flex w-full max-w-3xl max-h-[85vh] flex-col overflow-hidden rounded border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            {/* 헤더 */}
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent-100 dark:bg-accent-900/30" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">엑셀 가져오기</h3>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {formatNumber(preview.length)}행 파싱 ·{' '}
                    <span className="text-emerald-600 dark:text-emerald-400">정상 {formatNumber(validCount)}건</span>
                    {errorCount > 0 && <span className="text-red-500"> · 오류 {formatNumber(errorCount)}건</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={downloadTemplate}
                  className="rounded-lg px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                >
                  템플릿
                </button>
                <button
                  onClick={() => setPreview(null)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  닫기
                </button>
              </div>
            </div>

            {/* 테이블 */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
                    <th className="w-10 px-4 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">#</th>
                    {config.previewColumns.map(col => (
                      <th
                        key={col.key}
                        className={cn(
                          'px-4 py-2.5 font-medium text-gray-500 dark:text-gray-400',
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                        )}
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-center font-medium text-gray-500 dark:text-gray-400">확인</th>
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
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                      )}
                    >
                      <td className="px-4 py-2 text-right tabular-nums text-gray-400">{formatNumber(i + 1)}</td>
                      {config.previewColumns.map(col => (
                        <td
                          key={col.key}
                          className={cn(
                            'px-4 py-2',
                            col.mono ? 'font-mono text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-gray-100',
                            col.align === 'right' ? 'text-right tabular-nums' : col.align === 'center' ? 'text-center' : '',
                          )}
                        >
                          {col.format
                            ? col.format(row[col.key])
                            : (row[col.key] as string | number | undefined) ?? '—'}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-center">
                        {row._error ? (
                          <span className="inline-flex items-center gap-1 text-red-500">! {row._error as string}</span>
                        ) : (
                          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 진행바 */}
            {importing && (
              <div className="border-t border-gray-200 px-5 py-3 dark:border-gray-700">
                <div className="mb-1.5 flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>등록 중...</span><span>{progress}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
                  <div className="h-1.5 rounded-full bg-accent-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            {/* 푸터 */}
            <div className="flex gap-3 border-t border-gray-200 px-5 py-4 dark:border-gray-700">
              <button
                onClick={() => setPreview(null)}
                className="flex-1 rounded border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                취소
              </button>
              <button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="flex-1 rounded-md bg-accent-500 py-2.5 text-sm font-semibold text-white hover:bg-accent-600 disabled:opacity-50"
              >
                {importing ? '가져오는 중...' : `${formatNumber(validCount)}개 등록`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
