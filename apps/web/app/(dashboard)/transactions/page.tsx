import { createClient } from '@/lib/supabase/server'
import { TransactionsClient } from '@/components/transactions/TransactionsClient'

export default async function TransactionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [txRes, catRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, date, type, concept, amount, amount_pen, currency, notes, categories(id, name, type)')
      .eq('user_id', user!.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('categories')
      .select('id, name, type, parent_id')
      .eq('user_id', user!.id)
      .order('sort_order'),
  ])

  return (
    <TransactionsClient
      transactions={(txRes.data ?? []) as any}
      categories={catRes.data ?? []}
      userId={user!.id}
    />
  )
}
