import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const FROM_EMAIL = 'MiMeta <onboarding@resend.dev>'
const MONTH_ES   = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
const MONTH_CAP  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmt(n: number) {
  return n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function buildHtml(data: {
  userName: string
  monthLabel: string
  income: number
  expenses: number
  balance: number
  savingsRate: number | null
  topCategories: { name: string; total: number }[]
  txCount: number
  appUrl: string
}) {
  const { userName, monthLabel, income, expenses, balance, savingsRate, topCategories, txCount, appUrl } = data

  const balanceColor = balance >= 0 ? '#10b981' : '#ef4444'
  const srColor = savingsRate === null ? '#6b7280'
    : savingsRate >= 20 ? '#10b981'
    : savingsRate >= 0  ? '#f59e0b'
    : '#ef4444'

  const catRows = topCategories.map(c => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827">${c.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;text-align:right;font-weight:600">
        S/ ${fmt(c.total)}
      </td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">

    <!-- Header -->
    <div style="background:#111827;padding:28px 32px">
      <div style="color:#fff;font-weight:800;font-size:18px;letter-spacing:-0.5px">MiMeta</div>
      <div style="color:rgba(255,255,255,.5);font-size:11px;margin-top:2px">tus metas, más cerca cada día</div>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#111827">Tu resumen de ${monthLabel}</p>
      <p style="margin:0 0 28px;font-size:14px;color:#6b7280">
        Hola${userName ? ` ${userName}` : ''}, aquí está tu resumen financiero del mes pasado.
      </p>

      <!-- Cards -->
      <table style="width:100%;border-collapse:separate;border-spacing:8px;margin:-8px">
        <tr>
          <td style="width:33%;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px">Ingresos</div>
            <div style="font-size:18px;font-weight:700;color:#10b981">S/ ${fmt(income)}</div>
          </td>
          <td style="width:33%;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px">Egresos</div>
            <div style="font-size:18px;font-weight:700;color:#64748b">S/ ${fmt(expenses)}</div>
          </td>
          <td style="width:33%;background:${balance >= 0 ? '#f0fdf4' : '#fef2f2'};border:1px solid ${balance >= 0 ? '#bbf7d0' : '#fecaca'};border-radius:12px;padding:16px;text-align:center">
            <div style="font-size:11px;color:#6b7280;margin-bottom:4px">Balance</div>
            <div style="font-size:18px;font-weight:700;color:${balanceColor}">${balance >= 0 ? '+' : ''}S/ ${fmt(balance)}</div>
          </td>
        </tr>
      </table>

      <!-- Stats row -->
      <table style="width:100%;margin-top:20px"><tr><td style="text-align:center">
        <table style="display:inline-table;border-collapse:separate;border-spacing:8px">
          <tr>
            ${savingsRate !== null ? `
            <td style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:14px;text-align:center;min-width:130px">
              <div style="font-size:11px;color:#6b7280;margin-bottom:4px">Tasa de ahorro</div>
              <div style="font-size:20px;font-weight:700;color:${srColor}">${savingsRate.toFixed(1)}%</div>
            </td>` : ''}
            <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;text-align:center;min-width:130px">
              <div style="font-size:11px;color:#6b7280;margin-bottom:4px">Transacciones</div>
              <div style="font-size:20px;font-weight:700;color:#111827">${txCount}</div>
            </td>
          </tr>
        </table>
      </td></tr></table>

      <!-- Top categorías -->
      ${topCategories.length > 0 ? `
      <p style="margin:28px 0 12px;font-size:14px;font-weight:600;color:#111827">Top categorías de gasto</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Categoría</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Total</th>
          </tr>
        </thead>
        <tbody>${catRows}</tbody>
      </table>` : ''}

      <!-- CTA -->
      <div style="margin-top:28px;text-align:center">
        <a href="${appUrl}/reports/monthly?export=pdf"
           style="display:inline-block;background:#0E7C4A;color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:10px;text-decoration:none">
          Ver reporte completo
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1px solid #f3f4f6;text-align:center">
      <p style="margin:0;font-size:11px;color:#9ca3af">
        MiMeta · Lima, Perú<br>
        <a href="${appUrl}/settings" style="color:#9ca3af">Gestionar notificaciones</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? Deno.env.get('resend_api_key')
    if (!resendKey) throw new Error('RESEND_API_KEY no configurada')

    const appUrl = Deno.env.get('APP_URL') ?? 'https://mimeta-web.vercel.app'

    // Mes anterior
    const now       = new Date()
    const prevYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
    const days      = new Date(prevYear, prevMonth, 0).getDate()
    const dateFrom  = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
    const dateTo    = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(days).padStart(2, '0')}`
    const monthLabel = `${MONTH_CAP[prevMonth - 1]} ${prevYear}`

    // Usuarios premium con reporte habilitado
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, display_name, base_currency')
      .eq('plan', 'premium')
      .eq('monthly_report_email', true)

    if (error) throw error
    if (!profiles?.length) {
      return new Response(JSON.stringify({ sent: 0, message: 'Sin usuarios habilitados' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let sent = 0
    const emailErrors: string[] = []

    for (const profile of profiles) {
      const { data: { user } } = await supabase.auth.admin.getUserById(profile.id)
      if (!user?.email) continue

      // Transacciones del mes anterior
      const { data: txs } = await supabase
        .from('transactions')
        .select('type, amount_pen, categories(name)')
        .eq('user_id', profile.id)
        .gte('date', dateFrom)
        .lte('date', dateTo)

      const rows      = txs ?? []
      const income    = rows.filter(t => t.type === 'income').reduce((s, t) => s + t.amount_pen, 0)
      const expenses  = rows.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount_pen, 0)
      const balance   = income - expenses
      const savingsRate = income > 0 ? ((income - expenses) / income) * 100 : null

      // Top 3 categorías de gasto
      const catMap = new Map<string, number>()
      rows.filter(t => t.type === 'expense').forEach(t => {
        const cat = (t.categories as any)?.name ?? 'Sin categoría'
        catMap.set(cat, (catMap.get(cat) ?? 0) + t.amount_pen)
      })
      const topCategories = Array.from(catMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, total]) => ({ name, total }))

      const html = buildHtml({
        userName: profile.display_name ?? '',
        monthLabel,
        income,
        expenses,
        balance,
        savingsRate,
        topCategories,
        txCount: rows.length,
        appUrl,
      })

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from:    FROM_EMAIL,
          to:      user.email,
          subject: `Tu resumen de ${MONTH_ES[prevMonth - 1]} en MiMeta`,
          html,
        }),
      })

      if (!res.ok) {
        emailErrors.push(`${user.email}: ${await res.text()}`)
      } else {
        sent++
      }
    }

    return new Response(JSON.stringify({ sent, month: monthLabel, errors: emailErrors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
