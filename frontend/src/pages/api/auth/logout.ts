import type { NextApiRequest, NextApiResponse } from 'next'

const IS_PROD = process.env.NODE_ENV === 'production'

// POST /api/auth/logout — 쿠키 만료 처리
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  res.setHeader('Set-Cookie', [
    `wms_at=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${IS_PROD ? '; Secure' : ''}`,
    `wms_rt=; HttpOnly; Path=/api/auth/refresh; SameSite=Strict; Max-Age=0${IS_PROD ? '; Secure' : ''}`,
  ])
  return res.status(200).json({ success: true })
}
