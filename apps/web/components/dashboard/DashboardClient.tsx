'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react'
import { MonthThermometer } from './MonthThermometer'
import { ExpenseDonutChart } from './ExpenseDonutChart'
import { useIsMobile } from '@/hooks/useIsMobile'

interface Props {
  profile: { display_name: string | null; plan: string } | null
  baseCurrency: 'PEN' | 'USD'
  balance: { income: number; expenses: number; balance: number }
  recentTransactions: {
    id: string
    date: string
    type: string
    concept: string
    amount_pen: number
    currency: string
    categories: { name: string } | null
  }[]
  upcomingReminders: { concept: string; next_due_date: string; amount: number; currency: string }[]
  totalBudget: number
  today: number
  daysInMonth: number
  selectedYear: number
  selectedMonth: number
  isCurrentMonth: boolean
  expenseByCategory: { name: string; total: number }[]
  cumulativeBalance: number
}

const MONTHS_LONG = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function fmt(amount: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

export function DashboardClient({
  profile, baseCurrency, balance, recentTransactions, upcomingReminders,
  totalBudget, today, daysInMonth,
  selectedYear, selectedMonth, isCurrentMonth, expenseByCategory, cumulativeBalance,
}: Props) {
  const [liveRate, setLiveRate] = useState<number | null>(null)

  // Si la moneda base es USD, obtener TC actual para convertir totales PEN → USD
  useEffect(() => {
    if (baseCurrency !== 'USD') return
    const today = new Date().toISOString().slice(0, 10)
    fetch(`/api/exchange-rate?date=${today}`)
      .then(r => r.json())
      .then(({ rate }) => { if (rate) setLiveRate(rate) })
      .catch(() => {})
  }, [baseCurrency])

  // Convertir monto PEN al display en la moneda base
  const toBase = (pen: number) =>
    baseCurrency === 'USD' && liveRate ? pen / liveRate : pen
  const sym = baseCurrency === 'USD' && liveRate ? '$' : 'S/'
  const [invisible, setInvisible] = useState(false)
  const router = useRouter()
  const isMobile = useIsMobile()
  const firstName = profile?.display_name?.split(' ')[0] ?? 'Usuario'
  const mask = (val: string) => invisible ? '••••••' : val

  const now = new Date()
  const currentYear = now.getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i)

  function changePeriod(year: number, month: number) {
    router.push(`/?year=${year}&month=${month}`)
  }

  function prevMonth() {
    if (selectedMonth === 1) changePeriod(selectedYear - 1, 12)
    else changePeriod(selectedYear, selectedMonth - 1)
  }

  function nextMonth() {
    if (selectedMonth === 12) changePeriod(selectedYear + 1, 1)
    else changePeriod(selectedYear, selectedMonth + 1)
  }

  const selectClass = 'rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring'
  const navBtnClass = 'flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shadow-sm'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        {/* Izquierda: título + subtítulo + ojo */}
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Hola, {firstName} 👋</h1>
            <p className="hidden sm:block text-sm text-muted-foreground mt-0.5">
              {isCurrentMonth ? 'Resumen del mes actual' : 'Resumen del período seleccionado'}
            </p>
          </div>
          <button
            onClick={() => setInvisible(v => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={invisible ? 'Mostrar saldos' : 'Ocultar saldos'}
          >
            {invisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>

        {/* Derecha: selector de período */}
        <div className="shrink-0">
          {isMobile ? (
            <div className="flex items-center gap-1 mt-1">
              <button onClick={prevMonth} className="text-muted-foreground/60 hover:text-foreground transition-colors">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <div className="relative">
                <span className="text-sm text-muted-foreground cursor-pointer">
                  {MONTHS_LONG[selectedMonth - 1].charAt(0).toUpperCase() + MONTHS_LONG[selectedMonth - 1].slice(1)}
                </span>
                <select
                  value={selectedMonth}
                  onChange={e => changePeriod(selectedYear, parseInt(e.target.value))}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                >
                  {MONTHS_LONG.map((name, i) => (
                    <option key={i + 1} value={i + 1}>{name.charAt(0).toUpperCase() + name.slice(1)}</option>
                  ))}
                </select>
              </div>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <div className="relative">
                <span className="text-sm text-muted-foreground cursor-pointer">{selectedYear}</span>
                <select
                  value={selectedYear}
                  onChange={e => changePeriod(parseInt(e.target.value), selectedMonth)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                >
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <button onClick={nextMonth} className="text-muted-foreground/60 hover:text-foreground transition-colors">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              {!isCurrentMonth && (
                <button onClick={() => router.push('/')} className="text-xs text-primary ml-0.5">hoy</button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className={navBtnClass} title="Mes anterior">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <select
                value={selectedMonth}
                onChange={e => changePeriod(selectedYear, parseInt(e.target.value))}
                className={selectClass}
              >
                {MONTHS_LONG.map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name.charAt(0).toUpperCase() + name.slice(1)}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={e => changePeriod(parseInt(e.target.value), selectedMonth)}
                className={selectClass}
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={nextMonth} className={navBtnClass} title="Mes siguiente">
                <ChevronRight className="h-4 w-4" />
              </button>
              {!isCurrentMonth && (
                <button
                  onClick={() => router.push('/')}
                  className="ml-1 rounded-lg border border-primary/30 bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:bg-accent/80 transition-colors shadow-sm"
                >
                  Hoy
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="rounded-xl border border-border bg-card p-3 sm:p-6 shadow-sm">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Ingresos</p>
          <p className="mt-1 sm:mt-2 text-base sm:text-2xl font-bold text-emerald-500 dark:text-emerald-400 truncate">
            {sym} {mask(fmt(toBase(balance.income)))}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 sm:p-6 shadow-sm">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Egresos</p>
          <p className="mt-1 sm:mt-2 text-base sm:text-2xl font-bold text-slate-500 dark:text-slate-400 truncate">
            {sym} {mask(fmt(toBase(balance.expenses)))}
          </p>
        </div>
        <div className={`rounded-xl border p-3 sm:p-6 shadow-sm ${
          balance.balance >= 0
            ? 'border-accent bg-accent'
            : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30'
        }`}>
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">Balance</p>
          <p className={`mt-1 sm:mt-2 text-base sm:text-2xl font-bold truncate ${
            balance.balance >= 0 ? 'text-accent-foreground' : 'text-red-600 dark:text-red-400'
          }`}>
            {sym} {mask(fmt(toBase(balance.balance)))}
          </p>
          <p className="mt-1 hidden sm:block text-xs text-muted-foreground">
            Acumulado:{' '}
            <span className={`font-medium ${
              cumulativeBalance >= 0 ? 'text-primary' : 'text-red-500 dark:text-red-400'
            }`}>
              {invisible ? '••••' : `${sym} ${fmt(toBase(cumulativeBalance))}`}
            </span>
          </p>
        </div>
      </div>
      {/* Acumulado visible solo en móvil, debajo de las cards */}
      <p className="sm:hidden text-xs text-muted-foreground -mt-2">
        Acumulado:{' '}
        <span className={`font-medium ${cumulativeBalance >= 0 ? 'text-primary' : 'text-red-500 dark:text-red-400'}`}>
          {invisible ? '••••' : `${sym} ${fmt(toBase(cumulativeBalance))}`}
        </span>
      </p>

      {/* Termómetro + Alertas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthThermometer
          expenses={toBase(balance.expenses)}
          income={toBase(balance.income)}
          budget={toBase(totalBudget)}
          today={today}
          daysInMonth={daysInMonth}
          invisible={invisible}
          isCurrentMonth={isCurrentMonth}
          sym={sym}
        />

        {/* Próximos recordatorios */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            {isCurrentMonth ? 'Próximos pagos' : 'Recordatorios del mes'}
          </h2>
          {upcomingReminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no tienes alertas de pago configuradas.</p>
          ) : (
            <ul className="space-y-1">
              {upcomingReminders.map((r, i) => {
                const d = new Date(r.next_due_date + 'T12:00:00')
                const day = d.getDate()
                const mon = d.toLocaleDateString('es', { month: 'short' })
                const now = new Date()
                now.setHours(12, 0, 0, 0)
                const daysLeft = Math.round((d.getTime() - now.getTime()) / 86_400_000)
                const urgencyLabel = daysLeft === 0 ? 'Hoy' : daysLeft === 1 ? 'Mañana' : daysLeft <= 3 ? `En ${daysLeft} días` : null
                const circleClass = daysLeft === 0
                  ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400'
                  : daysLeft <= 2
                  ? 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400'
                  : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                const badgeClass = daysLeft === 0
                  ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400'
                  : daysLeft <= 2
                  ? 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-400'
                  : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                return (
                  <li key={i} className={`flex items-center justify-between rounded-lg px-2 py-2 -mx-2 transition-colors ${urgencyLabel ? 'bg-red-50/60 dark:bg-red-950/10' : 'hover:bg-muted/40'}`}>
                    <div className="flex items-center gap-3">
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${circleClass}`}>
                        {day}
                      </span>
                      <div>
                        <span className="text-sm text-foreground">{r.concept}</span>
                        <p className="text-[11px] text-muted-foreground">{mon}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {urgencyLabel && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgeClass}`}>
                          {urgencyLabel}
                        </span>
                      )}
                      <span className="text-sm font-medium text-foreground">
                        {invisible ? '••••' : `${r.currency === 'USD' ? '$' : 'S/'} ${fmt(r.amount)}`}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Distribución de gastos + Transacciones recientes */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ExpenseDonutChart
          data={expenseByCategory.map(d => ({ ...d, total: toBase(d.total) }))}
          invisible={invisible}
          sym={sym}
        />

        {/* Transacciones recientes */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">
              {isCurrentMonth ? 'Últimas transacciones' : `Transacciones de ${MONTHS_LONG[selectedMonth - 1]}`}
            </h2>
            <a href="/transactions" className="text-xs text-primary hover:underline">Ver todas</a>
          </div>
          {recentTransactions.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground text-center">
              No hay transacciones en este período.{' '}
              {isCurrentMonth && (
                <a href="/transactions" className="text-primary hover:underline">Registra la primera</a>
              )}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {recentTransactions.map(tx => (
                <li key={tx.id} className="flex items-center justify-between px-6 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${
                      tx.type === 'income'
                        ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}>
                      {tx.type === 'income' ? '↑' : '↓'}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{tx.concept}</p>
                      <p className="text-xs text-muted-foreground">
                        {tx.categories?.name ?? 'Sin categoría'} · {new Date(tx.date + 'T12:00:00').toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${
                    tx.type === 'income'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}>
                    {tx.type === 'income' ? '+' : '-'} {sym} {mask(fmt(toBase(tx.amount_pen)))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
