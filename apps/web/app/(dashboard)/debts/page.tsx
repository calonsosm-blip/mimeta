import { createClient } from '@/lib/supabase/server'
import { DebtsClient } from '@/components/debts/DebtsClient'

export default async function DebtsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [debtsRes, profileRes] = await Promise.all([
    supabase.from('debts').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
    supabase.from('profiles').select('base_currency').eq('id', user!.id).single(),
  ])

  return (
    <DebtsClient
      debts={debtsRes.data ?? []}
      userId={user!.id}
      baseCurrency={(profileRes.data?.base_currency as 'PEN' | 'USD') ?? 'PEN'}
    />
  )
}
