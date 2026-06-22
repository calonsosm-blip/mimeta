'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const COLORS = [
  '#ea580c', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4',
  '#ec4899', '#84cc16', '#f97316', '#a78bfa', '#34d399',
]

interface CategoryData { name: string; total: number }
interface Props { data: CategoryData[]; invisible?: boolean }

function fmt(n: number) {
  return new Intl.NumberFormat('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

export function ExpenseDonutChart({ data, invisible = false }: Props) {
  const [viewMode, setViewMode] = useState<'percent' | 'amount'>('percent')

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-foreground mb-4">Distribución de gastos</h2>
        <p className="text-sm text-muted-foreground text-center py-10">Sin gastos en este período.</p>
      </div>
    )
  }

  const total = data.reduce((s, d) => s + d.total, 0)
  const chartData = data.map(d => ({
    name: d.name,
    value: d.total,
    percent: total > 0 ? (d.total / total) * 100 : 0,
  }))

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-semibold text-foreground">Distribución de gastos</h2>
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          <button
            onClick={() => setViewMode('percent')}
            className={`px-3 py-1.5 transition-colors ${viewMode === 'percent' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            %
          </button>
          <button
            onClick={() => setViewMode('amount')}
            className={`px-3 py-1.5 transition-colors ${viewMode === 'amount' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
          >
            S/
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
        {/* Donut */}
        <div className="relative shrink-0 w-32 h-32 sm:w-40 sm:h-40 mx-auto sm:mx-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  invisible ? '••••' : `S/ ${fmt(Number(value))}`,
                  String(name),
                ]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--card)',
                  color: 'var(--foreground)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-xs text-muted-foreground leading-none">Total</p>
            <p className="text-sm font-bold text-foreground mt-0.5">
              {invisible ? '••••' : `S/ ${fmt(total)}`}
            </p>
          </div>
        </div>

        {/* Leyenda */}
        <div className="flex-1 space-y-2.5 min-w-0">
          {chartData.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="shrink-0 w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">{item.name}</span>
              <span className="text-xs font-semibold text-foreground shrink-0 tabular-nums">
                {invisible
                  ? '••••'
                  : viewMode === 'percent'
                  ? `${item.percent.toFixed(1)}%`
                  : `S/ ${fmt(item.value)}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
