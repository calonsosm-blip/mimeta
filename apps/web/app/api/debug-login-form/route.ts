import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const form = await request.formData()
  const email = form.get('email') as string
  const password = form.get('password') as string

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  const html = error
    ? `<h2 style="color:red">ERROR</h2><pre>${error.message}\nCódigo: ${error.status}</pre>`
    : `<h2 style="color:green">LOGIN OK</h2><pre>Usuario: ${data.user?.email}\nSesión activa: ${!!data.session}</pre>`

  return new NextResponse(`<!DOCTYPE html><html><body style="font-family:monospace;padding:40px">${html}<br><a href="/debug-login">← Volver</a></body></html>`, {
    headers: { 'Content-Type': 'text/html' },
  })
}
