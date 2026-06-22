'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useIsMobile } from '@/hooks/useIsMobile'

const COLORS = [
  '#ea580c', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4',
  '#ec4899', '#84cc16', '#f97316', '#a78bfa', '#34d399',
]

interface CategoryData { name: string; total: number }
interface Props { data: CategoryData[]; invisible?: boolean; sym?: string }

function fmt(n: number) {
  return new Intl.NumberFormat('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

const TOP_N = 6

export function ExpenseDonutChart({ data, invisible = false, sym = 'S/' }: Props) {
  const [viewMode, setViewMode] = useState<'percent' | 'amount'>('percent')
  const isMobile = useIsMobile()

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

  const visibleData   = isMobile ? chartData.slice(0, TOP_N) : chartData
  const othersData    = isMobile ? chartData.slice(TOP_N) : []
  const othersValue   = othersData.reduce((s, d) => s + d.value, 0)
  const othersPercent = total > 0 ? (othersValue / total) * 100 : 0
  const hasOthers     = othersData.length > 0

  // En móvil el donut usa los mismos datos que la leyenda
  const donutData = hasOthers
    ? [...visibleData, { name: `Otros (${othersData.length})`, value: othersValue, percent: othersPercent }]
    : chartData
  const DONUT_COLORS = hasOthers ? [...COLORS.slice(0, TOP_N), '#94a3b8'] : COLORS

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

      <div className="flex flex-row gap-4 items-center">
        {/* Donut */}
        <div className="relative shrink-0 w-32 h-32 sm:w-40 sm:h-40" style={{ overflow: 'visible' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={isMobile ? 42 : 52}
                outerRadius={isMobile ? 64 : 80}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {donutData.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  invisible ? '••••' : `${sym} ${fmt(Number(value))}`,
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
              {invisible ? '••••' : `${sym} ${fmt(total)}`}
            </p>
          </div>
        </div>

        {/* Leyenda */}
        <div className="flex-1 space-y-2.5 min-w-0">
          {visibleData.map((item, i) => (
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
                  : `${sym} ${fmt(item.value)}`}
              </span>
            </div>
          ))}

          {hasOthers && (
            <div className="flex items-center gap-2">
              <span className="shrink-0 w-2.5 h-2.5 rounded-full bg-slate-400" />
              <span className="text-xs text-muted-foreground flex-1">Otros ({chartData.length - TOP_N})</span>
              <span className="text-xs font-semibold text-foreground shrink-0 tabular-nums">
                {invisible
                  ? '••••'
                  : viewMode === 'percent'
                  ? `${othersPercent.toFixed(1)}%`
                  : `${sym} ${fmt(othersValue)}`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
