import { createClient } from '@/lib/supabase/server'
import { PlannedPaymentsClient } from '@/components/planned-payments/PlannedPaymentsClient'

export default async function PlannedPaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [paymentsRes, catRes, profileRes] = await Promise.all([
    supabase
      .from('planned_payments')
      .select('*, categories(name)')
      .eq('user_id', user!.id)
      .order('next_due_date', { ascending: true }),
    supabase
      .from('categories')
      .select('id, name, type')
      .eq('user_id', user!.id)
      .order('sort_order'),
    supabase.from('profiles').select('base_currency, plan').eq('id', user!.id).single(),
  ])

  return (
    <PlannedPaymentsClient
      payments={(paymentsRes.data ?? []) as any}
      categories={catRes.data ?? []}
      userId={user!.id}
      baseCurrency={(profileRes.data?.base_currency as 'PEN' | 'USD') ?? 'PEN'}
      plan={(profileRes.data?.plan as 'free' | 'premium') ?? 'free'}
    />
  )
}
