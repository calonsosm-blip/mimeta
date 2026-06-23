import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from '@/components/dashboard/DashboardClient'

interface Props {
  searchParams: Promise<{ year?: string; month?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const params = await searchParams
  // Fecha actual en zona horaria de Lima (UTC-5) para evitar desfase de día
  const limaStr  = new Date().toLocaleString('en-CA', { timeZone: 'America/Lima' })
  const limaDate = new Date(limaStr)
  const year  = parseInt(params.year  ?? '') || limaDate.getFullYear()
  const month = parseInt(params.month ?? '') || limaDate.getMonth() + 1
  const isCurrentMonth = year === limaDate.getFullYear() && month === limaDate.getMonth() + 1
  const isFutureMonth  = year > limaDate.getFullYear() || (year === limaDate.getFullYear() && month > limaDate.getMonth() + 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const today = isCurrentMonth ? limaDate.getDate() : isFutureMonth ? 0 : daysInMonth

  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`
  const dateTo   = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

  const [
    profileRes, balanceRes, recentRes, upcomingRes,
    budgetTotalRes, expensesRes, cumulativeRes, projectedIncomeRes,
  ] = await Promise.all([
    supabase.from('profiles').select('display_name, plan, base_currency').eq('id', user!.id).single(),
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
      .gte('next_due_date', new Date().toLocaleString('en-CA', { timeZone: 'America/Lima' }).slice(0, 10))
      .order('next_due_date')
      .limit(5),
    supabase
      .from('budgets')
      .select('amount, categories!inner(type)')
      .eq('user_id', user!.id)
      .eq('year', year)
      .eq('month', month)
      .eq('categories.type', 'expense'),
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
    // Presupuesto de ingresos del mes
    supabase
      .from('budgets')
      .select('amount, categories!inner(type)')
      .eq('user_id', user!.id)
      .eq('year', year)
      .eq('month', month)
      .eq('categories.type', 'income'),
  ])

  const balance          = balanceRes.data?.[0] ?? { income: 0, expenses: 0, balance: 0 }
  const totalBudget      = (budgetTotalRes.data ?? []).reduce((s, b) => s + b.amount, 0)
  const projectedIncome  = ((projectedIncomeRes.data ?? []) as any[]).reduce((s, b) => s + b.amount, 0)

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

  return (
    <DashboardClient
      profile={profileRes.data}
      baseCurrency={(profileRes.data?.base_currency as 'PEN' | 'USD') ?? 'PEN'}
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
      projectedIncome={projectedIncome}
    />
  )
}
