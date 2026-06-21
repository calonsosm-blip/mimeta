import { createClient } from '@/lib/supabase/server'
import { PlannedPaymentsClient } from '@/components/planned-payments/PlannedPaymentsClient'

export default async function PlannedPaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [paymentsRes, catRes] = await Promise.all([
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
  ])

  return (
    <PlannedPaymentsClient
      payments={(paymentsRes.data ?? []) as any}
      categories={catRes.data ?? []}
      userId={user!.id}
    />
  )
}
