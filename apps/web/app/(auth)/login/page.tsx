'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'

type Mode = 'magic' | 'password' | 'register'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode]         = useState<Mode>('password')
  const [loading, setLoading]   = useState(false)
  const [sent, setSent]         = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const supabase = createClient()

  // Mostrar errores que vienen del redirect del route handler
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get('error')
    if (err) setError(decodeURIComponent(err))
  }, [])

  async function handleSubmitJs(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'magic') {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) setError(error.message)
      else setSent(true)

    } else if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) setError(error.message)
      else setSent(true)
    }

    setLoading(false)
  }

  const inputClass = 'w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors'

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted px-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <Image src="/mimeta-isotipo.png" alt="MiMeta" width={56} height={56} className="mx-auto object-contain" />
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-6">
            <p className="font-semibold text-emerald-800 dark:text-emerald-300">¡Revisa tu correo!</p>
            <p className="mt-1.5 text-sm text-emerald-700 dark:text-emerald-400">
              {mode === 'magic'
                ? <>Te enviamos un enlace de acceso a <strong>{email}</strong>.</>
                : <>Te enviamos un email de confirmación a <strong>{email}</strong>. Confírmalo y luego inicia sesión con contraseña.</>
              }
            </p>
          </div>
          <button onClick={() => { setSent(false); setMode('password') }} className="text-sm text-primary hover:underline">
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex bg-muted">
      {/* Panel izquierdo — branding */}
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between bg-foreground p-12">
        <div className="flex items-center gap-3">
          <Image src="/mimeta-isotipo.png" alt="MiMeta" width={36} height={36} className="object-contain" />
          <div>
            <p className="text-sm font-bold text-background leading-tight">MiMeta</p>
            <p className="text-xs text-background/50 leading-tight">tu dinero, tus metas</p>
          </div>
        </div>
        <div className="space-y-6">
          <h2 className="text-3xl font-extrabold text-background leading-snug">
            Toma el control<br />de tus finanzas<br />personales
          </h2>
          <p className="text-sm text-background/60 leading-relaxed max-w-xs">
            Registra ingresos y gastos, planifica tu presupuesto y alcanza tus metas de ahorro — todo en un solo lugar.
          </p>
          <div className="space-y-3">
            {['Dashboard con termómetro de fin de mes', 'Metas de ahorro automáticas', 'Alertas de pagos recurrentes', 'Análisis con inteligencia artificial'].map(f => (
              <div key={f} className="flex items-center gap-2.5">
                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-xs text-background/70">{f}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-background/30">© 2026 MiMeta · Tu dinero, tus metas, tu futuro</p>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-7">

          {/* Logo mobile */}
          <div className="flex lg:hidden items-center gap-3 justify-center">
            <Image src="/mimeta-isotipo.png" alt="MiMeta" width={36} height={36} className="object-contain" />
            <div>
              <p className="text-sm font-bold text-foreground leading-tight">MiMeta</p>
              <p className="text-xs text-muted-foreground leading-tight">tu dinero, tus metas</p>
            </div>
          </div>

          <div>
            <h1 className="text-xl font-extrabold text-foreground">
              {mode === 'register' ? 'Crea tu cuenta' : 'Bienvenido de vuelta'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === 'register' ? 'Empieza gratis, sin tarjeta de crédito' : 'Ingresa a tu cuenta para continuar'}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl border border-border bg-card overflow-hidden text-xs font-semibold">
            {(['password', 'magic', 'register'] as Mode[]).map(m => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(null) }}
                className={`flex-1 py-2.5 transition-colors ${mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                {m === 'password' ? 'Contraseña' : m === 'magic' ? 'Magic link' : 'Registrarse'}
              </button>
            ))}
          </div>

          {/* Formulario contraseña — HTML nativo, no requiere JS */}
          {mode === 'password' && (
            <form action="/api/auth/signin" method="POST" className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-xs font-semibold text-foreground/80">Correo electrónico</label>
                <input id="email" name="email" type="email" required placeholder="tu@correo.com" className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-semibold text-foreground/80">Contraseña</label>
                <input id="password" name="password" type="password" required placeholder="········" minLength={6} className={inputClass} />
              </div>
              {error && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}
              <button type="submit" className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
                Ingresar
              </button>
            </form>
          )}

          {/* Formularios magic / register — requieren JS */}
          {mode !== 'password' && (
            <form onSubmit={handleSubmitJs} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="email2" className="text-xs font-semibold text-foreground/80">Correo electrónico</label>
                <input id="email2" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com" className={inputClass} />
              </div>
              {mode === 'register' && (
                <div className="space-y-1.5">
                  <label htmlFor="password2" className="text-xs font-semibold text-foreground/80">Contraseña</label>
                  <input id="password2" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="········" minLength={6} className={inputClass} />
                  <p className="text-[11px] text-muted-foreground">Mínimo 6 caracteres</p>
                </div>
              )}
              {mode === 'magic' && (
                <p className="text-xs text-muted-foreground bg-muted rounded-xl px-3 py-2.5">
                  Te enviamos un enlace al correo. Sin contraseña, sin complicaciones.
                </p>
              )}
              {error && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}
              <button type="submit" disabled={loading}
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {loading ? 'Cargando...' : mode === 'magic' ? 'Enviar enlace de acceso' : 'Crear cuenta'}
              </button>
            </form>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Al ingresar aceptas nuestra{' '}
            <Link href="/privacy" className="text-primary hover:underline">política de privacidad</Link>
            {' · '}
            <Link href="/pricing" className="text-primary hover:underline">Ver planes</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
