'use client'
import { useEffect, useRef, useState } from 'react'

interface Props {
  onScan:  (barcode: string) => void
  onClose: () => void
}

export function CameraScanner({ onScan, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const [error, setError]           = useState<string | null>(null)
  const [lastScanned, setLastScanned] = useState<string | null>(null)

  useEffect(() => {
    let stopped = false
    let controls: { stop: () => void } | null = null

    async function start() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()

        let lastText = ''
        let lastAt = 0

        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
          videoRef.current!,
          (result) => {
            if (!result || stopped) return
            const text = result.getText()
            const now  = Date.now()
            // 같은 바코드 2초 내 중복 무시
            if (text === lastText && now - lastAt < 2000) return
            lastText = text
            lastAt   = now
            setLastScanned(text)
            onScan(text)
          }
        )
      } catch (err: any) {
        if (!stopped) {
          setError(
            err?.name === 'NotAllowedError'
              ? '카메라 권한을 허용해주세요'
              : '카메라를 사용할 수 없습니다'
          )
        }
      }
    }

    start()

    return () => {
      stopped = true
      controls?.stop()
    }
  }, [onScan])

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold">카메라 스캔</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/20 transition-colors"
          aria-label="닫기"
        >
          닫기
        </button>
      </div>

      {/* 카메라 영역 */}
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-white text-center p-8">
            <div>
              <p className="text-lg font-medium">{error}</p>
              <p className="text-sm text-white/60 mt-2">
                브라우저 설정에서 카메라 권한을 허용한 뒤 다시 시도하세요
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* 비디오 */}
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
              autoPlay
            />
            {/* 어두운 마스크 + 스캔 프레임 */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-72 h-52">
                {/* 코너 마커 */}
                <span className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-brand-400 rounded-tl-lg" />
                <span className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-brand-400 rounded-tr-lg" />
                <span className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-brand-400 rounded-bl-lg" />
                <span className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-brand-400 rounded-br-lg" />
                {/* 스캔 라인 */}
                <span className="absolute left-4 right-4 h-0.5 bg-brand-400/80 animate-scan-line" />
              </div>
            </div>
            <p className="absolute bottom-24 inset-x-0 text-center text-white/70 text-sm">
              바코드를 프레임 안에 위치시키세요
            </p>
          </>
        )}
      </div>

      {/* 인식 결과 */}
      <div className={`px-4 py-3 text-center transition-all shrink-0 ${lastScanned ? 'bg-emerald-700' : 'bg-black'}`}>
        {lastScanned ? (
          <>
            <p className="text-xs text-emerald-200">인식됨</p>
            <p className="text-white font-mono font-semibold mt-0.5 truncate">{lastScanned}</p>
          </>
        ) : (
          <p className="text-white/40 text-sm">스캔 대기 중...</p>
        )}
      </div>
    </div>
  )
}
