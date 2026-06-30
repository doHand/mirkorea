export type ExcelRow = Record<string, unknown>

export async function readFirstSheetRows<T extends ExcelRow = Record<string, string | number>>(
  file: File,
): Promise<T[]> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json<T>(sheet, { defval: '' })
}

export async function writeRowsToExcel(
  rows: ExcelRow[],
  filename: string,
  sheetName = 'Sheet1',
) {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
  XLSX.writeFile(workbook, filename)
}

export function datedExcelFilename(prefix: string, date = new Date()) {
  return `${prefix}_${date.toISOString().slice(0, 10)}.xlsx`
}
