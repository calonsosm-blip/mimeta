'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts'

const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

interface MonthData {
  month: number
  income: number
  expenses: number
  balance: number
  cumulative: number
  hasData: boolean
}

interface Props {
  data: MonthData[]
  selectedYear: number
  invisible?: boolean
}

function fmt(n: number) {
  return new Intl.NumberFormat('es', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function CustomTooltip({ active, payload, label, viewMode, invisible }: any) {
  if (!active || !payload?.length) return null
  const d: MonthData = payload[0]?.payload
  if (!d?.hasData) return null

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-lg p-3 text-xs min-w-[150px]">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {viewMode === 'monthly' ? (
        <>
          <div className="flex justify-between gap-4 text-emerald-600">
            <span>Ingresos</span>
            <span className="font-medium">{invisible ? '••••' : `S/ ${fmt(d.income)}`}</span>
          </div>
          <div className="flex justify-between gap-4 text-red-500">
            <span>Egresos</span>
            <span className="font-medium">{invisible ? '••••' : `S/ ${fmt(d.expenses)}`}</span>
          </div>
          <div className={`flex justify-between gap-4 font-semibold mt-1 pt-1 border-t border-gray-100 ${d.balance >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
            <span>Balance</span>
            <span>{invisible ? '••••' : `S/ ${fmt(d.balance)}`}</span>
          </div>
        </>
      ) : (
        <div className={`flex justify-between gap-4 font-semibold ${d.cumulative >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
          <span>Acumulado</span>
          <span>{invisible ? '••••' : `S/ ${fmt(d.cumulative)}`}</span>
        </div>
      )}
    </div>
  )
}

export function MonthlySavingsChart({ data, selectedYear, invisible = false }: Props) {
  const [viewMode, setViewMode] = useState<'monthly' | 'cumulative'>('monthly')

  const visibleData = data.map(d => ({
    ...d,
    name: MONTH_SHORT[d.month - 1],
    displayValue: viewMode === 'monthly' ? d.balance : d.cumulative,
  }))

  const hasAnyData = data.some(d => d.hasData)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Evolución de ahorros {selectedYear}</h2>
          <p className="text-xs text-gray-400 mt-0.5">Balance mensual (ingresos − egresos)</p>
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-3 py-1.5 transition-colors ${viewMode === 'monthly' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Mensual
          </button>
          <button
            onClick={() => setViewMode('cumulative')}
            className={`px-3 py-1.5 transition-colors ${viewMode === 'cumulative' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Acumulado
          </button>
        </div>
      </div>

      {!hasAnyData ? (
        <p className="text-sm text-gray-400 text-center py-10">Sin movimientos en {selectedYear}.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={visibleData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barSize={28}>
            <CartesianGrid vertical={false} stroke="#f3f4f6" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={60}
              tickFormatter={v => invisible ? '••••' : `S/${fmt(v)}`}
            />
            <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={1.5} />
            <Tooltip
              content={<CustomTooltip viewMode={viewMode} invisible={invisible} />}
              cursor={{ fill: '#f9fafb', radius: 6 }}
            />
            <Bar dataKey="displayValue" radius={[4, 4, 0, 0]}>
              {visibleData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    !entry.hasData
                      ? '#f3f4f6'
                      : entry.displayValue >= 0
                      ? '#6366f1'
                      : '#ef4444'
                  }
                  opacity={entry.hasData ? 1 : 0.4}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
