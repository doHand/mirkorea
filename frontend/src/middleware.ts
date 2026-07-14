import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis/cloudflare'

const ratelimit =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.slidingWindow(10, '60 s'),
        prefix: 'wms:rl:auth',
      })
    : null

function getClientIp(req: NextRequest): string {
  return req.ip ?? '127.0.0.1'
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rate limit auth endpoints
  if (pathname.startsWith('/api/v1/auth/') && ratelimit) {
    const ip = getClientIp(request)
    const { success, limit, remaining, reset } = await ratelimit.limit(ip)

    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000)
      return NextResponse.json(
        { code: 'TOO_MANY_REQUESTS', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        {
          status: 429,
          headers: {
            'Retry-After':           String(retryAfter),
            'X-RateLimit-Limit':     String(limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset':     String(reset),
          },
        }
      )
    }
  }

  // wms_at 쿠키 → Authorization Bearer 헤더 변환 (Spring Boot 백엔드에 전달)
  const accessToken = request.cookies.get('wms_at')?.value
  if (accessToken) {
    const headers = new Headers(request.headers)
    headers.set('Authorization', `Bearer ${accessToken}`)
    return NextResponse.next({ request: { headers } })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/v1/:path*'],
}
