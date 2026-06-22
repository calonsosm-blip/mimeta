import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const LIVE_API = 'https://open.er-api.com/v6/latest/USD'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date  = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)

  const supabase = adminClient()

  // 1. Buscar en BD primero
  const { data: cached } = await supabase
    .from('exchange_rates')
    .select('usd_to_pen')
    .eq('date', date)
    .maybeSingle()

  if (cached?.usd_to_pen) {
    return NextResponse.json({ rate: Number(cached.usd_to_pen), source: 'db', date })
  }

  // 2. Solo buscar en internet para hoy o ayer (tasa reciente)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  if (date !== today && date !== yesterday) {
    return NextResponse.json({ rate: null, source: 'none', date })
  }

  // 3. Obtener tasa en vivo
  try {
    const res  = await fetch(LIVE_API, { next: { revalidate: 3600 } })
    const json = await res.json()
    const rate: number | undefined = json?.rates?.PEN

    if (!rate) return NextResponse.json({ rate: null, source: 'none', date })

    // 4. Guardar en BD para uso futuro (upsert por si ya existe)
    await supabase
      .from('exchange_rates')
      .upsert({ date, usd_to_pen: rate, source: 'open.er-api.com' }, { onConflict: 'date' })

    return NextResponse.json({ rate, source: 'live', date })
  } catch {
    return NextResponse.json({ rate: null, source: 'error', date })
  }
}
