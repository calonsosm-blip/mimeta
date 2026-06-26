'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useCurrency } from '@/hooks/useCurrency'
import { getLimits } from '@/lib/planLimits'
import { UpgradePrompt } from '@/components/ui/UpgradePrompt'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface Category { id: string; name: string; type: string }
interface Payment {
  id: string
  concept: string
  amount: number
  currency: string
  category_id: string | null
  frequency: string
  next_due_date: string
  day_of_month: number | null
  auto_register: boolean
  is_active: boolean
  categories: { name: string } | null
}

interface Props {
  payments: Payment[]
  categories: Category[]
  userId: string
  baseCurrency: 'PEN' | 'USD'
  plan: 'free' | 'premium'
}

const FREQ_LABELS: Record<string, string> = {
  daily: 'Diario', weekly: 'Semanal', biweekly: 'Quincenal',
  monthly: 'Mensual', annual: 'Anual',
}

function daysUntil(dateStr: string) {
  const today = new Date(); today.setHours(0,0,0,0)
  const due = new Date(dateStr + 'T00:00:00')
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

const EMPTY_FORM = {
  concept: '', amount: '', currency: 'PEN', category_id: '',
  frequency: 'monthly', next_due_date: new Date().toISOString().slice(0,10),
  day_of_month: '', auto_register: false,
}

export function PlannedPaymentsClient({ payments: initial, categories, userId, baseCurrency, plan }: Props) {
  const supabase = createClient()
  const { sym, toBase, fmt } = useCurrency(baseCurrency)
  const [payments, setPayments]     = useState(initial)
  const [showForm, setShowForm]     = useState(false)
  const [editing, setEditing]       = useState<Payment | null>(null)
  const [form, setForm]             = useState<any>(EMPTY_FORM)
  const [loading, setLoading]       = useState(false)
  const [registering, setRegistering] = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  const limits = getLimits(plan)

  function openNew() {
    if (payments.length >= limits.planned_payments) { setShowUpgrade(true); return }
    setEditing(null); setForm(EMPTY_FORM); setShowForm(true); setError(null)
  }

  function openEdit(p: Payment) {
    setEditing(p)
    setForm({
      concept: p.concept, amount: p.amount.toString(), currency: p.currency,
      category_id: p.category_id ?? '', frequency: p.frequency,
      next_due_date: p.next_due_date, day_of_month: p.day_of_month?.toString() ?? '',
      auto_register: p.auto_register,
    })
    setShowForm(true); setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const payload = {
      user_id: userId,
      concept: form.concept.trim(),
      amount: parseFloat(form.amount),
      currency: form.currency,
      category_id: form.category_id || null,
      frequency: form.frequency,
      next_due_date: form.next_due_date,
      day_of_month: form.day_of_month ? parseInt(form.day_of_month) : null,
      auto_register: form.auto_register,
    }
    if (!payload.concept || isNaN(payload.amount) || payload.amount <= 0) {
      setError('Completa concepto y monto.'); return
    }
    setLoading(true)
    if (editing) {
      const { data, error: err } = await supabase.from('planned_payments').update(payload).eq('id', editing.id).select('*, categories(name)').single()
      if (err) { setError(err.message); setLoading(false); return }
      setPayments(prev => prev.map(p => p.id === editing.id ? data as any : p))
    } else {
      const { data, error: err } = await supabase.from('planned_payments').insert(payload).select('*, categories(name)').single()
      if (err) { setError(err.message); setLoading(false); return }
      setPayments(prev => [...prev, data as any].sort((a,b) => a.next_due_date.localeCompare(b.next_due_date)))
    }
    setLoading(false); setShowForm(false)
  }

  function deletePayment(id: string) {
    setConfirm({
      title: 'Eliminar alerta de pago',
      message: '¿Estás seguro? Esta acción no se puede deshacer.',
      onConfirm: async () => {
        await supabase.from('planned_payments').delete().eq('id', id)
        setPayments(prev => prev.filter(p => p.id !== id))
        setConfirm(null)
      },
    })
  }

  async function toggleActive(p: Payment) {
    const { data } = await supabase.from('planned_payments').update({ is_active: !p.is_active }).eq('id', p.id).select('*, categories(name)').single()
    if (data) setPayments(prev => prev.map(x => x.id === p.id ? data as any : x))
  }

  async function registerNow(p: Payment) {
    setRegistering(p.id)
    const amountPen = p.currency === 'USD' ? p.amount * 3.75 : p.amount
    await supabase.from('transactions').insert({
      user_id: userId, date: new Date().toISOString().slice(0, 10),
      type: 'expense', concept: p.concept,
      amount: p.amount, currency: p.currency,
      amount_pen: amountPen, category_id: p.category_id,
    })
    const next = new Date(p.next_due_date + 'T12:00:00')
    if (p.frequency === 'monthly')  next.setMonth(next.getMonth() + 1)
    else if (p.frequency === 'weekly')   next.setDate(next.getDate() + 7)
    else if (p.frequency === 'biweekly') next.setDate(next.getDate() + 14)
    else if (p.frequency === 'annual')   next.setFullYear(next.getFullYear() + 1)
    const { data } = await supabase.from('planned_payments').update({ next_due_date: next.toISOString().slice(0,10) }).eq('id', p.id).select('*, categories(name)').single()
    if (data) setPayments(prev => prev.map(x => x.id === p.id ? data as any : x).sort((a,b) => a.next_due_date.localeCompare(b.next_due_date)))
    setRegistering(null)
  }

  // En plan free, las alertas que exceden el límite quedan bloqueadas (solo se pueden eliminar)
  const allowed  = plan === 'free' ? payments.slice(0, limits.planned_payments) : payments
  const blocked  = plan === 'free' ? payments.slice(limits.planned_payments) : []

  const active   = allowed.filter(p => p.is_active)
  const inactive = allowed.filter(p => !p.is_active)

  const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="space-y-6 w-full">
      <UpgradePrompt
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="alertas de pago"
        limit={limits.planned_payments}
        unit="alertas"
      />
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        onConfirm={confirm?.onConfirm ?? (() => {})}
        onClose={() => setConfirm(null)}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Alertas de pago</h1>
        <button
          onClick={openNew}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Nueva alerta
        </button>
      </div>

      {/* Lista activos */}
      <div className="space-y-3">
        {active.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
            <p className="text-muted-foreground text-sm">No hay pagos fijos configurados.</p>
            <button onClick={openNew} className="mt-2 text-primary text-sm hover:underline">Agregar la primera alerta</button>
          </div>
        )}
        {active.map(p => {
          const days = daysUntil(p.next_due_date)
          const isOverdue = days < 0
          const isSoon    = days >= 0 && days <= 5
          return (
            <div key={p.id} className={`rounded-xl border bg-card p-5 shadow-sm ${
              isOverdue ? 'border-red-400 dark:border-red-800'
              : isSoon  ? 'border-amber-400 dark:border-amber-800'
              : 'border-border'
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">{p.concept}</h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{FREQ_LABELS[p.frequency]}</span>
                    {p.auto_register && <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">Auto</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.categories?.name ?? 'Sin categoría'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-foreground">{sym} {fmt(toBase(p.amount, p.currency as 'PEN' | 'USD'))}</p>
                  <p className={`text-xs mt-0.5 ${
                    isOverdue ? 'text-red-500 dark:text-red-400 font-medium'
                    : isSoon  ? 'text-amber-600 dark:text-amber-400 font-medium'
                    : 'text-muted-foreground'
                  }`}>
                    {isOverdue
                      ? `Vencido hace ${Math.abs(days)} días`
                      : days === 0 ? '¡Vence hoy!'
                      : `En ${days} días · ${new Date(p.next_due_date + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}`
                    }
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => registerNow(p)}
                  disabled={registering === p.id}
                  className="w-full sm:flex-1 rounded-lg border border-primary/40 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                >
                  {registering === p.id ? 'Registrando...' : '✓ Registrar ahora'}
                </button>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(p)} className="flex-1 sm:flex-none rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">Editar</button>
                  <button onClick={() => toggleActive(p)} className="flex-1 sm:flex-none rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors">Desactivar</button>
                  <button onClick={() => deletePayment(p.id)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-400 hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-colors" title="Eliminar">✕</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Inactivos */}
      {inactive.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Inactivos</p>
          <div className="space-y-2">
            {inactive.map(p => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-muted px-4 py-3 gap-3">
                <p className="text-sm text-muted-foreground line-through flex-1">{p.concept}</p>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleActive(p)} className="text-xs text-muted-foreground hover:text-primary">Activar</button>
                  <button onClick={() => deletePayment(p.id)} className="text-xs text-red-400 hover:text-red-500" title="Eliminar">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bloqueados por plan free */}
      {blocked.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Bloqueados por plan gratuito</p>
          <div className="space-y-2">
            {blocked.map(p => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-3 gap-3 opacity-70">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-base shrink-0">🔒</span>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground truncate">{p.concept}</p>
                    <p className="text-xs text-muted-foreground/60">{sym} {fmt(toBase(p.amount, p.currency as 'PEN' | 'USD'))} · {FREQ_LABELS[p.frequency]}</p>
                  </div>
                </div>
                <button
                  onClick={() => deletePayment(p.id)}
                  className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-400 hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Actualiza a <a href="/pricing" className="text-primary hover:underline">Premium</a> para desbloquear todas tus alertas.
          </p>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border px-6 py-4 sticky top-0 bg-card">
              <h2 className="text-base font-semibold text-foreground">
                {editing ? 'Editar alerta de pago' : 'Nueva alerta de pago'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Concepto</label>
                <input type="text" value={form.concept} onChange={e => setForm((p:any) => ({...p, concept: e.target.value}))} placeholder="Ej: Netflix, Alquiler..." className={inputClass} required />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Monto</label>
                  <input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm((p:any) => ({...p, amount: e.target.value}))} placeholder="0.00" className={inputClass} required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Moneda</label>
                  <select value={form.currency} onChange={e => setForm((p:any) => ({...p, currency: e.target.value}))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none h-[38px]">
                    <option value="PEN">S/ PEN</option>
                    <option value="USD">$ USD</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Frecuencia</label>
                <select value={form.frequency} onChange={e => setForm((p:any) => ({...p, frequency: e.target.value}))} className={inputClass}>
                  {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Próxima fecha de pago</label>
                <input type="date" value={form.next_due_date} onChange={e => setForm((p:any) => ({...p, next_due_date: e.target.value}))} className={inputClass} required />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Categoría</label>
                <select value={form.category_id} onChange={e => setForm((p:any) => ({...p, category_id: e.target.value}))} className={inputClass}>
                  <option value="">Sin categoría</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type === 'expense' ? 'Egreso' : 'Ingreso'})</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="checkbox" checked={form.auto_register} onChange={e => setForm((p:any) => ({...p, auto_register: e.target.checked}))} className="rounded border-border" />
                Registrar automáticamente en la fecha
              </label>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted">Cancelar</button>
                <button type="submit" disabled={loading} className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {loading ? 'Guardando...' : editing ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
