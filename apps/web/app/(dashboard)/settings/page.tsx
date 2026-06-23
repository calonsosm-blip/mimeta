import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/settings/SettingsClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const profileRes = await supabase.from('profiles').select('display_name, base_currency, plan').eq('id', user!.id).single()

  return (
    <SettingsClient
      profile={profileRes.data}
      userId={user!.id}
    />
  )
}
