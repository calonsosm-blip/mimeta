'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { ChevronDown, FileSpreadsheet, FileText, SlidersHorizontal, X } from 'lucide-react'
import { useCurrency } from '@/hooks/useCurrency'

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
  baseCurrency: 'PEN' | 'USD'
}

const MONTHS     = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MONTHS_LONG = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmtShort(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function reportTitle(mode: Mode, year: number, month: number, from: string, to: string) {
  if (mode === 'monthly') return `${MONTHS_LONG[month - 1]} ${year}`
  if (mode === 'range')   return `${from} — ${to}`
  return `Año ${year}`
}

export function MonthlyReportClient({ transactions, mode, year, month, from, to, currentYear, currentMonth, baseCurrency }: Props) {
  const router = useRouter()
  const { sym, fromPen, fmt } = useCurrency(baseCurrency)

  // Config modal state
  const [configOpen,  setConfigOpen]  = useState(false)
  const [draftMode,   setDraftMode]   = useState<Mode>(mode)
  const [draftYear,   setDraftYear]   = useState(year)
  const [draftMonth,  setDraftMonth]  = useState(month)
  const [draftFrom,   setDraftFrom]   = useState(from)
  const [draftTo,     setDraftTo]     = useState(to)

  const [balanceView, setBalanceView] = useState<'monthly' | 'cumulative'>('monthly')

  // Export dropdown
  const [exportOpen, setExportOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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

  // Ingresos por categoría
  const byIncomeCategory = useMemo(() => {
    const map = new Map<string, number>()
    transactions.filter(t => t.type === 'income').forEach(t => {
      const cat = t.categories?.name ?? 'Sin categoría'
      map.set(cat, (map.get(cat) ?? 0) + t.amount_pen)
    })
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).map(([name, total]) => ({ name, total }))
  }, [transactions])

  // Evolución del balance (solo modo anual)
  const balanceEvolution = useMemo(() => {
    if (mode !== 'annual') return []
    let cumulative = 0
    return chartData.map(d => {
      const balance = d.income - d.expenses
      cumulative += balance
      return { label: d.label, balance, cumulative, hasData: d.income > 0 || d.expenses > 0 }
    })
  }, [chartData, mode])

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
  const totalIncomeCat = byIncomeCategory.reduce((s, c) => s + c.total, 0)
  const years         = Array.from({ length: 5 }, (_, i) => currentYear - i)

  const sortedTx = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
  const fileName  = `mimeta-reporte-${mode}-${year}`

  async function exportExcel() {
    setExportOpen(false)
    const XLSX = await import('xlsx')
    const wb   = XLSX.utils.book_new()

    // Hoja 1: Resumen
    const ws1 = XLSX.utils.aoa_to_sheet([
      ['MiMeta — Reporte'],
      ['Período', reportTitle(mode, year, month, from, to)],
      [],
      ['Ingresos (S/)', totalIncome],
      ['Egresos (S/)',  totalExpenses],
      ['Balance (S/)',  totalBalance],
    ])
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen')

    // Hoja 2: Transacciones
    const ws2 = XLSX.utils.aoa_to_sheet([
      ['Fecha','Tipo','Concepto','Categoría','Moneda','Monto','Monto PEN','Notas'],
      ...sortedTx.map(tx => [
        tx.date,
        tx.type === 'income' ? 'Ingreso' : 'Egreso',
        tx.concept,
        tx.categories?.name ?? 'Sin categoría',
        tx.currency,
        tx.amount,
        tx.amount_pen,
        tx.notes ?? '',
      ]),
    ])
    XLSX.utils.book_append_sheet(wb, ws2, 'Transacciones')

    // Hoja 3: Por categoría
    if (byCategory.length > 0) {
      const ws3 = XLSX.utils.aoa_to_sheet([
        ['Categoría','Total (S/)','%'],
        ...byCategory.map(c => [
          c.name,
          c.total,
          totalCatSpend > 0 ? +((c.total / totalCatSpend) * 100).toFixed(1) : 0,
        ]),
      ])
      XLSX.utils.book_append_sheet(wb, ws3, 'Por categoría')
    }

    XLSX.writeFile(wb, `${fileName}.xlsx`)
  }

  async function exportPDF() {
    setExportOpen(false)
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const brand: [number, number, number] = [14, 124, 74]
    const title  = reportTitle(mode, year, month, from, to)

    // Encabezado
    doc.setFontSize(20)
    doc.setTextColor(brand[0], brand[1], brand[2])
    doc.text('MiMeta', 14, 18)
    doc.setFontSize(11)
    doc.setTextColor(60, 60, 60)
    doc.text(`Reporte — ${title}`, 14, 26)

    // Resumen
    doc.setFontSize(8)
    doc.setTextColor(120, 120, 120)
    doc.text('Ingresos', 14, 37)
    doc.text('Egresos',  80, 37)
    doc.text('Balance', 146, 37)
    doc.setFontSize(12)
    doc.setTextColor(16, 185, 129)
    doc.text(`${sym} ${fmt(fromPen(totalIncome))}`, 14, 44)
    doc.setTextColor(100, 116, 139)
    doc.text(`${sym} ${fmt(fromPen(totalExpenses))}`, 80, 44)
    doc.setTextColor(totalBalance >= 0 ? 16 : 239, totalBalance >= 0 ? 185 : 68, totalBalance >= 0 ? 129 : 68)
    doc.text(`${sym} ${fmt(fromPen(totalBalance))}`, 146, 44)

    // Tabla de transacciones
    autoTable(doc, {
      startY: 52,
      head: [['Fecha','Tipo','Concepto','Categoría','Monto (S/)']],
      body: sortedTx.map(tx => [
        tx.date,
        tx.type === 'income' ? 'Ingreso' : 'Egreso',
        tx.concept,
        tx.categories?.name ?? 'Sin cat.',
        fmt(tx.amount_pen),
      ]),
      styles:            { fontSize: 8, cellPadding: 2 },
      headStyles:        { fillColor: brand, fontSize: 8, fontStyle: 'bold' },
      columnStyles:      { 4: { halign: 'right' } },
      alternateRowStyles:{ fillColor: [248, 250, 252] },
    })

    // Tabla de categorías
    if (byCategory.length > 0) {
      const lastY      = (doc as any).lastAutoTable?.finalY ?? 52
      const pageH      = doc.internal.pageSize.height
      const catStartY  = lastY + 12 > pageH - 60 ? (doc.addPage(), 14) : lastY + 12

      doc.setFontSize(11)
      doc.setTextColor(60, 60, 60)
      doc.text('Egresos por categoría', 14, catStartY)

      autoTable(doc, {
        startY: catStartY + 6,
        head: [['Categoría','Total (S/)','%']],
        body: byCategory.map(c => [
          c.name,
          fmt(c.total),
          totalCatSpend > 0 ? ((c.total / totalCatSpend) * 100).toFixed(1) + '%' : '0%',
        ]),
        styles:      { fontSize: 9 },
        headStyles:  { fillColor: brand },
        columnStyles:{ 1: { halign: 'right' }, 2: { halign: 'right' } },
      })
    }

    doc.save(`${fileName}.pdf`)
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
          {/* Dropdown exportar */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(v => !v)}
              disabled={transactions.length === 0}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              <span className="hidden sm:inline">Exportar</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                <button
                  onClick={exportExcel}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-500 shrink-0" />
                  Excel (.xlsx)
                </button>
                <button
                  onClick={exportPDF}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors border-t border-border"
                >
                  <FileText className="h-4 w-4 text-red-500 shrink-0" />
                  PDF (.pdf)
                </button>
              </div>
            )}
          </div>

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
            {sym} {fmt(fromPen(totalIncome))}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 sm:p-6 shadow-sm">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Egresos</p>
          <p className="mt-1 sm:mt-2 text-base sm:text-2xl font-bold text-slate-500 dark:text-slate-400 truncate">
            {sym} {fmt(fromPen(totalExpenses))}
          </p>
        </div>
        <div className={`rounded-xl border p-3 sm:p-6 shadow-sm ${
          totalBalance >= 0 ? 'border-accent bg-accent' : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30'
        }`}>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Balance</p>
          <p className={`mt-1 sm:mt-2 text-base sm:text-2xl font-bold truncate ${
            totalBalance >= 0 ? 'text-accent-foreground' : 'text-red-600 dark:text-red-400'
          }`}>
            {sym} {fmt(fromPen(totalBalance))}
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
                  formatter={(value, name) => [
                    `${sym} ${fmt(fromPen(Number(value)))}`,
                    String(name) === 'income' ? 'Ingresos' : 'Egresos',
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

      {/* Evolución del balance — solo modo anual */}
      {mode === 'annual' && transactions.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Evolución del balance {year}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Balance mensual (ingresos − egresos)</p>
            </div>
            <div className="flex rounded-lg border border-border overflow-hidden text-xs">
              <button
                onClick={() => setBalanceView('monthly')}
                className={`px-3 py-1.5 transition-colors ${balanceView === 'monthly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              >
                Mensual
              </button>
              <button
                onClick={() => setBalanceView('cumulative')}
                className={`px-3 py-1.5 transition-colors ${balanceView === 'cumulative' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              >
                Acumulado
              </button>
            </div>
          </div>
          <div className="h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={balanceEvolution} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `S/${fmtShort(v)}`} width={60} />
                <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
                <Tooltip
                  formatter={(value) => [`${sym} ${fmt(fromPen(Number(value)))}`, balanceView === 'monthly' ? 'Balance' : 'Acumulado']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
                />
                <Bar dataKey={balanceView === 'monthly' ? 'balance' : 'cumulative'} radius={[4, 4, 0, 0]}>
                  {balanceEvolution.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={!entry.hasData ? 'var(--muted)' : (balanceView === 'monthly' ? entry.balance : entry.cumulative) >= 0 ? 'var(--brand)' : '#ef4444'}
                      opacity={entry.hasData ? 1 : 0.4}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

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
                      <span className="text-sm font-semibold text-foreground ml-4 shrink-0">{sym} {fmt(fromPen(total))}</span>
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
              <span>{sym} {fmt(fromPen(totalExpenses))}</span>
            </div>
          </div>
        </div>
      )}

      {/* Ingresos por fuente */}
      {byIncomeCategory.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="px-4 sm:px-6 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Ingresos por fuente</h2>
          </div>
          <div className="divide-y divide-border">
            {byIncomeCategory.map(({ name, total }) => {
              const pct = totalIncomeCat > 0 ? (total / totalIncomeCat) * 100 : 0
              return (
                <div key={name} className="flex items-center gap-4 px-4 sm:px-6 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground truncate">{name}</span>
                      <span className="text-sm font-semibold text-foreground ml-4 shrink-0">{sym} {fmt(fromPen(total))}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 w-10 text-right">{pct.toFixed(1)}%</span>
                </div>
              )
            })}
          </div>
          <div className="px-4 sm:px-6 py-3 border-t border-border bg-muted/30 rounded-b-xl">
            <div className="flex justify-between text-sm font-semibold text-foreground">
              <span>Total ingresos</span>
              <span>{sym} {fmt(fromPen(totalIncome))}</span>
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
