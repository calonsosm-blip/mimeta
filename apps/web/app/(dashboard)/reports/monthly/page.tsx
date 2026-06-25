import { createClient } from '@/lib/supabase/server'
import { MonthlyReportClient } from '@/components/reports/MonthlyReportClient'
import { PLAN_LIMITS } from '@/lib/planLimits'

interface Props {
  searchParams: Promise<{
    mode?: string
    year?: string
    month?: string
    from?: string
    to?: string
  }>
}

export default async function MonthlyReportPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const params = await searchParams
  const now    = new Date()
  const year   = parseInt(params.year  ?? '') || now.getFullYear()
  const month  = parseInt(params.month ?? '') || now.getMonth() + 1

  const profileRes = await supabase
    .from('profiles')
    .select('base_currency, plan')
    .eq('id', user!.id)
    .single()

  // Preferencia de email — query separada para no bloquear si la migración aún no se aplicó
  const emailPrefRes = await supabase
    .from('profiles')
    .select('monthly_report_email')
    .eq('id', user!.id)
    .single()
    .then(r => r.data?.monthly_report_email ?? false)
    .catch(() => false)

  const plan          = (profileRes.data?.plan as string) ?? 'free'
  const isPremium     = plan === 'premium'
  const historyMonths = isPremium ? Infinity : PLAN_LIMITS.free.history_months

  // Free users always get monthly mode
  const requestedMode = (params.mode ?? 'annual') as 'annual' | 'monthly' | 'range'
  const mode: 'annual' | 'monthly' | 'range' = !isPremium ? 'monthly' : requestedMode

  // Clamp month/year for free users
  let effectiveYear  = year
  let effectiveMonth = month
  if (!isPremium) {
    const minDate  = new Date(now.getFullYear(), now.getMonth() - historyMonths + 1, 1)
    const selected = new Date(year, month - 1, 1)
    if (selected < minDate) {
      effectiveYear  = now.getFullYear()
      effectiveMonth = now.getMonth() + 1
    }
  }

  // Current period dates
  let dateFrom: string
  let dateTo: string

  if (mode === 'monthly') {
    const days = new Date(effectiveYear, effectiveMonth, 0).getDate()
    dateFrom = `${effectiveYear}-${String(effectiveMonth).padStart(2, '0')}-01`
    dateTo   = `${effectiveYear}-${String(effectiveMonth).padStart(2, '0')}-${String(days).padStart(2, '0')}`
  } else if (mode === 'range' && params.from && params.to) {
    dateFrom = params.from
    dateTo   = params.to
  } else {
    dateFrom = `${year}-01-01`
    dateTo   = `${year}-12-31`
  }

  // Previous period dates (for comparativa)
  let prevDateFrom: string
  let prevDateTo: string

  if (mode === 'monthly') {
    const prevMonth = effectiveMonth === 1 ? 12 : effectiveMonth - 1
    const prevYear  = effectiveMonth === 1 ? effectiveYear - 1 : effectiveYear
    const prevDays  = new Date(prevYear, prevMonth, 0).getDate()
    prevDateFrom = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
    prevDateTo   = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(prevDays).padStart(2, '0')}`
  } else if (mode === 'range' && params.from && params.to) {
    const fromMs   = new Date(params.from).getTime()
    const toMs     = new Date(params.to).getTime()
    const duration = toMs - fromMs
    prevDateTo   = new Date(fromMs - 86400000).toISOString().slice(0, 10)
    prevDateFrom = new Date(fromMs - duration - 86400000).toISOString().slice(0, 10)
  } else {
    prevDateFrom = `${year - 1}-01-01`
    prevDateTo   = `${year - 1}-12-31`
  }

  const [txRes, prevTxRes, budgetRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, date, type, concept, amount, amount_pen, currency, notes, categories(name)')
      .eq('user_id', user!.id)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: false }),
    supabase
      .from('transactions')
      .select('type, amount_pen')
      .eq('user_id', user!.id)
      .gte('date', prevDateFrom)
      .lte('date', prevDateTo),
    mode === 'monthly'
      ? supabase
          .from('budgets')
          .select('amount, categories(type)')
          .eq('user_id', user!.id)
          .eq('year', effectiveYear)
          .eq('month', effectiveMonth)
      : Promise.resolve({ data: [] }),
  ])

  const prevData     = prevTxRes.data ?? []
  const prevIncome   = prevData.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_pen, 0)
  const prevExpenses = prevData.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_pen, 0)

  const budgetTotal = (budgetRes.data ?? [])
    .filter((b: any) => b.categories?.type === 'expense')
    .reduce((s: number, b: any) => s + (b.amount ?? 0), 0)

  return (
    <MonthlyReportClient
      transactions={txRes.data ?? []}
      mode={mode}
      year={effectiveYear}
      month={effectiveMonth}
      from={params.from ?? dateFrom}
      to={params.to ?? dateTo}
      currentYear={now.getFullYear()}
      currentMonth={now.getMonth() + 1}
      baseCurrency={(profileRes.data?.base_currency as 'PEN' | 'USD') ?? 'PEN'}
      plan={plan}
      historyMonths={historyMonths === Infinity ? 999 : historyMonths}
      prevIncome={prevIncome}
      prevExpenses={prevExpenses}
      budgetTotal={budgetTotal}
      monthlyReportEmail={emailPrefRes}
      userId={user!.id}
    />
  )
}
