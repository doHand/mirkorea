import type { NextApiRequest, NextApiResponse } from 'next'

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const IS_PROD = process.env.NODE_ENV === 'production'

// POST /api/auth/refresh — wms_rt 쿠키로 Spring Boot 재발급 후 새 쿠키 설정
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const refreshToken = req.cookies['wms_rt']
  if (!refreshToken) return res.status(401).json({ success: false, message: '인증이 필요합니다' })

  try {
    const upstream = await fetch(`${BACKEND}/api/v1/auth/refresh`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refreshToken }),
    })

    const data = await upstream.json()

    if (!upstream.ok) {
      // 리프레시 실패 시 쿠키도 삭제
      res.setHeader('Set-Cookie', [
        `wms_at=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${IS_PROD ? '; Secure' : ''}`,
        `wms_rt=; HttpOnly; Path=/api/auth/refresh; SameSite=Strict; Max-Age=0${IS_PROD ? '; Secure' : ''}`,
      ])
      return res.status(401).json({ success: false })
    }

    const { accessToken, refreshToken: newRefreshToken } = data.data ?? {}

    res.setHeader('Set-Cookie', [
      `wms_at=${accessToken}; HttpOnly; Path=/; SameSite=Strict; Max-Age=3600${IS_PROD ? '; Secure' : ''}`,
      `wms_rt=${newRefreshToken}; HttpOnly; Path=/api/auth/refresh; SameSite=Strict; Max-Age=604800${IS_PROD ? '; Secure' : ''}`,
    ])
    return res.status(200).json({ success: true })
  } catch {
    return res.status(502).json({ success: false, message: '서버 연결 오류' })
  }
}
