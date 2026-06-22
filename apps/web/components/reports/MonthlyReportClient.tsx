'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Download, SlidersHorizontal, X } from 'lucide-react'

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

type Mode = 'annual' | 'monthly' | 'range'

interface Props {
  transactions: Transaction[]
  mode: Mode
  year: number
  month: number
  from: string
  to: string
  currentYear: number
  currentMonth: number
}

const MONTHS     = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MONTHS_LONG = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}
function fmtShort(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function reportTitle(mode: Mode, year: number, month: number, from: string, to: string) {
  if (mode === 'monthly') return `${MONTHS_LONG[month - 1]} ${year}`
  if (mode === 'range')   return `${from} — ${to}`
  return `Año ${year}`
}

export function MonthlyReportClient({ transactions, mode, year, month, from, to, currentYear, currentMonth }: Props) {
  const router = useRouter()

  // Config modal state
  const [configOpen,  setConfigOpen]  = useState(false)
  const [draftMode,   setDraftMode]   = useState<Mode>(mode)
  const [draftYear,   setDraftYear]   = useState(year)
  const [draftMonth,  setDraftMonth]  = useState(month)
  const [draftFrom,   setDraftFrom]   = useState(from)
  const [draftTo,     setDraftTo]     = useState(to)

  function applyConfig() {
    if (draftMode === 'annual') {
      router.push(`/reports/monthly?mode=annual&year=${draftYear}`)
    } else if (draftMode === 'monthly') {
      router.push(`/reports/monthly?mode=monthly&year=${draftYear}&month=${draftMonth}`)
    } else {
      router.push(`/reports/monthly?mode=range&from=${draftFrom}&to=${draftTo}`)
    }
    setConfigOpen(false)
  }

  // Datos del gráfico
  const chartData = useMemo(() => {
    if (mode === 'annual') {
      return MONTHS.map((label, i) => {
        const m = i + 1
        const txs = transactions.filter(tx => {
          const d = new Date(tx.date + 'T12:00:00')
          return d.getMonth() + 1 === m
        })
        return {
          label,
          income:   txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_pen, 0),
          expenses: txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_pen, 0),
        }
      })
    }

    if (mode === 'monthly') {
      const days = new Date(year, month, 0).getDate()
      return Array.from({ length: days }, (_, i) => {
        const day = i + 1
        const txs = transactions.filter(tx => new Date(tx.date + 'T12:00:00').getDate() === day)
        return {
          label:    String(day),
          income:   txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_pen, 0),
          expenses: txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_pen, 0),
        }
      })
    }

    // range — agrupar por mes
    const map = new Map<string, { income: number; expenses: number }>()
    transactions.forEach(tx => {
      const d   = new Date(tx.date + 'T12:00:00')
      const key = `${MONTHS[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`
      if (!map.has(key)) map.set(key, { income: 0, expenses: 0 })
      const entry = map.get(key)!
      if (tx.type === 'income') entry.income += tx.amount_pen
      else entry.expenses += tx.amount_pen
    })
    return Array.from(map.entries()).map(([label, v]) => ({ label, ...v }))
  }, [transactions, mode, year, month])

  // Gastos por categoría
  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const cat = t.categories?.name ?? 'Sin categoría'
      map.set(cat, (map.get(cat) ?? 0) + t.amount_pen)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([name, total]) => ({ name, total }))
  }, [transactions])

  const totalIncome   = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_pen, 0)
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_pen, 0)
  const totalBalance  = totalIncome - totalExpenses
  const totalCatSpend = byCategory.reduce((s, c) => s + c.total, 0)
  const years         = Array.from({ length: 5 }, (_, i) => currentYear - i)

  function exportCSV() {
    const headers = ['Fecha','Tipo','Concepto','Categoría','Moneda','Monto','Monto PEN','Notas']
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
    const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `mimeta-reporte-${mode}-${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const inputClass   = 'rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full'
  const selectClass  = inputClass
  const modeTabClass = (m: Mode) =>
    `flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${draftMode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Reporte</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{reportTitle(mode, year, month, from, to)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={exportCSV}
            disabled={transactions.length === 0}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
          <button
            onClick={() => setConfigOpen(true)}
            className="flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Configurar reporte"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Modal de configuración */}
      {configOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfigOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl p-6 space-y-5">

            {/* Header modal */}
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Configurar reporte</h2>
              <button onClick={() => setConfigOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Selector de modo */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Tipo de reporte</p>
              <div className="flex gap-1 p-1 rounded-xl bg-muted">
                <button className={modeTabClass('annual')}  onClick={() => setDraftMode('annual')}>Anual</button>
                <button className={modeTabClass('monthly')} onClick={() => setDraftMode('monthly')}>Mensual</button>
                <button className={modeTabClass('range')}   onClick={() => setDraftMode('range')}>Período</button>
              </div>
            </div>

            {/* Controles según modo */}
            {draftMode === 'annual' && (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-muted-foreground">Año</label>
                <select value={draftYear} onChange={e => setDraftYear(parseInt(e.target.value))} className={selectClass}>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}

            {draftMode === 'monthly' && (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-muted-foreground">Mes y año</label>
                <div className="grid grid-cols-2 gap-2">
                  <select value={draftMonth} onChange={e => setDraftMonth(parseInt(e.target.value))} className={selectClass}>
                    {MONTHS_LONG.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
                  </select>
                  <select value={draftYear} onChange={e => setDraftYear(parseInt(e.target.value))} className={selectClass}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            )}

            {draftMode === 'range' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Desde</label>
                  <input type="date" value={draftFrom} onChange={e => setDraftFrom(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Hasta</label>
                  <input type="date" value={draftTo} onChange={e => setDraftTo(e.target.value)} className={inputClass} />
                </div>
              </div>
            )}

            {/* Botones */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setConfigOpen(false)}
                className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={applyConfig}
                className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-xl border border-border bg-card p-3 sm:p-6 shadow-sm">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Ingresos</p>
          <p className="mt-1 sm:mt-2 text-base sm:text-2xl font-bold text-emerald-500 dark:text-emerald-400 truncate">
            S/ {fmt(totalIncome)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 sm:p-6 shadow-sm">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Egresos</p>
          <p className="mt-1 sm:mt-2 text-base sm:text-2xl font-bold text-slate-500 dark:text-slate-400 truncate">
            S/ {fmt(totalExpenses)}
          </p>
        </div>
        <div className={`rounded-xl border p-3 sm:p-6 shadow-sm ${
          totalBalance >= 0 ? 'border-accent bg-accent' : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30'
        }`}>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Balance</p>
          <p className={`mt-1 sm:mt-2 text-base sm:text-2xl font-bold truncate ${
            totalBalance >= 0 ? 'text-accent-foreground' : 'text-red-600 dark:text-red-400'
          }`}>
            S/ {fmt(totalBalance)}
          </p>
        </div>
      </div>

      {/* Gráfico */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-5">
          {mode === 'annual'  ? 'Ingresos vs Egresos por mes' :
           mode === 'monthly' ? 'Ingresos vs Egresos por día' :
                                'Ingresos vs Egresos por período'}
        </h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Sin transacciones en este período.</p>
        ) : (
          <div className="h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                barSize={mode === 'monthly' ? 8 : 14}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  axisLine={false} tickLine={false}
                  interval={mode === 'monthly' ? 4 : 0}
                />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={v => `S/${fmtShort(v)}`} width={60}
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
                <Legend formatter={v => v === 'income' ? 'Ingresos' : 'Egresos'} wrapperStyle={{ fontSize: 12 }} />
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
            <h2 className="text-sm font-semibold text-foreground">Egresos por categoría</h2>
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
                      <div className="h-full rounded-full bg-primary rainbow-bar transition-all" style={{ width: `${pct}%` }} />
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
          <p className="text-muted-foreground text-sm">No hay transacciones en este período.</p>
        </div>
      )}
    </div>
  )
}
