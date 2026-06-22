'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TransactionModal } from './TransactionModal'
import { useIsMobile } from '@/hooks/useIsMobile'

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
  transactions: Transaction[]
  categories: Category[]
  userId: string
  baseCurrency: 'PEN' | 'USD'
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export function TransactionsClient({ transactions, categories, userId, baseCurrency }: Props) {
  const isMobile = useIsMobile()
  const [txList, setTxList] = useState(transactions)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Transaction | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [filterMonth, setFilterMonth] = useState<string>('all')
  const supabase = createClient()

  const months = useMemo(() => {
    const seen = new Set<string>()
    txList.forEach(tx => {
      const d = new Date(tx.date + 'T12:00:00')
      seen.add(`${d.getFullYear()}-${d.getMonth()}`)
    })
    return Array.from(seen).sort().reverse()
  }, [txList])

  const filtered = useMemo(() => {
    return txList.filter(tx => {
      if (filterType !== 'all' && tx.type !== filterType) return false
      if (filterMonth !== 'all') {
        const d = new Date(tx.date + 'T12:00:00')
        const key = `${d.getFullYear()}-${d.getMonth()}`
        if (key !== filterMonth) return false
      }
      return true
    })
  }, [txList, filterType, filterMonth])

  async function handleDelete() {
    if (!confirmDelete) return
    setDeleting(true)
    await supabase.from('transactions').delete().eq('id', confirmDelete.id)
    setTxList(prev => prev.filter(t => t.id !== confirmDelete.id))
    setDeleting(false)
    setConfirmDelete(null)
  }

  function handleSaved(tx: Transaction, isNew: boolean) {
    setTxList(prev =>
      isNew ? [tx, ...prev] : prev.map(t => t.id === tx.id ? tx : t)
    )
    setShowModal(false)
    setEditing(null)
  }

  function handleDeleted(id: string) {
    setTxList(prev => prev.filter(t => t.id !== id))
    setShowModal(false)
    setEditing(null)
  }

  function openNew() { setEditing(null); setShowModal(true) }
  function openEdit(tx: Transaction) { setEditing(tx); setShowModal(true) }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Transacciones</h1>
        <button
          onClick={openNew}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
        >
          + Nueva transacción
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'income', 'expense'] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterType === t
                ? 'bg-primary text-white'
                : 'bg-card border border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {t === 'all' ? 'Todos' : t === 'income' ? 'Ingresos' : 'Egresos'}
          </button>
        ))}
        <select
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todos los meses</option>
          {months.map(m => {
            const [y, mo] = m.split('-')
            return (
              <option key={m} value={m}>
                {MONTHS[parseInt(mo)]} {y}
              </option>
            )
          })}
        </select>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground text-sm">No hay transacciones.</p>
            <button onClick={openNew} className="mt-3 text-primary text-sm hover:underline">
              Registrar la primera
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <th className="px-2 py-3 sm:px-4">Fecha</th>
                <th className="px-2 py-3 sm:px-4">Concepto</th>
                {!isMobile && <th className="px-4 py-3">Categoría</th>}
                <th className="px-2 py-3 sm:px-4 text-right">Monto</th>
                <th className="px-2 py-3 sm:px-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(tx => {
                const d = new Date(tx.date + 'T12:00:00')
                return (
                  <tr key={tx.id} className="hover:bg-muted transition-colors">
                    <td className="px-2 py-3 sm:px-4 text-muted-foreground whitespace-nowrap text-xs sm:text-sm">
                      {d.getDate()} {MONTHS[d.getMonth()]}
                    </td>
                    <td className="px-2 py-3 sm:px-4 max-w-[140px] sm:max-w-none">
                      <div className="flex items-center gap-2">
                        <span className={`shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                          tx.type === 'income' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {tx.type === 'income' ? '↑' : '↓'}
                        </span>
                        <span className="font-medium text-foreground truncate">{tx.concept}</span>
                      </div>
                    </td>
                    {!isMobile && (
                      <td className="px-4 py-3 text-muted-foreground">
                        {tx.categories?.name ?? <span className="text-gray-300">—</span>}
                      </td>
                    )}
                    <td className={`px-2 py-3 sm:px-4 text-right font-semibold text-xs sm:text-sm whitespace-nowrap ${
                      tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {tx.type === 'income' ? '+' : '-'} S/ {fmt(tx.amount_pen)}
                      {tx.currency === 'USD' && (
                        <span className="ml-1 text-xs text-muted-foreground">(${fmt(tx.amount)})</span>
                      )}
                    </td>
                    <td className="px-2 py-3 sm:px-4">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(tx)}
                          title="Editar"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-accent transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setConfirmDelete(tx)}
                          title="Eliminar"
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <TransactionModal
          transaction={editing}
          categories={categories}
          userId={userId}
          baseCurrency={baseCurrency}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onClose={() => { setShowModal(false); setEditing(null) }}
        />
      )}

      {/* Mini-modal confirmación eliminar */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card shadow-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <span className="text-red-500 text-lg">!</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-sm">¿Eliminar transacción?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  <span className="font-medium text-foreground/80">{confirmDelete.concept}</span>
                  {' · '}
                  {confirmDelete.type === 'income' ? '+' : '-'} S/ {fmt(confirmDelete.amount_pen)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
