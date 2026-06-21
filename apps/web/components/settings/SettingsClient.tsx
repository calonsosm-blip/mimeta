'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { setAccentTheme, getAccentTheme } from '@/components/providers/ThemeProvider'
import { Sun, Moon, LogOut } from 'lucide-react'

interface Category {
  id: string
  name: string
  type: string
  parent_id: string | null
  sort_order: number
}

interface Props {
  profile: { display_name: string | null; base_currency: string; plan: string } | null
  categories: Category[]
  userId: string
}

const ACCENT_OPTIONS = [
  { key: 'mimeta',   label: 'MiMeta',   color: '#0e7c4a', badge: '' },
  { key: 'midnight', label: 'Midnight', color: '#14b8a6', badge: 'Pro' },
  { key: 'oro',      label: 'Oro',      color: '#d4af37', badge: 'Pro' },
]

export function SettingsClient({ profile, categories, userId }: Props) {
  const supabase = createClient()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [cats, setCats] = useState(categories)
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [mounted, setMounted] = useState(false)
  const [accent, setAccentState] = useState('mimeta')

  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<'income' | 'expense'>('expense')
  const [addingCat, setAddingCat] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

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
    await supabase.from('profiles').update({ display_name: displayName.trim() }).eq('id', userId)
    setProfileMsg('¡Guardado!')
    setSavingProfile(false)
    setTimeout(() => setProfileMsg(''), 2000)
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAddingCat(true)
    const { data, error } = await supabase
      .from('categories')
      .insert({ user_id: userId, name: newName.trim(), type: newType, sort_order: cats.length })
      .select('id, name, type, parent_id, sort_order')
      .single()
    if (!error && data) { setCats(prev => [...prev, data]); setNewName('') }
    setAddingCat(false)
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return
    await supabase.from('categories').update({ name: editName.trim() }).eq('id', id)
    setCats(prev => prev.map(c => c.id === id ? { ...c, name: editName.trim() } : c))
    setEditingId(null)
  }

  async function deleteCategory(id: string) {
    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id)
    if ((count ?? 0) > 0) {
      alert(`No se puede eliminar: hay ${count} transacción${count === 1 ? '' : 'es'} registrada${count === 1 ? '' : 's'} con esta categoría.`)
      return
    }
    if (!confirm('¿Eliminar esta categoría? También se quitará de todos los presupuestos.')) return
    await supabase.from('budgets').delete().eq('category_id', id)
    await supabase.from('categories').delete().eq('id', id)
    setCats(prev => prev.filter(c => c.id !== id))
  }

  const incomeCategories  = cats.filter(c => c.type === 'income')
  const expenseCategories = cats.filter(c => c.type === 'expense')

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
                    <span className="ml-auto text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                      {opt.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Categorías */}
      <section className={cardClass}>
        <h2 className="text-base font-semibold text-foreground mb-4">Categorías</h2>

        <form onSubmit={addCategory} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nueva categoría..."
            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={newType}
            onChange={e => setNewType(e.target.value as 'income' | 'expense')}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="expense">Egreso</option>
            <option value="income">Ingreso</option>
          </select>
          <button type="submit" disabled={addingCat} className={btnPrimary}>
            Agregar
          </button>
        </form>

        {/* Lista egresos */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Egresos</p>
          <ul className="space-y-1">
            {expenseCategories.map(cat => (
              <li key={cat.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted">
                {editingId === cat.id ? (
                  <div className="flex flex-1 gap-2 mr-2">
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(cat.id); if (e.key === 'Escape') setEditingId(null) }}
                      className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button onClick={() => saveEdit(cat.id)} className="text-xs text-primary font-medium">Guardar</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground">Cancelar</button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-foreground">{cat.name}</span>
                    <div className="flex gap-3">
                      <button onClick={() => { setEditingId(cat.id); setEditName(cat.name) }} className="text-xs text-muted-foreground hover:text-primary">Editar</button>
                      <button onClick={() => deleteCategory(cat.id)} className="text-xs text-muted-foreground hover:text-destructive">Eliminar</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Lista ingresos */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ingresos</p>
          <ul className="space-y-1">
            {incomeCategories.map(cat => (
              <li key={cat.id} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-muted">
                {editingId === cat.id ? (
                  <div className="flex flex-1 gap-2 mr-2">
                    <input
                      autoFocus
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(cat.id); if (e.key === 'Escape') setEditingId(null) }}
                      className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button onClick={() => saveEdit(cat.id)} className="text-xs text-primary font-medium">Guardar</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground">Cancelar</button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-foreground">{cat.name}</span>
                    <div className="flex gap-3">
                      <button onClick={() => { setEditingId(cat.id); setEditName(cat.name) }} className="text-xs text-muted-foreground hover:text-primary">Editar</button>
                      <button onClick={() => deleteCategory(cat.id)} className="text-xs text-muted-foreground hover:text-destructive">Eliminar</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
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
