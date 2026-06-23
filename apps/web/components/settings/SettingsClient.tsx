'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { setAccentTheme, getAccentTheme } from '@/components/providers/ThemeProvider'
import { Sun, Moon, LogOut, Crown } from 'lucide-react'

interface Props {
  profile: { display_name: string | null; base_currency: string; plan: string } | null
  userId: string
}

const ACCENT_OPTIONS = [
  { key: 'mimeta',   label: 'MiMeta',   color: '#0e7c4a', badge: ''    },
  { key: 'midnight', label: 'Midnight', color: '#14b8a6', badge: 'Premium' },
  { key: 'oro',      label: 'Oro',      color: '#d4af37', badge: 'Premium' },
  { key: 'carbon',   label: '🔥 Carbón', color: '#EA580C', badge: 'Premium' },
  { key: 'oceano',   label: '🌊 Océano', color: '#0E7490', badge: 'Premium' },
  { key: 'aurora',   label: '✦ Aurora', color: '#7C3AED', badge: 'Premium' },
  { key: 'bosque',   label: '🌿 Bosque', color: '#16A34A', badge: 'Premium' },
  { key: 'sakura',   label: '🌸 Sakura', color: '#DB2777', badge: 'Premium' },
  { key: 'pride',    label: '🌈 Pride',  color: '#8B5CF6', badge: 'Premium' },
]

export function SettingsClient({ profile, userId }: Props) {
  const supabase = createClient()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [currency, setCurrency] = useState<'PEN' | 'USD'>(
    (profile?.base_currency as 'PEN' | 'USD') ?? 'PEN'
  )
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [mounted, setMounted] = useState(false)
  const [accent, setAccentState] = useState('mimeta')

  useEffect(() => {
    setMounted(true)
    setAccentState(getAccentTheme())
  }, [])

  function changeAccent(a: string) {
    setAccentState(a)
    setAccentTheme(a)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    await supabase.from('profiles').update({ display_name: displayName.trim(), base_currency: currency }).eq('id', userId)
    setProfileMsg('¡Guardado!')
    setSavingProfile(false)
    setTimeout(() => setProfileMsg(''), 2000)
  }

  const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring'
  const cardClass  = 'rounded-xl border border-border bg-card p-6 shadow-sm'
  const btnPrimary = 'rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50'

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">Configuración</h1>

      {/* Perfil */}
      <section className={cardClass}>
        <h2 className="text-base font-semibold text-foreground mb-4">Perfil</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Moneda principal</label>
            <div className="flex gap-2">
              {(['PEN', 'USD'] as const).map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
                    currency === c
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span className="text-base">{c === 'PEN' ? '🇵🇪' : '🇺🇸'}</span>
                  <span>{c === 'PEN' ? 'Sol (PEN)' : 'Dólar (USD)'}</span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Se usa como moneda base para reportes y presupuestos.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Plan</label>
            <p className="text-sm text-foreground capitalize">{profile?.plan ?? 'free'}</p>
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" disabled={savingProfile} className={btnPrimary}>
              {savingProfile ? 'Guardando...' : 'Guardar cambios'}
            </button>
            {profileMsg && <span className="text-sm text-emerald-600 dark:text-emerald-400">{profileMsg}</span>}
          </div>
        </form>
      </section>

      {/* Apariencia */}
      {mounted && (
        <section className={cardClass}>
          <h2 className="text-base font-semibold text-foreground mb-4">Apariencia</h2>

          {/* Modo claro / oscuro */}
          <div className="mb-5">
            <p className="text-xs font-medium text-muted-foreground mb-2">Modo</p>
            <div className="flex gap-2">
              <button
                onClick={() => setTheme('light')}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
                  theme === 'light'
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <Sun className="h-4 w-4" /> Claro
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm transition-colors ${
                  theme === 'dark'
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <Moon className="h-4 w-4" /> Oscuro
              </button>
            </div>
          </div>

          {/* Color de acento */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Color de acento</p>
            <div className="flex gap-3 flex-wrap">
              {ACCENT_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => changeAccent(opt.key)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    accent === opt.key
                      ? 'border-current font-medium'
                      : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                  style={accent === opt.key ? { color: opt.color, borderColor: opt.color, background: opt.color + '18' } : {}}
                >
                  <span className="h-3.5 w-3.5 rounded-full shrink-0" style={{ backgroundColor: opt.color }} />
                  {opt.label}
                  {opt.badge && (
                    <Crown className="ml-auto h-3.5 w-3.5 text-amber-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Categorías */}
      <section className={cardClass}>
        <h2 className="text-base font-semibold text-foreground mb-2">Categorías</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Gestiona tus categorías de ingresos y egresos desde la página de Presupuesto.
        </p>
        <Link
          href="/budgets"
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          Ir a Presupuesto →
        </Link>
      </section>

      {/* Sesión */}
      <section className={cardClass}>
        <h2 className="text-base font-semibold text-foreground mb-4">Sesión</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Sesión activa como <span className="font-medium text-foreground">{profile?.display_name ?? 'Usuario'}</span>.
        </p>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-lg border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </section>
    </div>
  )
}
