import { createClient } from '@/lib/supabase/server'
import { SavingsClient } from '@/components/savings/SavingsClient'

export default async function SavingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today = new Date()
  const year  = today.getFullYear()
  const month = today.getMonth() + 1
  const todayStr  = today.toISOString().split('T')[0]

  const [snapshotsRes, goalsRes, cumulativeRes, balanceRpc, profileRes] = await Promise.all([
    supabase
      .from('savings_snapshots')
      .select('*')
      .eq('user_id', user!.id)
      .order('year', { ascending: false })
      .order('month', { ascending: false }),
    supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
    // Balance acumulado total hasta hoy (mismo criterio que dashboard)
    supabase
      .from('transactions')
      .select('type, amount_pen')
      .eq('user_id', user!.id)
      .lte('date', todayStr),
    // Balance del mes actual usando el mismo RPC que el dashboard
    supabase.rpc('get_monthly_balance', {
      p_user_id: user!.id,
      p_year:    year,
      p_month:   month,
    }),
    supabase.from('profiles').select('base_currency').eq('id', user!.id).single(),
  ])

  const accumulatedBalance = ((cumulativeRes.data ?? []) as any[]).reduce((sum, tx) => {
    return sum + (tx.type === 'income' ? Number(tx.amount_pen) : -Number(tx.amount_pen))
  }, 0)

  const monthlyRow     = (balanceRpc.data as any)?.[0] ?? { income: 0, expenses: 0, balance: 0 }
  const monthlyBalance = Math.max(Number(monthlyRow.balance ?? 0), 0)
  const monthlyLabel   = today.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' })

  return (
    <SavingsClient
      snapshots={snapshotsRes.data ?? []}
      goals={goalsRes.data ?? []}
      userId={user!.id}
      accumulatedBalance={Math.max(accumulatedBalance, 0)}
      monthlyBalance={monthlyBalance}
      currentMonthLabel={monthlyLabel}
      baseCurrency={(profileRes.data?.base_currency as 'PEN' | 'USD') ?? 'PEN'}
    />
  )
}
