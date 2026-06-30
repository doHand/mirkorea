import toast from 'react-hot-toast'

const POPUP_BLOCKED_MESSAGE = '팝업 차단을 해제해주세요'

export function openBlankPrintWindow(features = 'width=900,height=1100') {
  const win = window.open('', '_blank', features)
  if (!win) toast.error(POPUP_BLOCKED_MESSAGE)
  return win
}

export function writePrintHtml(html: string, targetWindow?: Window | null) {
  if (!targetWindow) return false
  targetWindow.document.write(html)
  targetWindow.document.close()
  return true
}

export function openPrintHtmlBlob(html: string, features = 'width=820,height=1060') {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank', features)
  if (!win) {
    URL.revokeObjectURL(url)
    toast.error(POPUP_BLOCKED_MESSAGE)
    return null
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return win
}
