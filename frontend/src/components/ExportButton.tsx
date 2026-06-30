'use client'
import { useState } from 'react'
import { Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { datedExcelFilename, writeRowsToExcel } from '@/utils/excel'

interface Props {
  filename: string
  getData: () => Promise<Record<string, unknown>[]> | Record<string, unknown>[]
  label?: string
  disabled?: boolean
}

export function ExportButton({ filename, getData, label = '내보내기', disabled = false }: Props) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const rows = await getData()
      if (!rows.length) {
        toast.error('내보낼 데이터가 없습니다')
        return
      }
      await writeRowsToExcel(rows, datedExcelFilename(filename))
    } catch {
      toast.error('내보내기 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading || disabled}
      title={loading ? '내보내기 준비 중' : label}
      aria-label={loading ? '내보내기 준비 중' : label}
      className="responsive-icon-action bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      <Download size={15} aria-hidden="true" />
      <span className="responsive-action-label">{loading ? '준비 중...' : label}</span>
    </button>
  )
}
