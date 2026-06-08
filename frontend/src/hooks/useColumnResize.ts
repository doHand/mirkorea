import { useCallback, useMemo, useRef, useState } from 'react'

export type ColDef = { width: number; minWidth?: number; sticky?: boolean }
export type ColWidths = Record<string, number>

export function useColumnResize(
  key: string,
  initialCols: Record<string, ColDef>,
) {
  const storageKey = `col-widths:${key}`

  const defaults = useMemo(
    () => Object.fromEntries(Object.entries(initialCols).map(([k, v]) => [k, v.width])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const [widths, setWidths] = useState<ColWidths>(() => {
    try {
      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 767
      if (isMobile) {
        return Object.fromEntries(Object.entries(initialCols).map(([k, v]) => [k, v.width]))
      }
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}')
      const result: ColWidths = {}
      for (const col of Object.keys(initialCols)) {
        result[col] = saved[col] ?? initialCols[col].width
      }
      return result
    } catch {
      return Object.fromEntries(
        Object.entries(initialCols).map(([k, v]) => [k, v.width]),
      )
    }
  })

  const resizingRef = useRef(false)

  const startResize = useCallback(
    (col: string, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      resizingRef.current = true
      const startX   = e.clientX
      const startW   = widths[col]
      const minWidth = initialCols[col]?.minWidth ?? 50

      const onMove = (ev: MouseEvent) => {
        const newW = Math.max(minWidth, startW + (ev.clientX - startX))
        setWidths((prev) => {
          const next = { ...prev, [col]: newW }
          try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
          return next
        })
      }

      const onUp = () => {
        resizingRef.current = false
        document.documentElement.classList.remove('wms-column-resizing')
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      document.documentElement.classList.add('wms-column-resizing')
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [widths, initialCols, storageKey],
  )

  const stickyLeftOf = useCallback(
    (col: string): number => {
      const stickyKeys = Object.entries(initialCols)
        .filter(([, v]) => v.sticky)
        .map(([k]) => k)
      let offset = 0
      for (const k of stickyKeys) {
        if (k === col) return offset
        offset += widths[k] ?? initialCols[k].width
      }
      return offset
    },
    [widths, initialCols],
  )

  const totalWidth = useMemo(
    () => Object.values(widths).reduce((s, w) => s + w, 0),
    [widths],
  )

  const resetWidths = useCallback(() => {
    try { localStorage.removeItem(storageKey) } catch {}
    setWidths(defaults)
  }, [defaults, storageKey])

  return { widths, startResize, stickyLeftOf, totalWidth, resetWidths }
}
