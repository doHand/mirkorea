'use client'

import { useEffect } from 'react'

const MIN_COLUMN_WIDTH = 48

function getColumnCells(table: HTMLTableElement, columnIndex: number) {
  return Array.from(table.rows)
    .map((row) => row.cells[columnIndex])
    .filter(Boolean) as HTMLTableCellElement[]
}

function makeResizable(table: HTMLTableElement) {
  if (table.classList.contains('wms-no-resize')) {
    table.querySelectorAll('thead th > span.wms-column-resizer').forEach((handle) => handle.remove())
    table.querySelectorAll('thead th[data-resize-handle]').forEach((cell) => {
      delete (cell as HTMLElement).dataset.resizeHandle
    })
    delete table.dataset.resizableTable
    return
  }
  if (table.dataset.resizableTable === 'true') return

  const headerRow = table.tHead?.rows[0] ?? table.querySelector('tr')
  if (!headerRow) return

  table.dataset.resizableTable = 'true'
  table.classList.add('wms-resizable-table')

  Array.from(headerRow.cells).forEach((headerCell, columnIndex) => {
    if (headerCell.dataset.resizeHandle === 'true') return

    headerCell.dataset.resizeHandle = 'true'
    headerCell.classList.add('wms-resizable-th')

    const handle = document.createElement('span')
    handle.className = 'wms-column-resizer'
    handle.setAttribute('aria-hidden', 'true')
    headerCell.appendChild(handle)

    handle.addEventListener('pointerdown', (event) => {
      if (headerCell.offsetParent === null) return

      event.preventDefault()
      event.stopPropagation()
      handle.setPointerCapture(event.pointerId)

      const startX = event.clientX
      const startWidth = headerCell.getBoundingClientRect().width
      const cells = getColumnCells(table, columnIndex)

      document.body.classList.add('wms-column-resizing')
      table.classList.add('wms-resizing-active')

      const onPointerMove = (moveEvent: PointerEvent) => {
        const nextWidth = Math.max(MIN_COLUMN_WIDTH, startWidth + moveEvent.clientX - startX)

        cells.forEach((cell) => {
          cell.style.width = `${nextWidth}px`
          cell.style.minWidth = `${nextWidth}px`
        })
      }

      const stopResize = () => {
        document.body.classList.remove('wms-column-resizing')
        table.classList.remove('wms-resizing-active')
        handle.removeEventListener('pointermove', onPointerMove)
        handle.removeEventListener('pointerup', stopResize)
        handle.removeEventListener('pointercancel', stopResize)
      }

      handle.addEventListener('pointermove', onPointerMove)
      handle.addEventListener('pointerup', stopResize)
      handle.addEventListener('pointercancel', stopResize)
    })
  })
}

export function ResizableTables() {
  useEffect(() => {
    const refreshTables = () => {
      document.querySelectorAll<HTMLTableElement>('table').forEach(makeResizable)
    }

    refreshTables()

    const observer = new MutationObserver(refreshTables)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [])

  return null
}
