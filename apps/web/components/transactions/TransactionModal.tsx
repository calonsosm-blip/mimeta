'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Category {
  id: string
  name: string
  type: string
  parent_id: string | null
}

interface Transaction {
  id: string
  date: string
  type: string
  concept: string
  amount: number
  amount_pen: number
  currency: string
  notes: string | null
  categories: { id: string; name: string; type: string } | null
}

interface Props {
  transaction: Transaction | null
  categories: Category[]
  userId: string
  onSaved: (tx: Transaction, isNew: boolean) => void
  onDeleted: (id: string) => void
  onClose: () => void
}

const EXCHANGE_RATE = 3.75

export function TransactionModal({ transaction, categories, userId, onSaved, onDeleted, onClose }: Props) {
  const supabase = createClient()
  const isNew = !transaction

  const [type, setType] = useState<'income' | 'expense'>(
    (transaction?.type as 'income' | 'expense') ?? 'expense'
  )
  const [date, setDate] = useState(transaction?.date ?? new Date().toISOString().slice(0, 10))
  const [concept, setConcept] = useState(transaction?.concept ?? '')
  const [amount, setAmount] = useState(transaction?.amount?.toString() ?? '')
  const [currency, setCurrency] = useState<'PEN' | 'USD'>(
    (transaction?.currency as 'PEN' | 'USD') ?? 'PEN'
  )
  const [categoryId, setCategoryId] = useState(transaction?.categories?.id ?? '')
  const [notes, setNotes] = useState(transaction?.notes ?? '')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // null = sin presupuesto para ese mes → mostrar todas
  const [budgetCatIds, setBudgetCatIds] = useState<string[] | null>(null)
  const [loadingCats, setLoadingCats] = useState(false)

  const amountPen = currency === 'USD'
    ? (parseFloat(amount) || 0) * EXCHANGE_RATE
    : (parseFloat(amount) || 0)

  // Categorías filtradas: por tipo y, para egresos, por las del presupuesto del mes
  const filteredCats = categories.filter(c => {
    if (c.type !== type) return false
    if (type === 'expense' && budgetCatIds !== null) {
      return budgetCatIds.includes(c.id) || c.id === categoryId
    }
    return true
  })

  // Reset category when type changes
  useEffect(() => {
    if (categoryId) {
      const cat = categories.find(c => c.id === categoryId)
      if (cat && cat.type !== type) setCategoryId('')
    }
  }, [type])

  // Cargar categorías del presupuesto según el mes de la fecha seleccionada
  useEffect(() => {
    if (!date || type !== 'expense') {
      setBudgetCatIds(null)
      return
    }
    const [y, m] = date.split('-')
    setLoadingCats(true)
    supabase
      .from('budgets')
      .select('category_id')
      .eq('user_id', userId)
      .eq('year', parseInt(y))
      .eq('month', parseInt(m))
      .then(({ data }) => {
        if (data && data.length > 0) {
          setBudgetCatIds((data as any[]).map((b: any) => b.category_id))
        } else {
          setBudgetCatIds(null)
        }
        setLoadingCats(false)
      })
  }, [date, type])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!concept.trim() || !amount || parseFloat(amount) <= 0) {
      setError('Completa concepto y monto.')
      return
    }
    if (!categoryId) {
      setError('Selecciona una categoría.')
      return
    }
    setLoading(true)

    const payload = {
      user_id: userId,
      date,
      type,
      concept: concept.trim(),
      amount: parseFloat(amount),
      currency,
      amount_pen: parseFloat(amountPen.toFixed(2)),
      category_id: categoryId || null,
      notes: notes.trim() || null,
    }

    if (isNew) {
      const { data, error: err } = await supabase
        .from('transactions')
        .insert(payload)
        .select('id, date, type, concept, amount, amount_pen, currency, notes, categories(id, name, type)')
        .single()
      if (err) { setError(err.message); setLoading(false); return }
      onSaved(data as any, true)
    } else {
      const { data, error: err } = await supabase
        .from('transactions')
        .update(payload)
        .eq('id', transaction!.id)
        .select('id, date, type, concept, amount, amount_pen, currency, notes, categories(id, name, type)')
        .single()
      if (err) { setError(err.message); setLoading(false); return }
      onSaved(data as any, false)
    }
    setLoading(false)
  }

  async function handleDelete() {
    if (!confirm('¿Eliminar esta transacción?')) return
    setDeleting(true)
    const { error: err } = await supabase.from('transactions').delete().eq('id', transaction!.id)
    if (err) { setError(err.message); setDeleting(false); return }
    onDeleted(transaction!.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">
            {isNew ? 'Nueva transacción' : 'Editar transacción'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Tipo */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['expense', 'income'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  type === t
                    ? t === 'income'
                      ? 'bg-emerald-500 text-white'
                      : 'bg-red-500 text-white'
                    : 'bg-card text-muted-foreground hover:bg-muted'
                }`}
              >
                {t === 'income' ? '↑ Ingreso' : '↓ Egreso'}
              </button>
            ))}
          </div>

          {/* Fecha */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Concepto */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Concepto</label>
            <input
              type="text"
              value={concept}
              onChange={e => setConcept(e.target.value)}
              placeholder="Ej: Mercado, Sueldo..."
              required
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Monto + Moneda */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-muted-foreground mb-1">Monto</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Moneda</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as 'PEN' | 'USD')}
                className="rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-[38px]"
              >
                <option value="PEN">S/ PEN</option>
                <option value="USD">$ USD</option>
              </select>
            </div>
          </div>

          {currency === 'USD' && parseFloat(amount) > 0 && (
            <p className="text-xs text-muted-foreground -mt-2">
              ≈ S/ {amountPen.toFixed(2)} (T.C. {EXCHANGE_RATE})
            </p>
          )}

          {/* Categoría */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-muted-foreground">
                Categoría <span className="text-red-400">*</span>
              </label>
              {type === 'expense' && date && (
                <span className="text-xs text-muted-foreground">
                  {loadingCats
                    ? 'Cargando...'
                    : budgetCatIds !== null
                      ? `${filteredCats.length} del presupuesto`
                      : 'Todas las categorías'}
                </span>
              )}
            </div>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              required
              disabled={loadingCats}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${!categoryId ? 'border-red-200 bg-red-50' : 'border-border'} ${loadingCats ? 'opacity-50' : ''}`}
            >
              <option value="" disabled>Selecciona una categoría</option>
              {filteredCats.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Detalles adicionales..."
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          {/* Botones */}
          <div className="flex gap-2 pt-1">
            {!isNew && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : isNew ? 'Guardar' : 'Actualizar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
