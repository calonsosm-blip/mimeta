'use client'

interface Props {
  expenses: number
  income: number
  budget: number
  today: number
  daysInMonth: number
  invisible: boolean
  isCurrentMonth: boolean
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export function MonthThermometer({ expenses, income, budget, today, daysInMonth, invisible, isCurrentMonth }: Props) {
  const hasBudget = budget > 0

  const spentPct = hasBudget ? Math.min((expenses / budget) * 100, 100) : 0
  const daysRemaining = Math.max(daysInMonth - today, 1)
  const remaining = budget - expenses
  const dailyMargin = hasBudget ? remaining / daysRemaining : 0
  const alreadyOver = hasBudget && expenses > budget

  const status = !hasBudget
    ? 'neutral'
    : alreadyOver
      ? 'over'
      : spentPct > 85
        ? 'warning'
        : 'ok'

  const colors = {
    ok:      { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40',  border: 'border-emerald-200 dark:border-emerald-900' },
    warning: { bar: 'bg-amber-400',   text: 'text-amber-700 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-950/40',       border: 'border-amber-200 dark:border-amber-900'    },
    danger:  { bar: 'bg-red-400',     text: 'text-red-700 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-950/40',           border: 'border-red-200 dark:border-red-900'        },
    over:    { bar: 'bg-red-600',     text: 'text-red-800 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-950/40',           border: 'border-red-200 dark:border-red-900'        },
    neutral: { bar: 'bg-primary',     text: 'text-primary',                           bg: 'bg-accent',                              border: 'border-border'                              },
  }[status]

  const isFutureMonth = today === 0 && !isCurrentMonth

  const label = isCurrentMonth
    ? ({ ok: '¡Vas bien este mes!', warning: 'Vas acercándote al límite de tu presupuesto este mes.', danger: 'Al ritmo actual superarás el presupuesto.', over: 'Estás gastando más de lo planificado este mes.', neutral: 'Sin presupuesto configurado' } as Record<string, string>)[status]
    : isFutureMonth
      ? (hasBudget ? 'Mes aún no iniciado — presupuesto planificado' : 'Mes aún no iniciado — sin presupuesto')
      : ({ neutral: 'Sin presupuesto en este período', ok: 'Presupuesto cumplido', warning: 'Presupuesto algo ajustado', danger: 'Presupuesto superado', over: 'Presupuesto superado' } as Record<string, string>)[status]

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} p-6 shadow-sm`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Termómetro de fin de mes</h2>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors.text} border ${colors.border}`}>
          Día {today}/{daysInMonth}
        </span>
      </div>

      {/* Barra principal */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Gasto actual</span>
          {hasBudget && <span>{Math.round(spentPct)}% del presupuesto</span>}
        </div>
        <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${colors.bar}`}
            style={{ width: hasBudget ? `${spentPct}%` : '0%' }}
          />
        </div>
      </div>

      {/* Cifras */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Gastado</p>
          <p className="font-semibold text-foreground">S/ {invisible ? '••••' : fmt(expenses)}</p>
        </div>
        {hasBudget ? (
          <>
            <div>
              <p className="text-xs text-muted-foreground">Presupuesto</p>
              <p className="font-semibold text-foreground">S/ {invisible ? '••••' : fmt(budget)}</p>
            </div>
            {isCurrentMonth && !alreadyOver && (
              <div>
                <p className="text-xs text-muted-foreground">Margen por día</p>
                <p className={`font-semibold ${dailyMargin < 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                  {invisible ? '••••' : `S/ ${fmt(Math.max(dailyMargin, 0))} / día`}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">{alreadyOver ? 'Excedido en' : 'Disponible'}</p>
              <p className={`font-semibold ${alreadyOver ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                S/ {invisible ? '••••' : fmt(Math.abs(budget - expenses))}
              </p>
            </div>
          </>
        ) : (
          <div className="col-span-1">
            <a href="/budgets" className="text-xs text-primary hover:underline">
              Configurar presupuesto →
            </a>
          </div>
        )}
      </div>

      <p className={`mt-3 text-xs font-medium ${colors.text}`}>{label}</p>

      {!isFutureMonth && income === 0 && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          Sin ingresos registrados en este período
        </p>
      )}
    </div>
  )
}
