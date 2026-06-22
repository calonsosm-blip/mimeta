import { createClient } from '@/lib/supabase/server'
import { MonthlyReportClient } from '@/components/reports/MonthlyReportClient'

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

  const params  = await searchParams
  const now     = new Date()
  const mode    = (params.mode ?? 'annual') as 'annual' | 'monthly' | 'range'
  const year    = parseInt(params.year  ?? '') || now.getFullYear()
  const month   = parseInt(params.month ?? '') || now.getMonth() + 1

  let dateFrom: string
  let dateTo: string

  if (mode === 'monthly') {
    const days = new Date(year, month, 0).getDate()
    dateFrom = `${year}-${String(month).padStart(2, '0')}-01`
    dateTo   = `${year}-${String(month).padStart(2, '0')}-${String(days).padStart(2, '0')}`
  } else if (mode === 'range' && params.from && params.to) {
    dateFrom = params.from
    dateTo   = params.to
  } else {
    dateFrom = `${year}-01-01`
    dateTo   = `${year}-12-31`
  }

  const [txRes, profileRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, date, type, concept, amount, amount_pen, currency, notes, categories(name)')
      .eq('user_id', user!.id)
      .gte('date', dateFrom)
      .lte('date', dateTo)
      .order('date', { ascending: false }),
    supabase.from('profiles').select('base_currency').eq('id', user!.id).single(),
  ])

  return (
    <MonthlyReportClient
      transactions={txRes.data ?? []}
      mode={mode}
      year={year}
      month={month}
      from={params.from ?? dateFrom}
      to={params.to ?? dateTo}
      currentYear={now.getFullYear()}
      currentMonth={now.getMonth() + 1}
      baseCurrency={(profileRes.data?.base_currency as 'PEN' | 'USD') ?? 'PEN'}
    />
  )
}
