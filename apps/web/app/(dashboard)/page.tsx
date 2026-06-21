import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/DashboardClient'
import type { MonthBalance } from '@/components/dashboard/BalanceEvolutionChart'

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

interface Props {
  searchParams: Promise<{ year?: string; month?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const params = await searchParams
  const now = new Date()
  const year  = parseInt(params.year  ?? '') || now.getFullYear()
  const month = parseInt(params.month ?? '') || now.getMonth() + 1
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
  const isFutureMonth  = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const today = isCurrentMonth ? now.getDate() : isFutureMonth ? 0 : daysInMonth

  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`
  const dateTo   = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

  // Rango de 12 meses para el historial
  const histStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const histStartStr = `${histStart.getFullYear()}-${String(histStart.getMonth() + 1).padStart(2, '0')}-01`

  const [
    profileRes, balanceRes, recentRes, upcomingRes,
    budgetTotalRes, expensesRes, cumulativeRes, historyRes,
  ] = await Promise.all([
    supabase.from('profiles').select('display_name, plan').eq('id', user!.id).single(),
    supabase.rpc('get_monthly_balance', { p_user_id: user!.id, p_year: year, p_month: month }),
    supabase
      .from('transactions')
      .select('id, date, type, concept, amount_pen, currency, categories(name)')
      .eq('user_id', user!.id)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('planned_payments')
      .select('concept, next_due_date, amount, currency')
      .eq('user_id', user!.id)
      .eq('is_active', true)
      .gte('next_due_date', new Date().toISOString().split('T')[0])
      .order('next_due_date')
      .limit(4),
    supabase
      .from('budgets')
      .select('amount')
      .eq('user_id', user!.id)
      .eq('year', year)
      .eq('month', month),
    supabase
      .from('transactions')
      .select('amount_pen, categories(name)')
      .eq('user_id', user!.id)
      .eq('type', 'expense')
      .gte('date', dateFrom)
      .lte('date', dateTo),
    supabase
      .from('transactions')
      .select('type, amount_pen')
      .eq('user_id', user!.id)
      .lte('date', dateTo),
    supabase
      .from('transactions')
      .select('type, amount_pen, date')
      .eq('user_id', user!.id)
      .gte('date', histStartStr)
      .order('date'),
  ])

  const balance     = balanceRes.data?.[0] ?? { income: 0, expenses: 0, balance: 0 }
  const totalBudget = (budgetTotalRes.data ?? []).reduce((s, b) => s + b.amount, 0)

  const cumulativeBalance = ((cumulativeRes.data ?? []) as any[]).reduce((sum, tx) => {
    return sum + (tx.type === 'income' ? tx.amount_pen : -tx.amount_pen)
  }, 0)

  // Agrupar gastos por categoría
  const expenseMap: Record<string, number> = {}
  for (const tx of (expensesRes.data ?? []) as any[]) {
    const name = tx.categories?.name ?? 'Sin categoría'
    expenseMap[name] = (expenseMap[name] ?? 0) + (tx.amount_pen as number)
  }
  const expenseByCategory = Object.entries(expenseMap)
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)

  // Historial mensual (últimos 12 meses)
  const monthlyMap: Record<string, { income: number; expenses: number }> = {}
  for (const tx of (historyRes.data ?? []) as any[]) {
    const [y, m] = (tx.date as string).split('-')
    const key = `${y}-${m}`
    if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expenses: 0 }
    if (tx.type === 'income') monthlyMap[key].income += tx.amount_pen
    else monthlyMap[key].expenses += tx.amount_pen
  }

  const balanceHistory: MonthBalance[] = Array.from({ length: 12 }, (_, i) => {
    const d   = new Date(now.getFullYear(), now.getMonth() - 11 + i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const data = monthlyMap[key] ?? { income: 0, expenses: 0 }
    return {
      label:    `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`,
      income:   data.income,
      expenses: data.expenses,
      balance:  data.income - data.expenses,
    }
  })

  return (
    <DashboardClient
      profile={profileRes.data}
      balance={balance}
      recentTransactions={(recentRes.data ?? []) as any}
      upcomingReminders={upcomingRes.data ?? []}
      totalBudget={totalBudget}
      today={today}
      daysInMonth={daysInMonth}
      selectedYear={year}
      selectedMonth={month}
      isCurrentMonth={isCurrentMonth}
      expenseByCategory={expenseByCategory}
      cumulativeBalance={cumulativeBalance}
      balanceHistory={balanceHistory}
    />
  )
}
