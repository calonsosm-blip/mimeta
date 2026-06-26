'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AreaChart, Area,
  ComposedChart, BarChart, Bar, Line,
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'
import { ChevronDown, Crown, FileSpreadsheet, FileText, LayoutGrid, Mail, SlidersHorizontal, X } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { UpgradePrompt } from '@/components/ui/UpgradePrompt'
import { useCurrency } from '@/hooks/useCurrency'
import { createClient } from '@/lib/supabase/client'

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
  plan: string
  historyMonths: number
  prevIncome: number
  prevExpenses: number
  budgetTotal: number
  monthlyReportEmail: boolean
  userId: string
  autoExport?: boolean
}

const SECTIONS_KEY = 'mimeta-report-sections'

const DEFAULT_SECTIONS = {
  savingsRate:          false,
  bestWorstMonth:       true,
  quarterlyBreakdown:   true,
  statsMonthly:         false,
  rangeStats:           true,
  bestWorstDay:         false,
  chartMain:            true,
  chartBalance:         true,
  rangeBalance:         false,
  weekdayDistribution:  true,
  categoryExpenses:     true,
  categorySources:      true,
  topExpenses:          false,
}

type SectionKey = keyof typeof DEFAULT_SECTIONS

const SECTION_LABELS: Record<SectionKey, string> = {
  savingsRate:          'Tasa de ahorro',
  bestWorstMonth:       'Mejor y peor mes',
  quarterlyBreakdown:   'Desglose trimestral',
  statsMonthly:         'Estadísticas del mes',
  rangeStats:           'Estadísticas del período',
  bestWorstDay:         'Mejor y peor día',
  chartMain:            'Gráfico principal',
  chartBalance:         'Balance acumulado del año',
  rangeBalance:         'Balance acumulado del período',
  weekdayDistribution:  'Distribución por día de semana',
  categoryExpenses:     'Egresos por categoría',
  categorySources:      'Ingresos por fuente',
  topExpenses:          'Top 5 gastos',
}

