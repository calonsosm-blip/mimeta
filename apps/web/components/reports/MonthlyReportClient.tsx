'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Download } from 'lucide-react'

interface Transaction {
  id: string
  date: string
  type: string
  concept: string
  amount: number
  amount_pen: number
  currency: string
  notes: string | null
  categories: { name: string } | null
}

interface Props {
  transactions: Transaction[]
  year: number
  currentYear: number
}

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtShort(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

export function MonthlyReportClient({ transactions, year, currentYear }: Props) {
  const router = useRouter()

  // Datos mensuales para el gráfico
  const monthlyData = useMemo(() => {
    return MONTHS.map((label, i) => {
      const month = i + 1
      const monthTxs = transactions.filter(tx => {
        const d = new Date(tx.date + 'T12:00:00')
        return d.getMonth() + 1 === month
      })
      const income   = monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_pen, 0)
      const expenses = monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_pen, 0)
      return { label, income, expenses, balance: income - expenses }
    })
  }, [transactions])

  // Gastos por categoría
  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    transactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const cat = t.categories?.name ?? 'Sin categoría'
        map.set(cat, (map.get(cat) ?? 0) + t.amount_pen)
      })
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, total]) => ({ name, total }))
  }, [transactions])

  const totalIncome   = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_pen, 0)
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_pen, 0)
  const totalBalance  = totalIncome - totalExpenses
  const totalCatSpend = byCategory.reduce((s, c) => s + c.total, 0)

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  // Exportar CSV
  function exportCSV() {
    const headers = ['Fecha', 'Tipo', 'Concepto', 'Categoría', 'Moneda', 'Monto', 'Monto PEN', 'Notas']
    const rows = [...transactions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(tx => [
        tx.date,
        tx.type === 'income' ? 'Ingreso' : 'Egreso',
        `"${tx.concept.replace(/"/g, '""')}"`,
        tx.categories?.name ?? 'Sin categoría',
        tx.currency,
        tx.amount.toFixed(2),
        tx.amount_pen.toFixed(2),
        tx.notes ? `"${tx.notes.replace(/"/g, '""')}"` : '',
      ])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `mimeta-transacciones-${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Reporte anual</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Resumen de ingresos y egresos del año</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={e => router.push(`/reports/monthly?year=${e.target.value}`)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={exportCSV}
            disabled={transactions.length === 0}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Tarjetas resumen anual */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-xl border border-border bg-card p-3 sm:p-6 shadow-sm">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Ingresos {year}</p>
          <p className="mt-1 sm:mt-2 text-base sm:text-2xl font-bold text-emerald-500 dark:text-emerald-400 truncate">
            S/ {fmt(totalIncome)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 sm:p-6 shadow-sm">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Egresos {year}</p>
          <p className="mt-1 sm:mt-2 text-base sm:text-2xl font-bold text-slate-500 dark:text-slate-400 truncate">
            S/ {fmt(totalExpenses)}
          </p>
        </div>
        <div className={`rounded-xl border p-3 sm:p-6 shadow-sm ${
          totalBalance >= 0 ? 'border-accent bg-accent' : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30'
        }`}>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Balance {year}</p>
          <p className={`mt-1 sm:mt-2 text-base sm:text-2xl font-bold truncate ${
            totalBalance >= 0 ? 'text-accent-foreground' : 'text-red-600 dark:text-red-400'
          }`}>
            S/ {fmt(totalBalance)}
          </p>
        </div>
      </div>

      {/* Gráfico barras mensual */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-5">Ingresos vs Egresos por mes</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Sin transacciones en {year}.</p>
        ) : (
          <div className="h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => `S/${fmtShort(v)}`}
                  width={60}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `S/ ${fmt(value)}`,
                    name === 'income' ? 'Ingresos' : 'Egresos',
                  ]}
                  contentStyle={{
                    fontSize: 12, borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--card)',
                    color: 'var(--foreground)',
                  }}
                />
                <Legend
                  formatter={v => v === 'income' ? 'Ingresos' : 'Egresos'}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="income"   fill="#10b981" radius={[4, 4, 0, 0]} name="income" />
                <Bar dataKey="expenses" fill="#94a3b8" radius={[4, 4, 0, 0]} name="expenses" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Gastos por categoría */}
      {byCategory.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="px-4 sm:px-6 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Egresos por categoría — {year}</h2>
          </div>
          <div className="divide-y divide-border">
            {byCategory.map(({ name, total }) => {
              const pct = totalCatSpend > 0 ? (total / totalCatSpend) * 100 : 0
              return (
                <div key={name} className="flex items-center gap-4 px-4 sm:px-6 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground truncate">{name}</span>
                      <span className="text-sm font-semibold text-foreground ml-4 shrink-0">S/ {fmt(total)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 w-10 text-right">{pct.toFixed(1)}%</span>
                </div>
              )
            })}
          </div>
          <div className="px-4 sm:px-6 py-3 border-t border-border bg-muted/30 rounded-b-xl">
            <div className="flex justify-between text-sm font-semibold text-foreground">
              <span>Total egresos</span>
              <span>S/ {fmt(totalExpenses)}</span>
            </div>
          </div>
        </div>
      )}

      {transactions.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No hay transacciones registradas en {year}.</p>
        </div>
      )}
    </div>
  )
}
