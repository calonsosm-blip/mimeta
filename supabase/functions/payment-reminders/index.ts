import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const DAYS_AHEAD  = 3   // Avisar con 3 días de anticipación
const FROM_EMAIL  = 'MiMeta <onboarding@resend.dev>'

const MONTH_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

function fmtDate(iso: string) {
  const [, m, d] = iso.split('-')
  return `${parseInt(d)} de ${MONTH_ES[parseInt(m) - 1]}`
}

function buildHtml(payments: any[], dueDate: string, userName: string) {
  const rows = payments.map(p => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827">${p.concept}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;text-align:right;font-weight:600">
        ${p.currency} ${Number(p.amount).toFixed(2)}
      </td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <!-- Header -->
    <div style="background:#111827;padding:28px 32px">
      <div style="display:flex;align-items:center;gap:10px">
        <div>
          <div style="color:#fff;font-weight:800;font-size:18px;line-height:1.2;letter-spacing:-0.5px">mimeta</div>
          <div style="color:rgba(255,255,255,.5);font-size:11px;line-height:1.2">tu dinero, tus metas</div>
        </div>
      </div>
    </div>
    <!-- Body -->
    <div style="padding:32px">
      <p style="margin:0 0 6px;font-size:22px;font-weight:700;color:#111827">
        Recordatorio de pagos
      </p>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280">
        Hola${userName ? ` ${userName}` : ''}, tienes <strong style="color:#111827">${payments.length} pago${payments.length > 1 ? 's' : ''}</strong> que vence${payments.length > 1 ? 'n' : ''} el <strong style="color:#ea580c">${fmtDate(dueDate)}</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Concepto</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Monto</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:28px;text-align:center">
        <a href="${Deno.env.get('APP_URL') ?? 'https://mimeta.vercel.app'}/planned-payments"
           style="display:inline-block;background:#ea580c;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none">
          Ver mis pagos
        </a>
      </div>
    </div>
    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #f3f4f6;text-align:center">
      <p style="margin:0;font-size:11px;color:#9ca3af">
        MiMeta · Lima, Perú<br>
        <a href="${Deno.env.get('APP_URL') ?? 'https://mimeta.vercel.app'}/settings" style="color:#9ca3af">Gestionar notificaciones</a>
      </p>
    </div>
  </div>
</body>
</html>`
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
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) throw new Error('RESEND_API_KEY no configurada')

    // Fecha objetivo: hoy + DAYS_AHEAD
    const target = new Date()
    target.setDate(target.getDate() + DAYS_AHEAD)
    const targetStr = target.toISOString().split('T')[0]

    // Pagos activos que vencen exactamente en DAYS_AHEAD días
    const { data: payments, error } = await supabase
      .from('planned_payments')
      .select('*')
      .eq('is_active', true)
      .eq('next_due_date', targetStr)

    if (error) throw error
    if (!payments?.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'Sin recordatorios para hoy' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Agrupar por usuario
    const byUser: Record<string, typeof payments> = {}
    for (const p of payments) {
      if (!byUser[p.user_id]) byUser[p.user_id] = []
      byUser[p.user_id].push(p)
    }

    let sent = 0
    const emailErrors: string[] = []

    for (const [userId, userPayments] of Object.entries(byUser)) {
      // Obtener email del usuario
      const { data: { user } } = await supabase.auth.admin.getUserById(userId)
      if (!user?.email) continue

      // Obtener nombre del perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .single()
      const userName = profile?.display_name ?? ''

      const html = buildHtml(userPayments, targetStr, userName)
      const subject = `${userPayments.length} pago${userPayments.length > 1 ? 's' : ''} vence${userPayments.length > 1 ? 'n' : ''} el ${fmtDate(targetStr)}`

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    FROM_EMAIL,
          to:      user.email,
          subject,
          html,
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        emailErrors.push(`${user.email}: ${body}`)
      } else {
        sent++
      }
    }

    return new Response(JSON.stringify({ sent, targetDate: targetStr, errors: emailErrors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
