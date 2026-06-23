'use client'
import { useState } from 'react'
import toast from 'react-hot-toast'

interface Props {
  filename: string
  getData: () => Promise<Record<string, unknown>[]> | Record<string, unknown>[]
  label?: string
}

export function ExportButton({ filename, getData, label = '엑셀' }: Props) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const rows = await getData()
      if (!rows.length) {
        toast.error('내보낼 데이터가 없습니다')
        return
      }
      const XLSX = await import('xlsx')
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
      const date = new Date().toISOString().slice(0, 10)
      XLSX.writeFile(wb, `${filename}_${date}.xlsx`)
    } catch {
      toast.error('내보내기 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      title={loading ? '내보내기 준비 중' : label}
      aria-label={loading ? '내보내기 준비 중' : label}
      className="responsive-icon-action bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      <span className="responsive-action-label">{loading ? '준비 중...' : label}</span>
    </button>
  )
}
