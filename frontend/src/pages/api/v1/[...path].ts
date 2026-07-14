import type { NextApiRequest, NextApiResponse } from 'next'
import { Readable } from 'stream'

export const config = {
  api: {
    bodyParser: false,
  },
}

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'host',
  'keep-alive',
  'origin',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

function readBody(req: NextApiRequest): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') return Promise.resolve(undefined)

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    req.on('end', () => resolve(chunks.length ? Buffer.concat(chunks) : undefined))
    req.on('error', reject)
  })
}

function buildHeaders(req: NextApiRequest) {
  const headers = new Headers()

  for (const [key, value] of Object.entries(req.headers)) {
    const lowerKey = key.toLowerCase()
    if (HOP_BY_HOP_HEADERS.has(lowerKey) || lowerKey === 'cookie') continue
    if (Array.isArray(value)) {
      headers.set(key, value.join(', '))
    } else if (value !== undefined) {
      headers.set(key, value)
    }
  }

  return headers
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const target = new URL(req.url || '/api/v1', BACKEND)

  try {
    const requestBody = await readBody(req)
    const upstream = await fetch(target, {
      method: req.method,
      headers: buildHeaders(req),
      body: requestBody as BodyInit | undefined,
      redirect: 'manual',
    })

    res.statusCode = upstream.status
    upstream.headers.forEach((value, key) => {
      if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
        res.setHeader(key, value)
      }
    })

    if (!upstream.body) {
      res.end()
      return
    }

    if (upstream.headers.get('content-type')?.includes('text/event-stream')) {
      Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res)
      return
    }

    const body = Buffer.from(await upstream.arrayBuffer())
    res.end(body)
  } catch {
    res.status(502).json({ success: false, message: 'Server connection error' })
  }
}
