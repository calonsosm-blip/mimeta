'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Debt {
  id: string
  creditor: string
  initial_balance: number
  current_balance: number
  monthly_payment: number
  payment_day: number
  interest_rate: number | null
  is_active: boolean
}

interface Props {
  debts: Debt[]
  userId: string
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

const EMPTY_FORM = {
  creditor: '', initial_balance: '', current_balance: '',
  monthly_payment: '', payment_day: '15', interest_rate: '',
}

export function DebtsClient({ debts: initial, userId }: Props) {
  const supabase = createClient()
  const [debts, setDebts]     = useState(initial)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Debt | null>(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')

  function openNew() {
    setEditing(null); setForm(EMPTY_FORM); setShowForm(true); setError(null)
  }

  function openEdit(d: Debt) {
    setEditing(d)
    setForm({
      creditor:        d.creditor,
      initial_balance: d.initial_balance.toString(),
      current_balance: d.current_balance.toString(),
      monthly_payment: d.monthly_payment.toString(),
      payment_day:     d.payment_day.toString(),
      interest_rate:   d.interest_rate?.toString() ?? '',
    })
    setShowForm(true)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const payload = {
      user_id:         userId,
      creditor:        form.creditor.trim(),
      initial_balance: parseFloat(form.initial_balance),
      current_balance: parseFloat(form.current_balance),
      monthly_payment: parseFloat(form.monthly_payment),
      payment_day:     parseInt(form.payment_day),
      interest_rate:   form.interest_rate ? parseFloat(form.interest_rate) : null,
    }
    if (!payload.creditor || isNaN(payload.initial_balance) || isNaN(payload.monthly_payment)) {
      setError('Completa los campos obligatorios.'); return
    }
    setLoading(true)
    if (editing) {
      const { data, error: err } = await supabase.from('debts').update(payload).eq('id', editing.id).select('*').single()
      if (err) { setError(err.message); setLoading(false); return }
      setDebts(prev => prev.map(d => d.id === editing.id ? data : d))
    } else {
      const { data, error: err } = await supabase.from('debts').insert(payload).select('*').single()
      if (err) { setError(err.message); setLoading(false); return }
      setDebts(prev => [data, ...prev])
    }
    setLoading(false)
    setShowForm(false)
  }

  async function registerPayment(debt: Debt) {
    const amount = parseFloat(payAmount)
    if (isNaN(amount) || amount <= 0) return
    const newBalance = Math.max(debt.current_balance - amount, 0)
    const { data } = await supabase
      .from('debts')
      .update({ current_balance: newBalance, is_active: newBalance > 0 })
      .eq('id', debt.id).select('*').single()
    if (data) setDebts(prev => prev.map(d => d.id === debt.id ? data : d))
    setPayingId(null); setPayAmount('')
  }

  async function toggleActive(debt: Debt) {
    const { data } = await supabase
      .from('debts')
      .update({ is_active: !debt.is_active })
      .eq('id', debt.id).select('*').single()
    if (data) setDebts(prev => prev.map(d => d.id === debt.id ? data : d))
  }

  const activeDebts   = debts.filter(d => d.is_active)
  const inactiveDebts = debts.filter(d => !d.is_active)
  const totalDebt     = activeDebts.reduce((s, d) => s + d.current_balance, 0)
  const totalMonthly  = activeDebts.reduce((s, d) => s + d.monthly_payment, 0)

  const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Deudas</h1>
        <button
          onClick={openNew}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          + Nueva deuda
        </button>
      </div>

      {/* Resumen */}
      {activeDebts.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Deuda total activa</p>
            <p className="mt-1 text-xl font-bold text-foreground">S/ {fmt(totalDebt)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Cuotas mensuales</p>
            <p className="mt-1 text-xl font-bold text-foreground">S/ {fmt(totalMonthly)}</p>
          </div>
        </div>
      )}

      {/* Deudas activas */}
      <div className="space-y-4">
        {activeDebts.length === 0 && (
          <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
            <p className="text-muted-foreground text-sm">No hay deudas activas registradas.</p>
            <button onClick={openNew} className="mt-2 text-primary text-sm hover:underline">Agregar deuda</button>
          </div>
        )}
        {activeDebts.map(debt => {
          const pct = Math.round(((debt.initial_balance - debt.current_balance) / debt.initial_balance) * 100)
          const monthsLeft = debt.monthly_payment > 0 ? Math.ceil(debt.current_balance / debt.monthly_payment) : null
          // Mora real: hoy superó el día de pago de este mes
          const today = new Date()
          const isOverdue = today.getDate() > debt.payment_day

          return (
            <div key={debt.id} className={`rounded-xl border bg-card p-5 shadow-sm space-y-4 ${isOverdue ? 'border-red-300 dark:border-red-800' : 'border-border'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{debt.creditor}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Pago el día {debt.payment_day} de cada mes</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(debt)} className="text-xs text-muted-foreground hover:text-primary">Editar</button>
                  <button onClick={() => toggleActive(debt)} className="text-xs text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400">Marcar pagada</button>
                </div>
              </div>

              {/* Progreso */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Pagado {pct}%</span>
                  <span>S/ {fmt(debt.initial_balance - debt.current_balance)} de S/ {fmt(debt.initial_balance)}</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-muted">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>

              {/* Cifras */}
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Saldo pendiente</p>
                  <p className={`font-semibold ${isOverdue ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>S/ {fmt(debt.current_balance)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cuota mensual</p>
                  <p className="font-semibold text-foreground">S/ {fmt(debt.monthly_payment)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Meses restantes</p>
                  <p className="font-semibold text-foreground">{monthsLeft ?? '—'}</p>
                </div>
              </div>

              {/* Registrar pago */}
              {payingId === debt.id ? (
                <div className="flex gap-2 items-center pt-1 border-t border-border">
                  <span className="text-xs text-muted-foreground">Monto pagado S/</span>
                  <input
                    autoFocus
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    placeholder={fmt(debt.monthly_payment)}
                    className="w-28 rounded border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    onClick={() => registerPayment(debt)}
                    className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Confirmar
                  </button>
                  <button onClick={() => { setPayingId(null); setPayAmount('') }} className="text-xs text-muted-foreground">Cancelar</button>
                </div>
              ) : (
                <button
                  onClick={() => { setPayingId(debt.id); setPayAmount(debt.monthly_payment.toString()) }}
                  className="w-full rounded-lg border border-primary/40 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
                >
                  Registrar pago
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Deudas pagadas */}
      {inactiveDebts.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pagadas / inactivas</p>
          <div className="space-y-2">
            {inactiveDebts.map(debt => (
              <div key={debt.id} className="flex items-center justify-between rounded-lg border border-border bg-muted px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground line-through">{debt.creditor}</p>
                  <p className="text-xs text-muted-foreground">S/ {fmt(debt.initial_balance)}</p>
                </div>
                <button onClick={() => toggleActive(debt)} className="text-xs text-muted-foreground hover:text-primary">Reactivar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-base font-semibold text-foreground">
                {editing ? 'Editar deuda' : 'Nueva deuda'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {[
                { label: 'Acreedor / nombre de la deuda', key: 'creditor',        type: 'text',   placeholder: 'Ej: Banco BCP, Tarjeta Visa...' },
                { label: 'Saldo inicial (S/)',             key: 'initial_balance', type: 'number', placeholder: '0.00' },
                { label: 'Saldo actual (S/)',              key: 'current_balance', type: 'number', placeholder: '0.00' },
                { label: 'Cuota mensual (S/)',             key: 'monthly_payment', type: 'number', placeholder: '0.00' },
                { label: 'Día de pago (1-31)',             key: 'payment_day',     type: 'number', placeholder: '15' },
                { label: 'Tasa de interés % anual (opcional)', key: 'interest_rate', type: 'number', placeholder: '0.00' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{field.label}</label>
                  <input
                    type={field.type}
                    value={(form as any)[field.key]}
                    onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className={inputClass}
                  />
                </div>
              ))}
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
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
