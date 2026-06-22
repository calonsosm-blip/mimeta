import { createClient } from '@/lib/supabase/server'
import { MonthlyReportClient } from '@/components/reports/MonthlyReportClient'

interface Props {
  searchParams: Promise<{ year?: string }>
}

export default async function MonthlyReportPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const params = await searchParams
  const now  = new Date()
  const year = parseInt(params.year ?? '') || now.getFullYear()

  const dateFrom = `${year}-01-01`
  const dateTo   = `${year}-12-31`

  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, date, type, concept, amount, amount_pen, currency, notes, categories(name)')
    .eq('user_id', user!.id)
    .gte('date', dateFrom)
    .lte('date', dateTo)
    .order('date', { ascending: false })

  return (
    <MonthlyReportClient
      transactions={transactions ?? []}
      year={year}
      currentYear={now.getFullYear()}
    />
  )
}
