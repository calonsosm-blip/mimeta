import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const USD_TO_PEN = 3.75

function calcNextDueDate(current: string, frequency: string, dayOfMonth: number | null): string {
  // Parse as local noon to avoid TZ shifts
  const d = new Date(current + 'T12:00:00')

  switch (frequency) {
    case 'daily':
      d.setDate(d.getDate() + 1)
      break
    case 'weekly':
      d.setDate(d.getDate() + 7)
      break
    case 'biweekly':
      d.setDate(d.getDate() + 14)
      break
    case 'monthly': {
      d.setMonth(d.getMonth() + 1)
      if (dayOfMonth) {
        // Snap to configured day (e.g. always the 15th)
        const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
        d.setDate(Math.min(dayOfMonth, maxDay))
      }
      break
    }
    case 'annual':
      d.setFullYear(d.getFullYear() + 1)
      break
  }

  return d.toISOString().split('T')[0]
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const today = new Date().toISOString().split('T')[0]

    // Pagos vencidos con auto-registro activo
    const { data: payments, error: fetchError } = await supabase
      .from('planned_payments')
      .select('*')
      .eq('is_active', true)
      .eq('auto_register', true)
      .lte('next_due_date', today)

    if (fetchError) throw fetchError

    if (!payments?.length) {
      return new Response(JSON.stringify({ registered: 0, message: 'Sin pagos pendientes' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results: { concept: string; date: string; status: 'ok' | 'error'; error?: string }[] = []

    for (const payment of payments) {
      const amountPen =
        payment.currency === 'USD'
          ? Math.round(Number(payment.amount) * USD_TO_PEN * 100) / 100
          : Number(payment.amount)

      // Registrar transacción
      const { error: txError } = await supabase.from('transactions').insert({
        user_id:     payment.user_id,
        date:        payment.next_due_date,
        type:        'expense',
        category_id: payment.category_id,
        concept:     payment.concept,
        amount:      Number(payment.amount),
        currency:    payment.currency,
        amount_pen:  amountPen,
        notes:       'Registrado automáticamente',
      })

      if (txError) {
        results.push({ concept: payment.concept, date: payment.next_due_date, status: 'error', error: txError.message })
        continue
      }

      // Avanzar fecha al siguiente ciclo
      const nextDate = calcNextDueDate(payment.next_due_date, payment.frequency, payment.day_of_month)
      await supabase
        .from('planned_payments')
        .update({ next_due_date: nextDate, updated_at: new Date().toISOString() })
        .eq('id', payment.id)

      results.push({ concept: payment.concept, date: payment.next_due_date, status: 'ok' })
    }

    const registered = results.filter(r => r.status === 'ok').length
    const errors     = results.filter(r => r.status === 'error')

    return new Response(JSON.stringify({ registered, errors, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
