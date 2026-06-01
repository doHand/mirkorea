import { useRef, useEffect, useCallback } from 'react'

interface UseBarcodeScanner {
  inputRef: React.RefObject<HTMLInputElement>
  onScan:   (barcode: string) => void
  debounceMs?: number
}

export function useBarcodeScanner({ inputRef, onScan, debounceMs = 100 }: UseBarcodeScanner) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 화면이 클릭되어도 스캔 입력창 포커스 유지
  useEffect(() => {
    const keepFocus = () => {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
    document.addEventListener('click', keepFocus)
    inputRef.current?.focus()
    return () => document.removeEventListener('click', keepFocus)
  }, [inputRef])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return
      e.preventDefault()

      const value = inputRef.current?.value.trim()
      if (!value) return

      // debounce: 빠른 스캔 중복 방지
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        onScan(value)
        if (inputRef.current) inputRef.current.value = ''
      }, debounceMs)
    },
    [inputRef, onScan, debounceMs]
  )

  return { handleKeyDown }
}