const SECTION_MODES: Record<SectionKey, Mode[]> = {
  savingsRate:          ['monthly', 'annual', 'range'],
  bestWorstMonth:       ['annual'],
  quarterlyBreakdown:   ['annual'],
  statsMonthly:         ['monthly'],
  rangeStats:           ['range'],
  bestWorstDay:         ['range'],
  chartMain:            ['monthly', 'annual', 'range'],
  chartBalance:         ['annual'],
  rangeBalance:         ['range'],
  weekdayDistribution:  ['range'],
  categoryExpenses:     ['monthly', 'annual', 'range'],
  categorySources:      ['monthly', 'annual', 'range'],
  topExpenses:          ['monthly', 'annual', 'range'],
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

export function MonthlyReportClient({ transactions, mode, year, month, from, to, currentYear, currentMonth, baseCurrency, plan, historyMonths, prevIncome, prevExpenses, budgetTotal, monthlyReportEmail, userId, autoExport }: Props) {
  const router = useRouter()
  const { sym, fromPen, fmt } = useCurrency(baseCurrency)

  const isPremium = plan === 'premium'

  // Config modal state
  const [configOpen,  setConfigOpen]  = useState(false)
  const [draftMode,   setDraftMode]   = useState<Mode>(mode)
  const [draftYear,   setDraftYear]   = useState(year)
  const [draftMonth,  setDraftMonth]  = useState(month)
  const [draftFrom,   setDraftFrom]   = useState(from)
  const [draftTo,     setDraftTo]     = useState(to)

  const [reportEmail,      setReportEmail]      = useState(monthlyReportEmail)
  const [savingEmail,      setSavingEmail]      = useState(false)
  const [confirmEmailOpen, setConfirmEmailOpen] = useState(false)
  const [upgradeOpen,   setUpgradeOpen]   = useState(false)
  const [upgradeReason, setUpgradeReason] = useState<'mode' | 'history'>('mode')
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [sections, setSections] = useState<typeof DEFAULT_SECTIONS>(DEFAULT_SECTIONS)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SECTIONS_KEY)
      if (saved) setSections({ ...DEFAULT_SECTIONS, ...JSON.parse(saved) })
    } catch {}
  }, [])

  function toggleReportEmail() {
    if (!isPremium) { setUpgradeReason('mode'); setUpgradeOpen(true); return }
    setConfirmEmailOpen(true)
  }

  async function confirmReportEmail() {
    setConfirmEmailOpen(false)
    setSavingEmail(true)
    const supabase = createClient()
    const next = !reportEmail
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any).update({ monthly_report_email: next }).eq('id', userId)
    setReportEmail(next)
    setSavingEmail(false)
  }

  function toggleSection(key: SectionKey) {
    setSections(prev => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem(SECTIONS_KEY, JSON.stringify(next))
      return next
    })
  }

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

  const exportPDFRef = useRef(exportPDF)
  useEffect(() => { exportPDFRef.current = exportPDF })

  useEffect(() => {
    if (!autoExport) return
    const timer = setTimeout(() => exportPDFRef.current(), 2500)
    return () => clearTimeout(timer)
  }, [])

  function applyConfig() {
    if (draftMode === 'monthly' && !isPremium) {
      const minDate  = new Date(currentYear, currentMonth - historyMonths, 1)
      const selected = new Date(draftYear, draftMonth - 1, 1)
      if (selected < minDate) {
        setConfigOpen(false)
        setUpgradeReason('history')
        setUpgradeOpen(true)
        return
      }
    }
    if (draftMode === 'annual') {
      router.push(`/reports/monthly?mode=annual&year=${draftYear}`)
    } else if (draftMode === 'monthly') {
      router.push(`/reports/monthly?mode=monthly&year=${draftYear}&month=${draftMonth}`)
    } else {
      router.push(`/reports/monthly?mode=range&from=${draftFrom}&to=${draftTo}`)
    }
    setConfigOpen(false)
  }

  // Variables de tiempo
  const daysInMonth    = mode === 'monthly' ? new Date(year, month, 0).getDate() : 0
  const isCurrentMonth = mode === 'monthly' && year === currentYear && month === currentMonth
  const currentDay     = isCurrentMonth ? new Date().getDate() : daysInMonth

  // Range: granularidad automática (≤ 45 días → por día, > 45 → por mes)
  const rangeDays  = mode === 'range' ? Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1 : 0
  const rangeByDay = mode === 'range' && rangeDays > 0 && rangeDays <= 45

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

  // Annual: mejor y peor mes, promedio, trimestres
  const annualBalances = mode === 'annual'
    ? chartData
        .map((d, i) => ({ label: MONTHS_LONG[i], balance: d.income - d.expenses, hasData: d.income > 0 || d.expenses > 0 }))
        .filter(m => m.hasData)
    : []
  const bestMonth  = annualBalances.length > 0 ? annualBalances.reduce((a, b) => a.balance > b.balance ? a : b) : null
  const worstMonth = annualBalances.length > 0 ? annualBalances.reduce((a, b) => a.balance < b.balance ? a : b) : null

  // Regresión polinomial grado 2 sobre el balance mensual (curva tipo exponencial)
  const annualChartData = useMemo(() => {
    const points = chartData
      .map((d, i) => ({ x: i, y: d.income - d.expenses, hasData: d.income > 0 || d.expenses > 0 }))
      .filter(p => p.hasData)

    let polyFn: ((x: number) => number) | null = null

    if (points.length >= 3) {
      // Ecuaciones normales para y = c0 + c1*x + c2*x²
      const sums = [0, 0, 0, 0, 0].map(() => 0)
      const [s0, s1, s2, s3, s4] = [
        points.length,
        points.reduce((s, p) => s + p.x, 0),
        points.reduce((s, p) => s + p.x ** 2, 0),
        points.reduce((s, p) => s + p.x ** 3, 0),
        points.reduce((s, p) => s + p.x ** 4, 0),
      ]
      void sums
      const [t0, t1, t2] = [
        points.reduce((s, p) => s + p.y, 0),
        points.reduce((s, p) => s + p.y * p.x, 0),
        points.reduce((s, p) => s + p.y * p.x ** 2, 0),
      ]
      // Gauss-Jordan 3x3
      const m = [
        [s0, s1, s2, t0],
        [s1, s2, s3, t1],
        [s2, s3, s4, t2],
      ]
      for (let i = 0; i < 3; i++) {
        let max = i
        for (let k = i + 1; k < 3; k++) if (Math.abs(m[k][i]) > Math.abs(m[max][i])) max = k;
        [m[i], m[max]] = [m[max], m[i]]
        for (let k = i + 1; k < 3; k++) {
          const f = m[k][i] / m[i][i]
          for (let j = i; j <= 3; j++) m[k][j] -= f * m[i][j]
        }
      }
      const c = [0, 0, 0]
      for (let i = 2; i >= 0; i--) {
        c[i] = m[i][3] / m[i][i]
        for (let k = i - 1; k >= 0; k--) m[k][3] -= m[k][i] * c[i]
      }
      polyFn = (x: number) => c[0] + c[1] * x + c[2] * x ** 2
    } else if (points.length === 2) {
      // Con 2 puntos solo cabe recta
      const dx = points[1].x - points[0].x
      const slope = dx !== 0 ? (points[1].y - points[0].y) / dx : 0
      const intercept = points[0].y - slope * points[0].x
      polyFn = (x: number) => slope * x + intercept
    }

    const lastIdx = points.length > 0 ? points[points.length - 1].x : -1

    return chartData.map((d, i) => ({
      ...d,
      balance: d.income - d.expenses,
      trend:   polyFn && i <= lastIdx ? polyFn(i) : null,
    }))
  }, [chartData])

  const quarters = mode === 'annual' ? [
    { label: 'Q1', months: [1, 2, 3],   period: 'Ene–Mar' },
    { label: 'Q2', months: [4, 5, 6],   period: 'Abr–Jun' },
    { label: 'Q3', months: [7, 8, 9],   period: 'Jul–Sep' },
    { label: 'Q4', months: [10, 11, 12], period: 'Oct–Dic' },
  ].map(({ label, months, period }) => {
    const qtxs     = transactions.filter(t => months.includes(new Date(t.date + 'T12:00:00').getMonth() + 1))
    const income   = qtxs.filter(t => t.type === 'income').reduce((s, t)  => s + t.amount_pen, 0)
    const expenses = qtxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_pen, 0)
    return { label, period, income, expenses, balance: income - expenses, hasData: income > 0 || expenses > 0 }
  }) : []

  // Range: datos por día cuando el rango es corto (debe ir primero — lo usan los siguientes)
  const rangeChartData = useMemo(() => {
    if (!rangeByDay) return []
    const fromDate = new Date(from + 'T12:00:00')
    return Array.from({ length: rangeDays }, (_, i) => {
      const date = new Date(fromDate.getTime())
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().slice(0, 10)
      const dayTxs  = transactions.filter(t => t.date === dateStr)
      return {
        label:    `${date.getDate()}/${date.getMonth() + 1}`,
        income:   dayTxs.filter(t => t.type === 'income').reduce((s, t)  => s + t.amount_pen, 0),
        expenses: dayTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_pen, 0),
      }
    })
  }, [transactions, rangeByDay, rangeDays, from])

  // Range: datos del gráfico principal con balance acumulado embebido
  const rangeMainData = useMemo(() => {
    if (mode !== 'range') return []
    const base = rangeByDay ? rangeChartData : chartData
    let cum = 0
    return base.map(d => {
      cum += d.income - d.expenses
      return { ...d, cumBalance: cum }
    })
  }, [mode, rangeByDay, rangeChartData, chartData])

  // Range: mejor y peor día por egresos
  const dayExpenses = useMemo(() => {
    if (mode !== 'range') return []
    const map = new Map<string, number>()
    transactions.filter(t => t.type === 'expense').forEach(t => {
      map.set(t.date, (map.get(t.date) ?? 0) + t.amount_pen)
    })
    return Array.from(map.entries()).map(([date, total]) => {
      const d = new Date(date + 'T12:00:00')
      return { label: `${d.getDate()} ${MONTHS[d.getMonth()]}`, total }
    })
  }, [transactions, mode])
  const highestExpDay = dayExpenses.length > 0 ? dayExpenses.reduce((a, b) => a.total > b.total ? a : b) : null
  const lowestExpDay  = dayExpenses.length > 0 ? dayExpenses.reduce((a, b) => a.total < b.total ? a : b) : null

  // Range: balance acumulado del período
  const rangeBalanceData = useMemo(() => {
    if (mode !== 'range') return []
    let cum = 0
    if (rangeByDay) {
      return rangeChartData.map(d => {
        cum += d.income - d.expenses
        return { label: d.label, balance: cum }
      })
    }
    return chartData.map(d => {
      cum += d.income - d.expenses
      return { label: d.label, balance: cum, hasData: d.income > 0 || d.expenses > 0 }
    })
  }, [mode, rangeByDay, rangeChartData, chartData])

  // Range: distribución de egresos por día de semana
  const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
  const weekdayData = useMemo(() => {
    if (mode !== 'range') return []
    const totals = [0, 0, 0, 0, 0, 0, 0]
    const counts  = [0, 0, 0, 0, 0, 0, 0]
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const d   = new Date(t.date + 'T12:00:00').getDay()
      const idx = d === 0 ? 6 : d - 1
      totals[idx] += t.amount_pen
      counts[idx]++
    })
    const max = Math.max(...totals, 1)
    return WEEKDAYS.map((label, i) => ({
      label,
      total:   totals[i],
      avg:     counts[i] > 0 ? totals[i] / counts[i] : 0,
      pct:     (totals[i] / max) * 100,
      txCount: counts[i],
    }))
  }, [transactions, mode])

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

  // Tasa de ahorro
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : null

  // Comparativa vs período anterior
  const hasPrev = prevIncome > 0 || prevExpenses > 0
  function pctDiff(current: number, prev: number) {
    if (prev === 0) return null
    return ((current - prev) / prev) * 100
  }
  const prevBalance   = prevIncome - prevExpenses
  const incomePct     = hasPrev ? pctDiff(totalIncome, prevIncome) : null
  const expensesPct   = hasPrev ? pctDiff(totalExpenses, prevExpenses) : null
  const balancePct    = hasPrev ? pctDiff(totalBalance, prevBalance) : null

  // Top 5 gastos individuales
  const topExpenses = [...transactions]
    .filter(t => t.type === 'expense')
    .sort((a, b) => b.amount_pen - a.amount_pen)
    .slice(0, 5)

  // Stats mensuales: promedio diario, proyección, núm. transacciones
  const avgDailyExpense   = mode === 'monthly' && currentDay > 0 ? totalExpenses / currentDay : 0
  const daysRemaining     = isCurrentMonth ? daysInMonth - currentDay : 0
  const projectedExpenses = isCurrentMonth && currentDay > 0 ? (totalExpenses / currentDay) * daysInMonth : 0
  const projectedBalance  = isCurrentMonth ? totalIncome - projectedExpenses : 0

  // Egresos acumulados por día (modo mensual)
  const cumulativeData = useMemo(() => {
    if (mode !== 'monthly') return []
    const maxDay = isCurrentMonth ? currentDay : daysInMonth
    let cum = 0
    const byDay: number[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      if (d <= maxDay) {
        cum += transactions
          .filter(t => t.type === 'expense' && new Date(t.date + 'T12:00:00').getDate() === d)
          .reduce((s, t) => s + t.amount_pen, 0)
      }
      byDay.push(cum)
    }
    const atToday = byDay[maxDay - 1] ?? 0
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1
      return {
        day: String(d),
        actual: d <= maxDay ? byDay[d - 1] : null,
        proj:   isCurrentMonth && d >= currentDay
          ? atToday + (d - currentDay) * avgDailyExpense
          : null,
      }
    })
  }, [transactions, mode, daysInMonth, isCurrentMonth, currentDay, avgDailyExpense])

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
    const { default: jsPDF }    = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const { default: html2canvas } = await import('html2canvas')

    const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const brand: [number, number, number] = [14, 124, 74]
    const gray:  [number, number, number] = [60, 60, 60]
    const muted: [number, number, number] = [120, 120, 120]
    const M     = 14                              // margen izquierdo/derecho
    const pageW = doc.internal.pageSize.width
    const pageH = doc.internal.pageSize.height
    const cW    = pageW - M * 2                   // ancho útil
    const title = reportTitle(mode, year, month, from, to)

    // ── Utilidades ────────────────────────────────────────────────
    let curY = M

    const newPage = () => { doc.addPage(); curY = M }
    const gap  = (n = 6) => { curY += n }
    const need = (h: number) => { if (curY + h > pageH - 18) newPage() }

    const secTitle = (text: string) => {
      need(14)
      curY += 2
      doc.setFontSize(11).setTextColor(...gray).setFont('helvetica', 'bold')
      doc.text(text, M, curY)
      doc.setFont('helvetica', 'normal')
      curY += 6
    }

    const addTable = (head: string[][], body: (string|number)[][], colStyles: Record<number, object> = {}) => {
      need(20)
      autoTable(doc, {
        startY: curY,
        head, body,
        styles:             { fontSize: 9, cellPadding: 2.5, overflow: 'ellipsize' },
        headStyles:         { fillColor: brand, fontSize: 9, fontStyle: 'bold', textColor: 255 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles:       colStyles,
        margin:             { left: M, right: M },
        didParseCell:       (data: any) => {
          // Aplicar alineación de columnStyles también a las celdas del encabezado
          if (data.row.section === 'head') {
            const cs = colStyles[data.column.index] as any
            if (cs?.halign) data.cell.styles.halign = cs.halign
          }
        },
        didDrawPage:        (d: any) => { curY = d.cursor.y },
      })
      curY = (doc as any).lastAutoTable.finalY + 6
    }

    // Mapa de CSS variables → valores hex modo claro
    const lightVars: Record<string, string> = {
      'var(--border)':           '#e2e8f0',
      'var(--muted-foreground)': '#64748b',
      'var(--muted)':            '#f1f5f9',
      'var(--foreground)':       '#0f172a',
      'var(--card)':             '#ffffff',
      'var(--background)':       '#f8fafc',
      'var(--brand)':            '#0e7c4a',
    }

    // Extrae el SVG principal de Recharts del elemento indicado,
    // lo corrige (colores, fondo) y lo renderiza en canvas de alta resolución.
    const addChart = async (id: string, maxH = 90) => {
      const el = document.getElementById(id)
      if (!el) return
      try {
        // Buscar el SVG de Recharts (recharts-surface o simplemente el svg más grande)
        const svgs = Array.from(el.querySelectorAll<SVGSVGElement>('svg'))
        const chartSvg = svgs.find(s => parseFloat(s.getAttribute('width') || '0') > 100)
        if (!chartSvg) return

        const origW = parseFloat(chartSvg.getAttribute('width') || '800')
        const origH = parseFloat(chartSvg.getAttribute('height') || '300')

        // Clonar SVG y prepararlo para exportación
        const clone = chartSvg.cloneNode(true) as SVGSVGElement
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
        clone.setAttribute('viewBox', `0 0 ${origW} ${origH}`)
        clone.setAttribute('width',  String(origW))
        clone.setAttribute('height', String(origH))

        // Fondo blanco
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
        bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%')
        bg.setAttribute('fill', '#ffffff')
        clone.insertBefore(bg, clone.firstChild)

        // Reemplazar var(--xxx) en atributos de presentación SVG
        clone.querySelectorAll<SVGElement>('[stroke],[fill],[stop-color]').forEach(e => {
          const s = e.getAttribute('stroke')
          const f = e.getAttribute('fill')
          const sc = e.getAttribute('stop-color')
          if (s  && lightVars[s])  e.setAttribute('stroke',     lightVars[s])
          if (f  && lightVars[f])  e.setAttribute('fill',       lightVars[f])
          if (sc && lightVars[sc]) e.setAttribute('stop-color', lightVars[sc])
        })

        // Texto de ejes: color y tamaño mínimo 11px para legibilidad en PDF
        clone.querySelectorAll<SVGElement>('text, tspan').forEach(e => {
          e.setAttribute('fill', '#475569')
          const fs = parseFloat(e.getAttribute('font-size') || e.style.fontSize || '10')
          const newFs = Math.max(fs, 11)
          e.setAttribute('font-size', String(newFs))
          e.style.fontSize = `${newFs}px`
          e.style.fill = '#475569'
          // Fuente segura (sistema, siempre disponible en canvas)
          e.style.fontFamily = 'Arial, Helvetica, sans-serif'
        })

        // Serializar SVG → blob URL → dibujar en canvas de alta resolución
        const svgStr  = new XMLSerializer().serializeToString(clone)
        const blob    = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
        const blobUrl = URL.createObjectURL(blob)

        const RENDER_SCALE = 4
        const offCanvas = document.createElement('canvas')
        offCanvas.width  = origW * RENDER_SCALE
        offCanvas.height = origH * RENDER_SCALE
        const ctx = offCanvas.getContext('2d')!
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, offCanvas.width, offCanvas.height)
        ctx.scale(RENDER_SCALE, RENDER_SCALE)

        await new Promise<void>(resolve => {
          const img = new Image()
          img.onload  = () => { ctx.drawImage(img, 0, 0, origW, origH); resolve() }
          img.onerror = () => resolve()
          img.src = blobUrl
        })
        URL.revokeObjectURL(blobUrl)

        const pngData = offCanvas.toDataURL('image/png')
        const imgW    = cW
        const imgH    = Math.min(imgW * (origH / origW), maxH)
        need(imgH + 4)
        doc.addImage(pngData, 'PNG', M, curY, imgW, imgH)
        curY += imgH + 6
      } catch { /* ignorar errores de captura */ }
    }

    // Texto con truncado automático si supera el ancho disponible
    const safeText = (text: string, x: number, y: number, maxW: number) => {
      const lines = doc.splitTextToSize(text, maxW)
      doc.text(lines[0], x, y)
    }

    // ── Encabezado ──────────────────────────────────────────────
    doc.setFontSize(18).setTextColor(...brand).setFont('helvetica', 'bold')
    doc.text('MiMeta', M, curY); curY += 7
    doc.setFontSize(10).setTextColor(...gray).setFont('helvetica', 'normal')
    doc.text(`Reporte — ${title}`, M, curY)
    doc.setFontSize(8).setTextColor(...muted)
    doc.text(`Generado el ${new Date().toLocaleDateString('es-PE')}`, pageW - M, curY, { align: 'right' })
    curY += 4
    doc.setDrawColor(220, 220, 220).line(M, curY, pageW - M, curY)
    curY += 6

    // ── Cards resumen ────────────────────────────────────────────
    const cardData = [
      { label: 'Ingresos',     value: `${sym} ${fmt(fromPen(totalIncome))}`,   rgb: [16,185,129]  as [number,number,number] },
      { label: 'Egresos',      value: `${sym} ${fmt(fromPen(totalExpenses))}`, rgb: [100,116,139] as [number,number,number] },
      { label: 'Balance',      value: `${sym} ${fmt(fromPen(totalBalance))}`,  rgb: (totalBalance >= 0 ? [16,185,129] : [239,68,68]) as [number,number,number] },
      ...(sections.savingsRate && savingsRate !== null
        ? [{ label: 'Tasa ahorro', value: `${savingsRate.toFixed(1)}%`,
             rgb: (savingsRate >= 20 ? [16,185,129] : savingsRate >= 0 ? [245,158,11] : [239,68,68]) as [number,number,number] }]
        : []),
    ]
    const nCards  = cardData.length
    const cardW   = (cW - (nCards - 1) * 2) / nCards
    const cardH   = 14
    cardData.forEach((c, i) => {
      const cx = M + i * (cardW + 2)
      doc.setDrawColor(220, 220, 220).setFillColor(248, 250, 252)
      doc.roundedRect(cx, curY, cardW, cardH, 1.5, 1.5, 'FD')
      doc.setFontSize(6.5).setTextColor(...muted)
      doc.text(c.label, cx + 2.5, curY + 4.5)
      doc.setFontSize(8.5).setTextColor(...c.rgb).setFont('helvetica', 'bold')
      safeText(c.value, cx + 2.5, curY + 10.5, cardW - 5)
      doc.setFont('helvetica', 'normal')
    })
    curY += cardH + 6

    // ── Comparativa vs período anterior ─────────────────────────
    if (hasPrev) {
      const compRows: string[][] = []
      const pctStr = (v: number) => `${v >= 0 ? '(+)' : '(-)'} ${Math.abs(v).toFixed(1)}%`
      if (incomePct !== null)   compRows.push(['Ingresos',  `${sym} ${fmt(fromPen(prevIncome))}`,   `${sym} ${fmt(fromPen(totalIncome))}`,   pctStr(incomePct)])
      if (expensesPct !== null) compRows.push(['Egresos',   `${sym} ${fmt(fromPen(prevExpenses))}`, `${sym} ${fmt(fromPen(totalExpenses))}`, pctStr(expensesPct)])
      if (balancePct !== null)  compRows.push(['Balance',   `${sym} ${fmt(fromPen(prevBalance))}`,  `${sym} ${fmt(fromPen(totalBalance))}`,  pctStr(balancePct)])
      if (compRows.length > 0) {
        secTitle('Comparativa vs período anterior')
        addTable([['Métrica','Anterior','Actual','Variación']], compRows, { 3: { halign: 'center' as const } })
      }
    }

    // ── Gráfico principal ─────────────────────────────────────────
    if (sections.chartMain && transactions.length > 0) {
      secTitle(mode === 'monthly' ? 'Egresos acumulados del mes'
               : mode === 'annual' ? 'Resultado por mes'
               : rangeByDay ? 'Ingresos vs Egresos por día' : 'Ingresos vs Egresos por período')
      await addChart('pdf-chart-main', 95)
    }

    // ── Stats mensuales ──────────────────────────────────────────
    if (sections.statsMonthly && mode === 'monthly' && transactions.length > 0) {
      secTitle('Estadísticas del mes')
      const rows: string[][] = [
        ['Transacciones', String(transactions.length), 'Prom. diario gasto', `${sym} ${fmt(fromPen(avgDailyExpense))}`],
      ]
      if (isCurrentMonth && daysRemaining > 0)
        rows.push(['Días restantes', String(daysRemaining), 'Proyección fin de mes', `${sym} ${fmt(fromPen(projectedBalance))}`])
      addTable([['Métrica','Valor','Métrica','Valor']], rows)
    }

    // ── Stats del período (range) ────────────────────────────────
    if (sections.rangeStats && mode === 'range') {
      secTitle('Estadísticas del período')
      addTable(
        [['Duración','Prom. diario gasto','Transacciones']],
        [[`${rangeDays} días`, `${sym} ${fmt(fromPen(rangeDays > 0 ? totalExpenses / rangeDays : 0))}`, String(transactions.length)]],
      )
    }

    // ── Mejor y peor mes (annual) ────────────────────────────────
    if (sections.bestWorstMonth && mode === 'annual' && bestMonth && worstMonth) {
      secTitle('Destacados del año')
      addTable(
        [['','Mes','Balance']],
        [
          ['Mejor mes', bestMonth.label,  `+${sym} ${fmt(fromPen(bestMonth.balance))}`],
          ['Peor mes',  worstMonth.label, `${worstMonth.balance >= 0 ? '+' : ''}${sym} ${fmt(fromPen(worstMonth.balance))}`],
        ],
      )
    }

    // ── Desglose trimestral ──────────────────────────────────────
    if (sections.quarterlyBreakdown && mode === 'annual' && quarters.some(q => q.hasData)) {
      secTitle('Desglose trimestral')
      addTable(
        [['Trimestre','Período','Ingresos','Egresos','Balance']],
        quarters.map(q => [q.label, q.period, `${sym} ${fmt(fromPen(q.income))}`, `${sym} ${fmt(fromPen(q.expenses))}`, `${q.balance >= 0 ? '+' : ''}${sym} ${fmt(fromPen(q.balance))}`]),
        { 2: { halign: 'right' as const }, 3: { halign: 'right' as const }, 4: { halign: 'right' as const } },
      )
    }

    // ── Balance acumulado anual ──────────────────────────────────
    if (sections.chartBalance && mode === 'annual' && transactions.length > 0) {
      secTitle(`Balance acumulado ${year}`)
      await addChart('pdf-chart-balance', 90)
    }

    // ── Mejor y peor día (range) ─────────────────────────────────
    if (sections.bestWorstDay && mode === 'range' && highestExpDay && lowestExpDay && dayExpenses.length > 1) {
      secTitle('Destacados del período')
      addTable(
        [['','Día','Gasto']],
        [
          ['Mayor gasto', highestExpDay.label, `${sym} ${fmt(fromPen(highestExpDay.total))}`],
          ['Menor gasto', lowestExpDay.label,  `${sym} ${fmt(fromPen(lowestExpDay.total))}`],
        ],
      )
    }

    // ── Balance acumulado del período (range) ────────────────────
    if (sections.rangeBalance && mode === 'range' && rangeBalanceData.length > 0) {
      secTitle('Balance acumulado del período')
      await addChart('pdf-chart-range-balance', 85)
    }

    // ── Distribución por día de semana ───────────────────────────
    if (sections.weekdayDistribution && mode === 'range' && weekdayData.some(d => d.total > 0)) {
      secTitle('Gastos por día de semana')
      addTable(
        [['Día','Total gasto','Transacciones']],
        weekdayData.filter(d => d.total > 0).map(d => [d.label, `${sym} ${fmt(fromPen(d.total))}`, String(d.txCount)]),
        { 1: { halign: 'right' as const }, 2: { halign: 'right' as const } },
      )
    }

    // ── Egresos por categoría ────────────────────────────────────
    if (sections.categoryExpenses && byCategory.length > 0) {
      secTitle('Egresos por categoría')
      addTable(
        [['Categoría','Total','%']],
        byCategory.map(c => [c.name, `${sym} ${fmt(fromPen(c.total))}`, totalCatSpend > 0 ? ((c.total/totalCatSpend)*100).toFixed(1)+'%' : '0%']),
        { 1: { halign: 'center' as const }, 2: { halign: 'center' as const } },
      )
    }

    // ── Ingresos por fuente ──────────────────────────────────────
    if (sections.categorySources && byIncomeCategory.length > 0) {
      secTitle('Ingresos por fuente')
      addTable(
        [['Fuente','Total','%']],
        byIncomeCategory.map(c => [c.name, `${sym} ${fmt(fromPen(c.total))}`, totalIncomeCat > 0 ? ((c.total/totalIncomeCat)*100).toFixed(1)+'%' : '0%']),
        { 1: { halign: 'center' as const }, 2: { halign: 'center' as const } },
      )
    }

    // ── Top 5 gastos ─────────────────────────────────────────────
    if (sections.topExpenses && topExpenses.length > 0) {
      secTitle('Top 5 gastos del período')
      addTable(
        [['#','Fecha','Concepto','Categoría','Monto']],
        topExpenses.map((tx, i) => [String(i+1), tx.date, tx.concept, tx.categories?.name ?? '—', `${sym} ${fmt(fromPen(tx.amount_pen))}`]),
        { 2: { cellWidth: 50, overflow: 'ellipsize' as const }, 4: { halign: 'right' as const } },
      )
    }

    // ── Detalle de transacciones ─────────────────────────────────
    secTitle('Detalle de transacciones')
    addTable(
      [['Fecha','Tipo','Concepto','Categoría','Monto']],
      sortedTx.map(tx => [
        tx.date,
        tx.type === 'income' ? 'Ingreso' : 'Egreso',
        tx.concept,
        tx.categories?.name ?? '—',
        `${sym} ${fmt(fromPen(tx.amount_pen))}`,
      ]),
      { 2: { cellWidth: 50, overflow: 'ellipsize' as const }, 4: { halign: 'right' as const } },
    )

    // ── Pie de página ────────────────────────────────────────────
    const totalPages = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(7).setTextColor(...muted)
      doc.text('MiMeta — reporte financiero personal', M, pageH - 7)
      doc.text(`Página ${i} / ${totalPages}`, pageW - M, pageH - 7, { align: 'right' })
    }

    doc.save(`${fileName}.pdf`)
  }

  const inputClass   = 'rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-full'
  const selectClass  = inputClass
  const modeTabClass = (m: Mode, locked = false) =>
    `flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${
      locked ? 'text-muted-foreground hover:bg-muted/60' :
      draftMode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
    }`

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
            onClick={toggleReportEmail}
            disabled={savingEmail}
            title={isPremium
              ? reportEmail ? 'Reporte por email activo — click para desactivar' : 'Activar reporte mensual por email'
              : 'Reporte mensual por email (Premium)'}
            className={`relative flex items-center justify-center h-9 w-9 rounded-lg border transition-colors disabled:opacity-50 ${
              reportEmail && isPremium
                ? 'border-primary bg-primary/10 text-primary hover:bg-primary/20'
                : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Mail className="h-4 w-4" />
            {!isPremium && <Crown className="h-2.5 w-2.5 text-amber-400 absolute -top-1 -right-1" />}
          </button>
          <button
            onClick={() => setCustomizeOpen(true)}
            className="flex items-center justify-center h-9 w-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Personalizar vista"
          >
            <LayoutGrid className="h-4 w-4" />
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
                <button className={modeTabClass('monthly')} onClick={() => setDraftMode('monthly')}>Mensual</button>
                <button
                  className={modeTabClass('annual', !isPremium)}
                  onClick={() => isPremium ? setDraftMode('annual') : (setConfigOpen(false), setUpgradeReason('mode'), setUpgradeOpen(true))}
                >
                  Anual {!isPremium && <Crown className="h-3 w-3 text-amber-400" />}
                </button>
                <button
                  className={modeTabClass('range', !isPremium)}
                  onClick={() => isPremium ? setDraftMode('range') : (setConfigOpen(false), setUpgradeReason('mode'), setUpgradeOpen(true))}
                >
                  Período {!isPremium && <Crown className="h-3 w-3 text-amber-400" />}
                </button>
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
                {/* Presets */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Acceso rápido</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: 'Últimos 7 días',  days: 7 },
                      { label: 'Últimos 30 días', days: 30 },
                      { label: 'Últimos 90 días', days: 90 },
                    ].map(({ label, days }) => {
                      const to   = new Date()
                      const from = new Date(); from.setDate(from.getDate() - days + 1)
                      const fmt  = (d: Date) => d.toISOString().slice(0, 10)
                      return (
                        <button key={label}
                          onClick={() => { setDraftFrom(fmt(from)); setDraftTo(fmt(to)) }}
                          className="rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left"
                        >{label}</button>
                      )
                    })}
                    {(() => {
                      const now = new Date()
                      const q   = Math.floor(now.getMonth() / 3)
                      const from = new Date(now.getFullYear(), q * 3, 1)
                      const to   = new Date(now.getFullYear(), q * 3 + 3, 0)
                      const fmt  = (d: Date) => d.toISOString().slice(0, 10)
                      return (
                        <button
                          onClick={() => { setDraftFrom(fmt(from)); setDraftTo(fmt(to)) }}
                          className="rounded-lg border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-left"
                        >Este trimestre</button>
                      )
                    })()}
                  </div>
                </div>
                {/* Fechas manuales */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Desde</label>
                    <input type="date" value={draftFrom} onChange={e => setDraftFrom(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Hasta</label>
                    <input type="date" value={draftTo} onChange={e => setDraftTo(e.target.value)} className={inputClass} />
                  </div>
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

      {/* Modal de personalización */}
      {customizeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setCustomizeOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Personalizar vista</h2>
              <button onClick={() => setCustomizeOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Elige qué secciones mostrar en el reporte.</p>
            <div className="space-y-1">
              {(Object.keys(DEFAULT_SECTIONS) as SectionKey[])
                .filter(key => SECTION_MODES[key].includes(mode))
                .map(key => (
                  <button
                    key={key}
                    onClick={() => toggleSection(key)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted transition-colors"
                  >
                    <span className="text-sm text-foreground">{SECTION_LABELS[key]}</span>
                    <div className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${sections[key] ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${sections[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                  </button>
                ))}
            </div>
            <button
              onClick={() => {
                setSections(DEFAULT_SECTIONS)
                localStorage.removeItem(SECTIONS_KEY)
              }}
              className="w-full rounded-lg border border-border py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              Restaurar predeterminado
            </button>
          </div>
        </div>
      )}

      {/* Tarjetas resumen */}
      <div className={`grid gap-2 sm:gap-4 ${sections.savingsRate ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        {/* Ingresos */}
        <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-sm">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Ingresos</p>
          <p className="mt-1 text-base sm:text-xl font-bold text-emerald-500 dark:text-emerald-400 truncate">
            {sym} {fmt(fromPen(totalIncome))}
          </p>
          {incomePct !== null && (
            <p className={`mt-1 text-xs font-medium ${incomePct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {incomePct >= 0 ? '↑' : '↓'} {Math.abs(incomePct).toFixed(1)}% vs anterior
            </p>
          )}
        </div>

        {/* Egresos */}
        <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-sm">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Egresos</p>
          <p className="mt-1 text-base sm:text-xl font-bold text-slate-500 dark:text-slate-400 truncate">
            {sym} {fmt(fromPen(totalExpenses))}
          </p>
          {expensesPct !== null && (
            <p className={`mt-1 text-xs font-medium ${expensesPct <= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {expensesPct >= 0 ? '↑' : '↓'} {Math.abs(expensesPct).toFixed(1)}% vs anterior
            </p>
          )}
        </div>

        {/* Balance */}
        <div className={`rounded-xl border p-3 sm:p-5 shadow-sm ${
          totalBalance >= 0 ? 'border-accent bg-accent' : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30'
        }`}>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Balance</p>
          <p className={`mt-1 text-base sm:text-xl font-bold truncate ${
            totalBalance >= 0 ? 'text-accent-foreground' : 'text-red-600 dark:text-red-400'
          }`}>
            {sym} {fmt(fromPen(totalBalance))}
          </p>
          {balancePct !== null && (
            <p className={`mt-1 text-xs font-medium ${balancePct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {balancePct >= 0 ? '↑' : '↓'} {Math.abs(balancePct).toFixed(1)}% vs anterior
            </p>
          )}
        </div>

        {/* Tasa de ahorro */}
        {sections.savingsRate && <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-sm">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Tasa de ahorro</p>
          <p className={`mt-1 text-base sm:text-xl font-bold truncate ${
            savingsRate === null ? 'text-muted-foreground' :
            savingsRate >= 20 ? 'text-emerald-500 dark:text-emerald-400' :
            savingsRate >= 0  ? 'text-amber-500 dark:text-amber-400' :
            'text-red-500 dark:text-red-400'
          }`}>
            {savingsRate === null ? '—' : `${savingsRate.toFixed(1)}%`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {savingsRate === null ? 'Sin ingresos' :
             savingsRate >= 20 ? 'Excelente' :
             savingsRate >= 10 ? 'Aceptable' :
             savingsRate >= 0  ? 'Mejorable' : 'Déficit'}
          </p>
        </div>}
      </div>

      {/* Mejor / Peor mes — solo modo anual */}
      {sections.bestWorstMonth && mode === 'annual' && bestMonth && worstMonth && annualBalances.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4">Destacados del año</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-3 sm:p-4">
              <p className="text-xs text-muted-foreground mb-1">Mejor mes</p>
              <p className="text-sm font-semibold text-foreground">{bestMonth.label}</p>
              <p className="mt-0.5 text-base font-bold text-emerald-500 dark:text-emerald-400">
                +{sym} {fmt(fromPen(bestMonth.balance))}
              </p>
            </div>
            <div className={`rounded-xl border p-3 sm:p-4 ${
              worstMonth.balance >= 0
                ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30'
                : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30'
            }`}>
              <p className="text-xs text-muted-foreground mb-1">Peor mes</p>
              <p className="text-sm font-semibold text-foreground">{worstMonth.label}</p>
              <p className={`mt-0.5 text-base font-bold ${worstMonth.balance >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {worstMonth.balance >= 0 ? '+' : ''}{sym} {fmt(fromPen(worstMonth.balance))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Desglose trimestral — solo modo anual */}
      {sections.quarterlyBreakdown && mode === 'annual' && quarters.some(q => q.hasData) && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4">Desglose trimestral {year}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {quarters.map(q => (
              <div key={q.label} className={`rounded-xl border p-3 ${q.hasData ? 'border-border' : 'border-border/40 opacity-40'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-foreground">{q.label}</span>
                  <span className="text-[10px] text-muted-foreground">{q.period}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Ingresos</p>
                <p className="text-xs font-semibold text-emerald-500 dark:text-emerald-400 mb-1">{sym} {fmt(fromPen(q.income))}</p>
                <p className="text-[11px] text-muted-foreground">Egresos</p>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{sym} {fmt(fromPen(q.expenses))}</p>
                <div className={`mt-2 pt-2 border-t border-border`}>
                  <p className="text-[11px] text-muted-foreground">Balance</p>
                  <p className={`text-xs font-bold ${q.balance >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                    {q.balance >= 0 ? '+' : ''}{sym} {fmt(fromPen(q.balance))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats secundarias — solo modo mensual */}
      {sections.statsMonthly && mode === 'monthly' && transactions.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-sm">
            <p className="text-xs text-muted-foreground">Transacciones</p>
            <p className="mt-1 text-lg font-bold text-foreground">{transactions.length}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">en el mes</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-sm">
            <p className="text-xs text-muted-foreground">Promedio diario</p>
            <p className="mt-1 text-lg font-bold text-foreground">{sym} {fmt(fromPen(avgDailyExpense))}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">en gastos</p>
          </div>
          {isCurrentMonth && daysRemaining > 0 && (
            <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-sm col-span-2 sm:col-span-1">
              <p className="text-xs text-muted-foreground">Proyección fin de mes</p>
              <p className={`mt-1 text-lg font-bold ${projectedBalance >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {sym} {fmt(fromPen(projectedBalance))}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{daysRemaining} días restantes</p>
            </div>
          )}
        </div>
      )}

      {/* Stats del período — solo modo rango */}
      {sections.rangeStats && mode === 'range' && transactions.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-sm">
            <p className="text-xs text-muted-foreground">Duración</p>
            <p className="mt-1 text-lg font-bold text-foreground">{rangeDays}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">días</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-sm">
            <p className="text-xs text-muted-foreground">Promedio diario</p>
            <p className="mt-1 text-lg font-bold text-foreground">
              {sym} {fmt(fromPen(rangeDays > 0 ? totalExpenses / rangeDays : 0))}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">en gastos</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 sm:p-5 shadow-sm">
            <p className="text-xs text-muted-foreground">Transacciones</p>
            <p className="mt-1 text-lg font-bold text-foreground">{transactions.length}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">en el período</p>
          </div>
        </div>
      )}

      {/* Mejor y peor día — solo modo rango */}
      {sections.bestWorstDay && mode === 'range' && highestExpDay && lowestExpDay && dayExpenses.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4">Destacados del período</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 sm:p-4">
              <p className="text-xs text-muted-foreground mb-1">Mayor gasto</p>
              <p className="text-sm font-semibold text-foreground">{highestExpDay.label}</p>
              <p className="mt-0.5 text-base font-bold text-red-500 dark:text-red-400">
                {sym} {fmt(fromPen(highestExpDay.total))}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-3 sm:p-4">
              <p className="text-xs text-muted-foreground mb-1">Menor gasto</p>
              <p className="text-sm font-semibold text-foreground">{lowestExpDay.label}</p>
              <p className="mt-0.5 text-base font-bold text-emerald-500 dark:text-emerald-400">
                {sym} {fmt(fromPen(lowestExpDay.total))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico */}
      {sections.chartMain && <div id="pdf-chart-main" className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {mode === 'monthly' ? 'Egresos acumulados del mes' :
               mode === 'annual'  ? 'Resultado por mes' :
               rangeByDay         ? 'Ingresos vs Egresos por día' :
                                    'Ingresos vs Egresos por período'}
            </h2>
          </div>
          {transactions.length > 0 && (
            <span className="text-xs text-muted-foreground">{transactions.length} transacciones</span>
          )}
        </div>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Sin transacciones en este período.</p>
        ) : (
          <div className="h-56 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              {mode === 'monthly' ? (
                <AreaChart data={cumulativeData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="gradProj" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    axisLine={false} tickLine={false}
                    tickFormatter={v => `S/${fmtShort(v)}`} width={60} />
                  <Tooltip
                    labelFormatter={label => `Día ${label}`}
                    formatter={(value, name) => [
                      `${sym} ${fmt(fromPen(Number(value)))}`,
                      name === 'actual' ? 'Egresos acumulados' : 'Proyección',
                    ]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
                  />
                  {totalIncome > 0 && (
                    <ReferenceLine y={totalIncome} stroke="#10b981" strokeDasharray="5 3" strokeWidth={1.5}
                      label={{ value: 'Ingresos', position: 'insideTopRight', fontSize: 10, fill: '#10b981', dy: -4 }} />
                  )}
                  {budgetTotal > 0 && (
                    <ReferenceLine y={budgetTotal} stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5}
                      label={({ viewBox }: any) => {
                        const { x, width, y } = viewBox
                        return (
                          <g>
                            <text x={x + width - 4} y={y - 4} textAnchor="end" fontSize={10} fill="#f59e0b">Presupuesto</text>
                            <text x={x + width - 4} y={y + 13} textAnchor="end" fontSize={10} fill="#f59e0b">{sym} {fmt(fromPen(budgetTotal))}</text>
                          </g>
                        )
                      }}
                    />
                  )}
                  <Area type="monotone" dataKey="actual" stroke="#94a3b8" strokeWidth={2}
                    fill="url(#gradActual)" connectNulls={false} dot={false} name="actual" />
                  {isCurrentMonth && (
                    <Area type="monotone" dataKey="proj" stroke="#94a3b8" strokeWidth={1.5}
                      strokeDasharray="5 3" fill="url(#gradProj)" connectNulls={false} dot={false} name="proj" />
                  )}
                </AreaChart>
              ) : mode === 'annual' ? (
                /* Annual: barras por resultado + línea de tendencia (regresión lineal) */
                <ComposedChart data={annualChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `S/${fmtShort(v)}`} width={60} />
                  <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
                  <Tooltip
                    labelFormatter={label => String(label)}
                    formatter={(value, name) => [
                      `${sym} ${fmt(fromPen(Number(value)))}`,
                      name === 'trend' ? 'Tendencia' : 'Balance',
                    ]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
                  />
                  <Bar dataKey="balance" radius={[4, 4, 0, 0]}>
                    {annualChartData.map((entry, i) => (
                      <Cell key={i}
                        fill={entry.income === 0 && entry.expenses === 0 ? 'var(--muted)' : entry.balance >= 0 ? '#10b981' : '#ef4444'}
                        fillOpacity={entry.income === 0 && entry.expenses === 0 ? 0.4 : 1}
                      />
                    ))}
                  </Bar>
                  <Line dataKey="trend" stroke="#f59e0b" strokeWidth={2} dot={false}
                    connectNulls={false} legendType="none" />
                </ComposedChart>
              ) : (
                /* Range: barras ingresos/egresos + línea de balance acumulado */
                <ComposedChart
                  data={rangeMainData}
                  margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={rangeByDay ? 8 : 14}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    axisLine={false} tickLine={false} interval={rangeByDay ? Math.floor(rangeDays / 10) : 0} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `S/${fmtShort(v)}`} width={60} />
                  <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
                  <Tooltip
                    formatter={(value, name) => [
                      `${sym} ${fmt(fromPen(Number(value)))}`,
                      name === 'income' ? 'Ingresos' : name === 'expenses' ? 'Egresos' : 'Balance acum.',
                    ]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
                  />
                  <Legend formatter={v => v === 'income' ? 'Ingresos' : v === 'expenses' ? 'Egresos' : 'Balance acum.'} wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="income"   fill="#10b981" radius={[4, 4, 0, 0]} name="income" />
                  <Bar dataKey="expenses" fill="#94a3b8" radius={[4, 4, 0, 0]} name="expenses" />
                  <Line dataKey="cumBalance" stroke="#f59e0b" strokeWidth={2} dot={false}
                    connectNulls name="cumBalance" legendType="circle" />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </div>}

      {/* Balance acumulado del período — solo modo rango */}
      {sections.rangeBalance && mode === 'range' && rangeBalanceData.length > 0 && (
        <div id="pdf-chart-range-balance" className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-1">Balance acumulado del período</h2>
          <p className="text-xs text-muted-foreground mb-5">Suma acumulada de ingresos − egresos</p>
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rangeBalanceData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                barSize={rangeByDay ? 8 : 14}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  axisLine={false} tickLine={false}
                  interval={rangeByDay ? Math.floor(rangeDays / 10) : 0} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => `S/${fmtShort(v)}`} width={60} />
                <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1.5} />
                <Tooltip
                  formatter={(value) => [`${sym} ${fmt(fromPen(Number(value)))}`, 'Acumulado']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
                />
                <Bar dataKey="balance" radius={[4, 4, 0, 0]}>
                  {rangeBalanceData.map((entry, i) => (
                    <Cell key={i}
                      fill={entry.balance >= 0 ? '#10b981' : '#ef4444'}
                      fillOpacity={'hasData' in entry && !entry.hasData ? 0.3 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Distribución por día de semana — solo modo rango */}
      {sections.weekdayDistribution && mode === 'range' && weekdayData.some(d => d.total > 0) && (
        <div id="pdf-chart-weekday" className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4">Gastos por día de semana</h2>
          <div className="space-y-2.5">
            {weekdayData.map(({ label, total, pct, txCount }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground w-7 shrink-0">{label}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-slate-400 dark:bg-slate-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-foreground font-medium w-24 text-right shrink-0">
                  {sym} {fmt(fromPen(total))}
                </span>
                <span className="text-xs text-muted-foreground w-12 text-right shrink-0">
                  {txCount} tx
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Balance acumulado — solo modo anual */}
      {sections.chartBalance && mode === 'annual' && transactions.length > 0 && (
        <div id="pdf-chart-balance" className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
          <div className="mb-5">
            <h2 className="text-sm font-semibold text-foreground">Balance acumulado {year}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Suma acumulada de ingresos − egresos mes a mes</p>
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
                  formatter={(value) => [`${sym} ${fmt(fromPen(Number(value)))}`, 'Acumulado']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
                />
                <Bar dataKey="cumulative" radius={[4, 4, 0, 0]}>
                  {balanceEvolution.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={!entry.hasData ? 'var(--muted)' : entry.cumulative >= 0 ? 'var(--brand)' : '#ef4444'}
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
      {sections.categoryExpenses && byCategory.length > 0 && (
        <div id="pdf-chart-categories" className="rounded-xl border border-border bg-card shadow-sm">
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
      {sections.categorySources && byIncomeCategory.length > 0 && (
        <div id="pdf-chart-sources" className="rounded-xl border border-border bg-card shadow-sm">
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

      {/* Top 5 gastos individuales */}
      {sections.topExpenses && topExpenses.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="px-4 sm:px-6 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">Top 5 gastos del período</h2>
          </div>
          <div className="divide-y divide-border">
            {topExpenses.map((tx, i) => (
              <div key={tx.id} className="flex items-center gap-3 px-4 sm:px-6 py-3">
                <span className="text-xs font-bold text-muted-foreground w-4 shrink-0 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{tx.concept}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">{tx.date}</span>
                    {tx.categories?.name && (
                      <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                        {tx.categories.name}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-sm font-semibold text-foreground shrink-0">
                  {sym} {fmt(fromPen(tx.amount_pen))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {transactions.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No hay transacciones en este período.</p>
        </div>
      )}

      <ConfirmDialog
        open={confirmEmailOpen}
        variant="primary"
        title={reportEmail ? 'Cancelar envío de reporte' : 'Activar reporte mensual por email'}
        message={reportEmail
          ? 'Dejarás de recibir el resumen mensual de tus finanzas en tu correo el día 1 de cada mes. ¿Deseas cancelarlo?'
          : 'Recibirás un resumen de tus finanzas del mes anterior en tu correo el día 1 de cada mes. ¿Deseas activarlo?'}
        confirmLabel={reportEmail ? 'Sí, cancelar envío' : 'Sí, activar'}
        onConfirm={confirmReportEmail}
        onClose={() => setConfirmEmailOpen(false)}
      />

      <UpgradePrompt
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        feature=""
        limit={0}
        unit=""
        message={
          upgradeReason === 'history'
            ? `El plan gratuito permite ver reportes de los últimos ${historyMonths} meses. Actualiza a Premium para acceder a todo tu historial.`
            : 'El plan gratuito incluye el reporte mensual. Actualiza a Premium para acceder a reportes anuales y rangos personalizados.'
        }
      />
    </div>
  )
}
