import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const PROJECT_REF = 'rxsrtoehnpshfmqslicm'
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`
const BASE64_PREFIX = 'base64-'
const MAX_CHUNK_SIZE = 3180

// ── Rate limiting ─────────────────────────────────────────────
const RATE_LIMIT_MAX    = 5               // intentos máximos
const RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 minutos en ms
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function getClientIp(req: Request): string {
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  )
}

function checkRateLimit(ip: string): boolean {
  const now   = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// ── Email de alerta de nuevo login ────────────────────────────
function sendLoginAlert(email: string, ip: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const hora = new Date().toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    dateStyle: 'full',
    timeStyle: 'short',
  })

  fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'MiMeta <no-reply@mimeta.app>',
      to: email,
      subject: 'Nuevo inicio de sesión en MiMeta',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#0e7c4a;margin-bottom:4px">MiMeta</h2>
          <p style="color:#374151">Detectamos un nuevo inicio de sesión en tu cuenta.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0">
            <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">Hora</td><td style="padding:8px 0;font-size:14px;font-weight:600">${hora}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;font-size:14px">IP</td><td style="padding:8px 0;font-size:14px;font-weight:600">${ip}</td></tr>
          </table>
          <p style="font-size:13px;color:#6b7280">Si no fuiste tú, <a href="https://mimeta.app/login" style="color:#0e7c4a">cambia tu contraseña</a> de inmediato.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0"/>
          <p style="font-size:12px;color:#9ca3af">© 2026 MiMeta · Este es un correo de seguridad automático.</p>
        </div>
      `,
    }),
  }).catch(() => { /* no bloquear el login si el correo falla */ })
}

// ── Helpers de cookie ─────────────────────────────────────────
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

// ── Handler principal ─────────────────────────────────────────
export async function POST(request: Request) {
  const ip = getClientIp(request)

  // Construir base URL usando X-Forwarded-Host si existe (túnel Cloudflare)
  const forwardedHost  = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const baseUrl = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : new URL(request.url).origin

  // Bloquear si superó el límite de intentos
  if (!checkRateLimit(ip)) {
    const url = new URL('/login', baseUrl)
    url.searchParams.set('error', 'Demasiados intentos fallidos. Espera 15 minutos antes de volver a intentarlo.')
    return NextResponse.redirect(url)
  }

  const form = await request.formData()
  const email    = form.get('email')    as string
  const password = form.get('password') as string
  const next     = (form.get('next')    as string) || '/'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    const url = new URL('/login', baseUrl)
    url.searchParams.set('error', error?.message ?? 'Sin sesión')
    return NextResponse.redirect(url)
  }

  // Login exitoso — notificar al usuario por email (fire-and-forget)
  sendLoginAlert(email, ip)

  const encoded = BASE64_PREFIX + stringToBase64URL(JSON.stringify(data.session))
  const cookies = createChunks(COOKIE_NAME, encoded)

  const response = NextResponse.redirect(new URL(next, baseUrl))
  cookies.forEach(({ name, value }) => response.cookies.set(name, value, COOKIE_OPTS))

  return response
}
