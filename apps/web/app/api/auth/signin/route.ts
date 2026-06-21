import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const PROJECT_REF = 'rxsrtoehnpshfmqslicm'
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`
const BASE64_PREFIX = 'base64-'
const MAX_CHUNK_SIZE = 3180

function stringToBase64URL(str: string): string {
  const TO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.split('')
  const bytes = Buffer.from(str, 'utf8')
  const result: string[] = []
  let queue = 0; let queuedBits = 0
  for (const byte of bytes) {
    queue = (queue << 8) | byte; queuedBits += 8
    while (queuedBits >= 6) { result.push(TO[(queue >> (queuedBits - 6)) & 63]); queuedBits -= 6 }
  }
  if (queuedBits > 0) { queue = queue << (6 - queuedBits); result.push(TO[(queue >> 0) & 63]) }
  return result.join('')
}

function createChunks(key: string, value: string): { name: string; value: string }[] {
  const encoded = encodeURIComponent(value)
  if (encoded.length <= MAX_CHUNK_SIZE) return [{ name: key, value }]
  const chunks: string[] = []
  let remaining = encoded
  while (remaining.length > 0) {
    let head = remaining.slice(0, MAX_CHUNK_SIZE)
    const lastEscape = head.lastIndexOf('%')
    if (lastEscape > MAX_CHUNK_SIZE - 3) head = head.slice(0, lastEscape)
    chunks.push(decodeURIComponent(head))
    remaining = remaining.slice(head.length)
  }
  return chunks.map((v, i) => ({ name: `${key}.${i}`, value: v }))
}

const COOKIE_OPTS = { path: '/', sameSite: 'lax' as const, httpOnly: false, maxAge: 400 * 24 * 60 * 60 }

export async function POST(request: Request) {
  const form = await request.formData()
  const email    = form.get('email')    as string
  const password = form.get('password') as string
  const next     = (form.get('next')    as string) || '/'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  // Construir base URL usando X-Forwarded-Host si existe (túnel Cloudflare)
  const forwardedHost  = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const baseUrl = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : new URL(request.url).origin

  if (error || !data.session) {
    const url = new URL('/login', baseUrl)
    url.searchParams.set('error', error?.message ?? 'Sin sesión')
    return NextResponse.redirect(url)
  }

  const encoded = BASE64_PREFIX + stringToBase64URL(JSON.stringify(data.session))
  const cookies = createChunks(COOKIE_NAME, encoded)

  const response = NextResponse.redirect(new URL(next, baseUrl))
  cookies.forEach(({ name, value }) => response.cookies.set(name, value, COOKIE_OPTS))

  return response
}
