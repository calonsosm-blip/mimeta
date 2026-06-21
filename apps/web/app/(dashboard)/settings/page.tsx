import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/settings/SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [profileRes, catRes] = await Promise.all([
    supabase.from('profiles').select('display_name, base_currency, plan').eq('id', user!.id).single(),
    supabase.from('categories').select('id, name, type, parent_id, sort_order').eq('user_id', user!.id).order('type').order('sort_order'),
  ])

  return (
    <SettingsClient
      profile={profileRes.data}
      categories={catRes.data ?? []}
      userId={user!.id}
    />
  )
}
