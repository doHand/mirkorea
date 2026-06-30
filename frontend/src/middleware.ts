import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Upstash 환경변수가 없으면 null (Rate Limit 비활성화)
const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        // 1분 슬라이딩 윈도우 기준 IP당 최대 10회
        limiter: Ratelimit.slidingWindow(10, '60 s'),
        prefix: 'wms:rl:auth',
      })
    : null

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return req.ip ?? '127.0.0.1'
}

export async function middleware(request: NextRequest) {
  if (!ratelimit) return NextResponse.next()

  const ip = getClientIp(request)
  const { success, limit, remaining, reset } = await ratelimit.limit(ip)

  if (!success) {
    const retryAfter = Math.ceil((reset - Date.now()) / 1000)
    return NextResponse.json(
      { code: 'TOO_MANY_REQUESTS', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
      {
        status: 429,
        headers: {
          'Retry-After':          String(retryAfter),
          'X-RateLimit-Limit':    String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset':    String(reset),
        },
      }
    )
  }

  const res = NextResponse.next()
  res.headers.set('X-RateLimit-Limit',     String(limit))
  res.headers.set('X-RateLimit-Remaining', String(remaining))
  res.headers.set('X-RateLimit-Reset',     String(reset))
  return res
}

export const config = {
  // 인증 관련 API 엔드포인트에만 적용
  matcher: ['/api/v1/auth/:path*'],
}
