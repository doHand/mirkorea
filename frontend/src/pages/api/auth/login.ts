import type { NextApiRequest, NextApiResponse } from 'next'

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
const IS_PROD = process.env.NODE_ENV === 'production'

// POST /api/auth/login
// Spring Boot 로그인 엔드포인트를 중계하고 토큰을 httpOnly 쿠키로 설정
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const upstream = await fetch(`${BACKEND}/api/v1/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(req.body),
    })

    const data = await upstream.json()

    if (!upstream.ok) {
      return res.status(upstream.status).json(data)
    }

    const { accessToken, refreshToken, user } = data.data ?? {}

    if (accessToken && refreshToken) {
      // accessToken: 단기 (1시간) httpOnly 쿠키
      res.setHeader('Set-Cookie', [
        `wms_at=${accessToken}; HttpOnly; Path=/; SameSite=Strict; Max-Age=3600${IS_PROD ? '; Secure' : ''}`,
        `wms_rt=${refreshToken}; HttpOnly; Path=/api/auth/refresh; SameSite=Strict; Max-Age=604800${IS_PROD ? '; Secure' : ''}`,
      ])
    }

    // 토큰은 쿠키로만 전달, 응답 바디에는 사용자 정보만
    return res.status(200).json({ success: true, data: { user } })
  } catch {
    return res.status(502).json({ success: false, message: '서버 연결 오류' })
  }
}
