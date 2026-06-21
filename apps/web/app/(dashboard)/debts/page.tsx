import { createClient } from '@/lib/supabase/server'
import { DebtsClient } from '@/components/debts/DebtsClient'

export default async function DebtsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: debts } = await supabase
    .from('debts')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  return <DebtsClient debts={debts ?? []} userId={user!.id} />
}
