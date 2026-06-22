'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, ChevronLeft, ChevronRight } from 'lucide-react'
import { MonthThermometer } from './MonthThermometer'
import { ExpenseDonutChart } from './ExpenseDonutChart'
import { BalanceEvolutionChart } from './BalanceEvolutionChart'
import type { MonthBalance } from './BalanceEvolutionChart'

interface Props {
  profile: { display_name: string | null; plan: string } | null
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
  balanceHistory: MonthBalance[]
}

const MONTHS_LONG = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function fmt(amount: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

export function DashboardClient({
  profile, balance, recentTransactions, upcomingReminders,
  totalBudget, today, daysInMonth,
  selectedYear, selectedMonth, isCurrentMonth, expenseByCategory, cumulativeBalance,
  balanceHistory,
}: Props) {
  const [invisible, setInvisible] = useState(false)
  const router = useRouter()
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Hola, {firstName} 👋</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isCurrentMonth ? 'Resumen del mes actual' : 'Resumen del período seleccionado'}
            </p>
          </div>
          <button
            onClick={() => setInvisible(v => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={invisible ? 'Mostrar saldos' : 'Ocultar saldos'}
          >
            {invisible
              ? <Eye className="h-4 w-4" />
              : <EyeOff className="h-4 w-4" />
            }
          </button>
        </div>

        {/* Navegación de período */}
        <div className="flex flex-wrap items-center gap-1 sm:flex-nowrap sm:shrink-0">
          <button onClick={prevMonth} className={navBtnClass} title="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>

          <select
            value={selectedMonth}
            onChange={e => changePeriod(selectedYear, parseInt(e.target.value))}
            className={selectClass}
          >
            {MONTHS_LONG.map((name, i) => (
              <option key={i + 1} value={i + 1}>
                {name.charAt(0).toUpperCase() + name.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={e => changePeriod(parseInt(e.target.value), selectedMonth)}
            className={selectClass}
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
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
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Ingresos</p>
          <p className="mt-2 text-2xl font-bold text-emerald-500 dark:text-emerald-400">
            S/ {mask(fmt(balance.income))}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Egresos</p>
          <p className="mt-2 text-2xl font-bold text-slate-500 dark:text-slate-400">
            S/ {mask(fmt(balance.expenses))}
          </p>
        </div>
        <div className={`rounded-xl border p-6 shadow-sm ${
          balance.balance >= 0
            ? 'border-accent bg-accent'
            : 'border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30'
        }`}>
          <p className="text-sm font-medium text-muted-foreground">Balance</p>
          <p className={`mt-2 text-2xl font-bold ${
            balance.balance >= 0 ? 'text-accent-foreground' : 'text-red-600 dark:text-red-400'
          }`}>
            S/ {mask(fmt(balance.balance))}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Acumulado:{' '}
            <span className={`font-medium ${
              cumulativeBalance >= 0 ? 'text-primary' : 'text-red-500 dark:text-red-400'
            }`}>
              {invisible ? '••••' : `S/ ${fmt(cumulativeBalance)}`}
            </span>
          </p>
        </div>
      </div>

      {/* Termómetro + Alertas */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthThermometer
          expenses={balance.expenses}
          income={balance.income}
          budget={totalBudget}
          today={today}
          daysInMonth={daysInMonth}
          invisible={invisible}
          isCurrentMonth={isCurrentMonth}
        />

        {/* Próximos recordatorios */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            {isCurrentMonth ? 'Próximos pagos' : 'Recordatorios del mes'}
          </h2>
          {upcomingReminders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no tienes alertas de pago configuradas.</p>
          ) : (
            <ul className="space-y-3">
              {upcomingReminders.map((r, i) => {
                const d = new Date(r.next_due_date + 'T12:00:00')
                const day = d.getDate()
                const mon = d.toLocaleDateString('es-PE', { month: 'short' })
                return (
                  <li key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50 text-xs font-bold text-amber-700 dark:text-amber-400">
                        {day}
                      </span>
                      <div>
                        <span className="text-sm text-foreground">{r.concept}</span>
                        <p className="text-[11px] text-muted-foreground">{mon}</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {invisible ? '••••' : `${r.currency === 'USD' ? '$' : 'S/'} ${fmt(r.amount)}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Gráfica evolución de balance */}
      <BalanceEvolutionChart data={balanceHistory} invisible={invisible} />

      {/* Distribución de gastos + Transacciones recientes */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ExpenseDonutChart data={expenseByCategory} invisible={invisible} />

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
                    {tx.type === 'income' ? '+' : '-'} S/ {mask(fmt(tx.amount_pen))}
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
