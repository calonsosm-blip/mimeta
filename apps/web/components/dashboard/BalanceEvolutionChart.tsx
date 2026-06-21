'use client'

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

export interface MonthBalance {
  label: string
  income: number
  expenses: number
  balance: number
}

interface Props {
  data: MonthBalance[]
  invisible?: boolean
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

export function BalanceEvolutionChart({ data, invisible = false }: Props) {
  const hasData = data.some(d => d.income > 0 || d.expenses > 0)

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground mb-5">Evolución de balance (12 meses)</h2>

      {!hasData ? (
        <p className="text-sm text-muted-foreground text-center py-10">Sin datos suficientes aún.</p>
      ) : (
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradInc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f87171" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={v => `S/${fmt(v)}`}
                width={64}
              />
              <Tooltip
                formatter={(value: number, name: string) => [
                  invisible ? '••••' : `S/ ${fmt(value)}`,
                  name === 'income' ? 'Ingresos' : name === 'expenses' ? 'Egresos' : 'Balance',
                ]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                  color: 'var(--foreground)',
                }}
              />
              <Area
                type="monotone"
                dataKey="income"
                stroke="#10b981"
                fill="url(#gradInc)"
                strokeWidth={2}
                dot={false}
                name="income"
              />
              <Area
                type="monotone"
                dataKey="expenses"
                stroke="#f87171"
                fill="url(#gradExp)"
                strokeWidth={2}
                dot={false}
                name="expenses"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Leyenda */}
      {hasData && (
        <div className="flex gap-5 mt-3 justify-center">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-3 rounded-sm bg-emerald-500 inline-block" />
            Ingresos
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-3 rounded-sm bg-red-400 inline-block" />
            Egresos
          </span>
        </div>
      )}
    </div>
  )
}
