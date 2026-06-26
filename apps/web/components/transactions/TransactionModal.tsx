'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

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
  baseCurrency: 'PEN' | 'USD'
  onSaved: (tx: Transaction, isNew: boolean) => void
  onDeleted: (id: string) => void
  onClose: () => void
}

// Moneda "contraria" según la base
function foreignOf(base: 'PEN' | 'USD'): 'PEN' | 'USD' {
  return base === 'PEN' ? 'USD' : 'PEN'
}

export function TransactionModal({ transaction, categories, userId, baseCurrency, onSaved, onDeleted, onClose }: Props) {
  const supabase = createClient()
  const isNew = !transaction

  const [type, setType]       = useState<'income' | 'expense'>((transaction?.type as 'income' | 'expense') ?? 'expense')
  const [date, setDate]       = useState(transaction?.date ?? new Date().toISOString().slice(0, 10))
  const [concept, setConcept] = useState(transaction?.concept ?? '')
  const [amount, setAmount]   = useState(transaction?.amount?.toString() ?? '')
  const [currency, setCurrency] = useState<'PEN' | 'USD'>(
    (transaction?.currency as 'PEN' | 'USD') ?? baseCurrency
  )
  const [categoryId, setCategoryId] = useState(transaction?.categories?.id ?? '')
  const [notes, setNotes]     = useState(transaction?.notes ?? '')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [budgetCatIds, setBudgetCatIds] = useState<string[] | null>(null)
  const [loadingCats, setLoadingCats]   = useState(false)

  // Tipo de cambio
  const needsConversion = currency !== 'PEN'   // amount_pen siempre en PEN
  const [rateMode, setRateMode]     = useState<'auto' | 'manual'>('auto')
  const [exchangeRate, setExchangeRate] = useState<string>('')
  const [loadingRate, setLoadingRate]   = useState(false)
  const [rateNotFound, setRateNotFound] = useState(false)
  const [rateSource, setRateSource]     = useState<'db' | 'live' | 'none' | null>(null)

  // Si estamos editando una transacción en USD, derivar el TC original
  useEffect(() => {
    if (!isNew && transaction?.currency === 'USD' && transaction.amount > 0) {
      const derived = (transaction.amount_pen / transaction.amount).toFixed(4)
      setExchangeRate(derived)
      setRateMode('manual')
    }
  }, [])

  // Consultar tipo de cambio automático cuando cambia fecha o moneda
  useEffect(() => {
    if (!needsConversion || rateMode !== 'auto') return
    if (!date) return

    setLoadingRate(true)
    setRateNotFound(false)

    fetch(`/api/exchange-rate?date=${date}`)
      .then(r => r.json())
      .then(({ rate, source }) => {
        if (rate) {
          setExchangeRate(rate.toString())
          setRateSource(source)
          setRateNotFound(false)
        } else {
          setExchangeRate('')
          setRateSource('none')
          setRateNotFound(true)
        }
        setLoadingRate(false)
      })
      .catch(() => {
        setExchangeRate('')
        setRateSource('none')
        setRateNotFound(true)
        setLoadingRate(false)
      })
  }, [date, needsConversion, rateMode])

  // Resetear TC al cambiar moneda
  useEffect(() => {
    if (!needsConversion) {
      setExchangeRate('')
      setRateNotFound(false)
      setRateSource(null)
    } else if (rateMode === 'auto') {
      setExchangeRate('')
      setRateSource(null)
    }
  }, [currency])

  // amount_pen: siempre en PEN
  const rate      = parseFloat(exchangeRate) || 0
  const amountNum = parseFloat(amount) || 0
  const amountPen = needsConversion
    ? amountNum * rate
    : amountNum

  // Categorías filtradas
  const filteredCats = categories.filter(c => {
    if (c.type !== type) return false
    if (type === 'expense' && budgetCatIds !== null) {
      return budgetCatIds.includes(c.id) || c.id === categoryId
    }
    return true
  })

  useEffect(() => {
    if (categoryId) {
      const cat = categories.find(c => c.id === categoryId)
      if (cat && cat.type !== type) setCategoryId('')
    }
  }, [type])

  useEffect(() => {
    if (!date || type !== 'expense') { setBudgetCatIds(null); return }
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

    if (!concept.trim() || !amount || amountNum <= 0) {
      setError('Completa concepto y monto.')
      return
    }
    if (!categoryId) {
      setError('Selecciona una categoría.')
      return
    }
    if (needsConversion && (!exchangeRate || rate <= 0)) {
      setError('Ingresa el tipo de cambio.')
      return
    }

    setLoading(true)

    const payload = {
      user_id: userId,
      date,
      type,
      concept: concept.trim(),
      amount: amountNum,
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
    setDeleting(true)
    const { error: err } = await supabase.from('transactions').delete().eq('id', transaction!.id)
    if (err) { setError(err.message); setDeleting(false); return }
    onDeleted(transaction!.id)
  }

  const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring'
  const currSymbol = (c: 'PEN' | 'USD') => c === 'PEN' ? 'S/' : '$'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">
            {isNew ? 'Nuevo movimiento' : 'Editar movimiento'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
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
                    ? t === 'income' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
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
              className={inputClass}
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
              className={inputClass}
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
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Moneda</label>
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value as 'PEN' | 'USD')}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring h-[38px]"
              >
                <option value="PEN">S/ PEN</option>
                <option value="USD">$ USD</option>
              </select>
            </div>
          </div>

          {/* Bloque de tipo de cambio — solo cuando la moneda no es PEN */}
          {needsConversion && (
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">Tipo de cambio</p>
                <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                  <button
                    type="button"
                    onClick={() => setRateMode('auto')}
                    className={`px-3 py-1 transition-colors ${rateMode === 'auto' ? 'bg-primary text-primary-foreground font-medium' : 'bg-card text-muted-foreground hover:bg-muted'}`}
                  >
                    Automático
                  </button>
                  <button
                    type="button"
                    onClick={() => setRateMode('manual')}
                    className={`px-3 py-1 transition-colors ${rateMode === 'manual' ? 'bg-primary text-primary-foreground font-medium' : 'bg-card text-muted-foreground hover:bg-muted'}`}
                  >
                    Manual
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    value={exchangeRate}
                    onChange={e => setExchangeRate(e.target.value)}
                    disabled={rateMode === 'auto' && !rateNotFound}
                    placeholder="0.00"
                    min="0.001"
                    step="0.0001"
                    className={`w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 disabled:cursor-not-allowed`}
                  />
                  {loadingRate && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">S/ por USD</span>
              </div>

              {rateMode === 'auto' && rateNotFound && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  No hay tipo de cambio registrado para esta fecha. Puedes ingresarlo manualmente.
                </p>
              )}
              {rateMode === 'auto' && !rateNotFound && exchangeRate && (
                <p className="text-xs text-muted-foreground">
                  {rateSource === 'live'
                    ? 'TC obtenido en tiempo real desde open.er-api.com.'
                    : 'TC obtenido del historial registrado.'}
                </p>
              )}

              {amountNum > 0 && rate > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-primary/8 px-3 py-2">
                  <span className="text-xs text-muted-foreground">Equivalente en PEN</span>
                  <span className="text-sm font-semibold text-foreground">
                    S/ {amountPen.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Categoría */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-muted-foreground">
                Categoría <span className="text-red-400">*</span>
              </label>
              {type === 'expense' && date && (
                <span className="text-xs text-muted-foreground">
                  {loadingCats ? 'Cargando...' : budgetCatIds !== null ? `${filteredCats.length} del presupuesto` : 'Todas las categorías'}
                </span>
              )}
            </div>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              required
              disabled={loadingCats}
              className={`w-full rounded-lg border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring ${!categoryId ? 'border-red-200 bg-red-50 dark:bg-red-950/20' : 'border-border bg-background'} ${loadingCats ? 'opacity-50' : ''}`}
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
              className={`${inputClass} resize-none`}
            />
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg px-3 py-2">{error}</p>}

          {/* Botones */}
          <div className="flex gap-2 pt-1">
            {!isNew && (
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
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
      <ConfirmDialog
        open={showConfirm}
        title="Eliminar movimiento"
        message="¿Estás seguro? Esta acción no se puede deshacer."
        onConfirm={handleDelete}
        onClose={() => setShowConfirm(false)}
      />
    </div>
  )
}
