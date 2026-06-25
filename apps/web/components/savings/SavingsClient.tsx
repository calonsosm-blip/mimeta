'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Pencil, Trash2, CheckCircle2, Zap, SlidersHorizontal, RotateCcw, HelpCircle } from 'lucide-react'
import { useCurrency } from '@/hooks/useCurrency'
import { getLimits } from '@/lib/planLimits'
import { UpgradePrompt } from '@/components/ui/UpgradePrompt'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

/* ─── Tipos ─────────────────────────────────────────────── */
interface Snapshot {
  id: string; year: number; month: number; amount: number; notes: string | null
}
interface Goal {
  id: string; name: string; target_amount: number; current_amount: number
  target_date: string | null; emoji: string; is_completed: boolean; notes: string | null
}
interface Props {
  snapshots: Snapshot[]; goals: Goal[]; userId: string
  accumulatedBalance: number; monthlyBalance: number; currentMonthLabel: string
  baseCurrency: 'PEN' | 'USD'
  plan: 'free' | 'premium'
}

/* ─── Constantes ─────────────────────────────────────────── */
const MONTHS      = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MONTHS_LONG = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const EMOJIS      = ['🎯','💰','🏠','🚗','🌍','📚','✈️','💍','🏖️','🎓','💻','🎮','🏋️','👨‍👩‍👧','🛡️']
const GOAL_COLORS = ['#fb923c','#34d399','#60a5fa','#a78bfa','#fbbf24','#f472b6','#22d3ee','#4ade80','#f87171','#c084fc']
const EMPTY_GOAL  = { name:'', target_amount:'', current_amount:'0', target_date:'', emoji:'🎯', notes:'' }


/* ─── Componente ─────────────────────────────────────────── */
export function SavingsClient({
  snapshots: initial, goals: initialGoals, userId,
  accumulatedBalance, monthlyBalance, currentMonthLabel, baseCurrency, plan,
}: Props) {
  const supabase = createClient()
  const { sym, fromPen, fmt } = useCurrency(baseCurrency)
  const fmtShort = (n: number) => {
    const v = fromPen(n)
    return v >= 1000 ? `${sym} ${(v / 1000).toFixed(1)}k` : `${sym} ${Math.round(v)}`
  }

  /* ── Modo ── */
  const [mode, setMode] = useState<'manual' | 'auto'>(() => {
    if (typeof window === 'undefined') return 'manual'
    return (localStorage.getItem('savings-mode') as 'manual' | 'auto') ?? 'manual'
  })
  function switchMode(m: 'manual' | 'auto') {
    setMode(m)
    localStorage.setItem('savings-mode', m)
  }

  /* ── Modo automático ── */
  const [goalPcts, setGoalPcts] = useState<Record<string, number>>(() => {
    const active = initialGoals.filter(g => !g.is_completed)
    const pct    = active.length > 0 ? Math.min(Math.floor(20 / active.length) || 5, 20) : 10
    return Object.fromEntries(active.map(g => [g.id, pct]))
  })
  const [autoLoading, setAutoLoading]   = useState(false)
  const [autoApplied, setAutoApplied]   = useState(false)
  const [undoLoading, setUndoLoading]       = useState(false)
  const [showUndoConfirm, setShowUndoConfirm] = useState(false)

  /* ── Goals state ── */
  const [goals, setGoals]              = useState(initialGoals)
  const [showGoalForm, setShowGoalForm] = useState(false)
  const [editingGoal, setEditingGoal]   = useState<Goal | null>(null)
  const [goalForm, setGoalForm]         = useState<any>(EMPTY_GOAL)
  const [goalLoading, setGoalLoading]   = useState(false)
  const [showUpgrade, setShowUpgrade]   = useState(false)
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  const limits = getLimits(plan)
  const [updatingId, setUpdatingId]     = useState<string | null>(null)
  const [updateAmount, setUpdateAmount] = useState('')
  const [updateError, setUpdateError]   = useState('')
  const [hovered, setHovered]           = useState<string | null>(null)

  /* ── Snapshots state ── */
  const [snapshots, setSnapshots]     = useState(initial)
  const now = new Date()
  const yr  = now.getFullYear(); const mo = now.getMonth() + 1

  /* ── Mes seleccionado en modo auto ── */
  const [selYear,  setSelYear]  = useState(yr)
  const [selMonth, setSelMonth] = useState(mo)
  const [selBalance, setSelBalance]   = useState(monthlyBalance)
  const [selBalLoading, setSelBalLoading] = useState(false)

  const isCurrentMonth = selYear === yr && selMonth === mo
  const canApplyByDate = !isCurrentMonth || now.getDate() >= 21

  // Claves dinámicas según mes seleccionado
  const ymKey        = `savings-auto-applied-${selYear}-${selMonth}`
  const ymContribKey = `savings-auto-contribs-${selYear}-${selMonth}`

  const [appliedThisMonth, setAppliedThisMonth] = useState<number>(() => {
    if (typeof window === 'undefined') return 0
    return parseFloat(localStorage.getItem(`savings-auto-applied-${yr}-${mo}`) ?? '0') || 0
  })
  const [hasContribs, setHasContribs] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return !!localStorage.getItem(`savings-auto-contribs-${yr}-${mo}`)
  })

  // Sincronizar estado cuando cambia el mes seleccionado
  useEffect(() => {
    setAppliedThisMonth(parseFloat(localStorage.getItem(ymKey) ?? '0') || 0)
    setHasContribs(!!localStorage.getItem(ymContribKey))
  }, [ymKey, ymContribKey])

  // Obtener balance del mes seleccionado (si es distinto al actual)
  useEffect(() => {
    if (isCurrentMonth) { setSelBalance(monthlyBalance); return }
    setSelBalLoading(true)
    supabase.rpc('get_monthly_balance', { p_user_id: userId, p_year: selYear, p_month: selMonth })
      .then(({ data }) => {
        const row = (data as any)?.[0] ?? { balance: 0 }
        setSelBalance(Math.max(Number(row.balance ?? 0), 0))
        setSelBalLoading(false)
      })
  }, [selYear, selMonth, isCurrentMonth, monthlyBalance, userId])

  // Opciones de mes: mes actual + 11 meses anteriores
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(yr, mo - 1 - i, 1)
    return {
      year: d.getFullYear(), month: d.getMonth() + 1,
      label: d.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' }),
    }
  })

  /* ── Totales ── */
  const activeGoals    = goals.filter(g => !g.is_completed)
  const completedGoals = goals.filter(g => g.is_completed)
  const totalAllocated = goals.reduce((s, g) => s + Number(g.current_amount), 0)
  const totalSaved     = activeGoals.reduce((s, g) => s + Number(g.current_amount), 0)
  const totalTarget    = activeGoals.reduce((s, g) => s + Number(g.target_amount), 0)
  const totalPct       = totalTarget > 0 ? Math.min(Math.round((totalSaved / totalTarget) * 100), 100) : 0
  const poolBalance    = accumulatedBalance
  const poolAvailable  = Math.max(poolBalance - totalAllocated, 0)
  const poolPct        = poolBalance > 0 ? Math.min(Math.round((totalAllocated / poolBalance) * 100), 100) : 0

  /* ── Distribución automática por meta ── */
  const monthlyAvailable = Math.max(selBalance - appliedThisMonth, 0)
  const autoDistribution = activeGoals.map(g => {
    const pct       = goalPcts[g.id] ?? 0
    const rawAdd    = Math.round(monthlyAvailable * (pct / 100) * 100) / 100
    const remaining = Math.max(Number(g.target_amount) - Number(g.current_amount), 0)
    const add       = Math.round(Math.min(rawAdd, remaining) * 100) / 100
    const newAmount = Math.round((Number(g.current_amount) + add) * 100) / 100
    return { goal: g, pct, add, newAmount }
  })
  const totalPctAssigned      = activeGoals.reduce((s, g) => s + (goalPcts[g.id] ?? 0), 0)
  const effectiveContribution = autoDistribution.reduce((s, d) => s + d.add, 0)
  const newTotalAfterAuto     = totalAllocated + effectiveContribution
  const autoExceedsPool       = newTotalAfterAuto > poolBalance
  const pctExceeds100         = totalPctAssigned > 100

  /* ══ Handlers goals ══════════════════════════════════════ */
  function openNewGoal() {
    if (goals.length >= limits.savings_goals) { setShowUpgrade(true); return }
    setEditingGoal(null); setGoalForm(EMPTY_GOAL); setShowGoalForm(true)
  }
  function openEditGoal(g: Goal) {
    setEditingGoal(g)
    setGoalForm({ name: g.name, target_amount: g.target_amount.toString(), current_amount: g.current_amount.toString(), target_date: g.target_date ?? '', emoji: g.emoji, notes: g.notes ?? '' })
    setShowGoalForm(true)
  }
  async function handleGoalSave(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      user_id: userId, name: goalForm.name.trim(),
      target_amount: parseFloat(goalForm.target_amount),
      current_amount: parseFloat(goalForm.current_amount) || 0,
      target_date: goalForm.target_date || null,
      emoji: goalForm.emoji, notes: goalForm.notes.trim() || null,
    }
    if (!payload.name || isNaN(payload.target_amount) || payload.target_amount <= 0) return
    setGoalLoading(true)
    if (editingGoal) {
      const { data } = await supabase.from('savings_goals').update(payload).eq('id', editingGoal.id).select('*').single()
      if (data) setGoals(prev => prev.map(g => g.id === editingGoal.id ? data : g))
    } else {
      const { data } = await supabase.from('savings_goals').insert(payload).select('*').single()
      if (data) { setGoals(prev => [data, ...prev]); addGoalPct(data.id) }
    }
    setGoalLoading(false); setShowGoalForm(false)
  }
  function deleteGoal(id: string) {
    setConfirm({
      title: 'Eliminar meta de ahorro',
      message: '¿Estás seguro? Se perderá todo el historial de esta meta.',
      onConfirm: async () => {
        await supabase.from('savings_goals').delete().eq('id', id)
        setGoals(prev => prev.filter(g => g.id !== id))
        removeGoalPct(id)
        setConfirm(null)
      },
    })
  }
  async function toggleCompleted(g: Goal) {
    const { data } = await supabase.from('savings_goals').update({ is_completed: !g.is_completed }).eq('id', g.id).select('*').single()
    if (data) setGoals(prev => prev.map(x => x.id === g.id ? data : x))
  }
  async function applyUpdate(g: Goal) {
    const val    = parseFloat(updateAmount)
    const target = Number(g.target_amount)
    if (isNaN(val) || val < 0) return
    if (val > target) {
      setUpdateError(`Máximo permitido: ${sym} ${fmt(fromPen(target))} (monto objetivo)`)
      return
    }
    const otherAllocated = goals.filter(x => x.id !== g.id).reduce((s, x) => s + Number(x.current_amount), 0)
    if (otherAllocated + val > poolBalance) {
      setUpdateError(`Máximo disponible: ${sym} ${fmt(fromPen(Math.max(poolBalance - otherAllocated, 0)))}`)
      return
    }
    setUpdateError('')
    const { data } = await supabase.from('savings_goals')
      .update({ current_amount: val, is_completed: val >= Number(g.target_amount) }).eq('id', g.id).select('*').single()
    if (data) setGoals(prev => prev.map(x => x.id === g.id ? data : x))
    setUpdatingId(null); setUpdateAmount('')
  }

  /* ══ Handler automático ═══════════════════════════════════ */
  async function applyAutoContribution() {
    if (autoExceedsPool || pctExceeds100 || effectiveContribution <= 0 || activeGoals.length === 0) return
    setAutoLoading(true)
    // Acumular cuánto se suma por meta (para poder deshacer)
    const existing: Record<string, number> = JSON.parse(localStorage.getItem(ymContribKey) ?? '{}')
    for (const { goal, newAmount } of autoDistribution) {
      if (newAmount <= Number(goal.current_amount)) continue
      const added = Math.round((newAmount - Number(goal.current_amount)) * 100) / 100
      existing[goal.id] = Math.round(((existing[goal.id] ?? 0) + added) * 100) / 100
      await supabase.from('savings_goals')
        .update({ current_amount: newAmount, is_completed: newAmount >= Number(goal.target_amount) })
        .eq('id', goal.id)
    }
    localStorage.setItem(ymContribKey, JSON.stringify(existing))
    setHasContribs(true)
    const { data } = await supabase.from('savings_goals').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (data) setGoals(data)
    const newApplied = Math.round((appliedThisMonth + effectiveContribution) * 100) / 100
    setAppliedThisMonth(newApplied)
    localStorage.setItem(ymKey, newApplied.toString())
    setAutoLoading(false); setAutoApplied(true)
    setTimeout(() => setAutoApplied(false), 3000)
  }

  async function undoAutoContribution() {
    setUndoLoading(true)
    const raw = localStorage.getItem(ymContribKey)
    if (raw) {
      // Revertir montos en Supabase
      const contribs: Record<string, number> = JSON.parse(raw)
      const { data: freshGoals } = await supabase.from('savings_goals').select('*').eq('user_id', userId)
      const fresh = freshGoals ?? []
      for (const [goalId, added] of Object.entries(contribs)) {
        const goal = fresh.find((g: any) => g.id === goalId)
        if (!goal) continue
        const newAmount = Math.max(Math.round((Number(goal.current_amount) - added) * 100) / 100, 0)
        await supabase.from('savings_goals')
          .update({ current_amount: newAmount, is_completed: newAmount >= Number(goal.target_amount) })
          .eq('id', goalId)
      }
      const { data } = await supabase.from('savings_goals').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      if (data) setGoals(data)
      localStorage.removeItem(ymContribKey)
    }
    // Siempre resetear el contador del mes
    localStorage.removeItem(ymKey)
    setAppliedThisMonth(0)
    setHasContribs(false)
    setUndoLoading(false)
  }

  /* cuando se crea una meta nueva, la registramos con % inicial */
  function addGoalPct(id: string) {
    setGoalPcts(prev => ({ ...prev, [id]: 10 }))
  }
  function removeGoalPct(id: string) {
    setGoalPcts(prev => { const n = { ...prev }; delete n[id]; return n })
  }
  function setGoalPct(id: string, pct: number) {
    setGoalPcts(prev => ({ ...prev, [id]: Math.min(100, Math.max(0, pct)) }))
  }

  const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring'

  return (
    <div className="space-y-5">
      <UpgradePrompt
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="metas de ahorro"
        limit={limits.savings_goals}
        unit="metas"
      />
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        onConfirm={confirm?.onConfirm ?? (() => {})}
        onClose={() => setConfirm(null)}
      />

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight text-foreground">Metas de ahorro</h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Switch Manual / Automático */}
          {activeGoals.length > 0 && (
            <button
              onClick={() => switchMode(mode === 'manual' ? 'auto' : 'manual')}
              className="flex items-center gap-2 group"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                {mode === 'auto'
                  ? <><Zap className="h-3.5 w-3.5 text-primary" /><span className="text-foreground">Automático</span></>
                  : <><SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Manual</span></>
                }
              </div>
              <div className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${mode === 'auto' ? 'bg-primary' : 'bg-border'}`}>
                <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${mode === 'auto' ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </button>
          )}
          <button
            onClick={openNewGoal}
            className="rounded-[9px] bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            + Nueva meta
          </button>
        </div>
      </div>

      {/* ── Balance acumulado + Progreso total (lado a lado) ── */}
      <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 grid grid-cols-3 gap-3">
        {/* Balance acumulado disponible */}
        <div className="col-span-2 rounded-xl border border-primary/15 bg-card p-[14px_16px]">
          <span className="text-xs font-semibold text-foreground">Balance acumulado disponible</span>
          <div className="h-2 bg-border rounded-full overflow-hidden mt-2">
            <div className="h-full rounded-full bg-primary rainbow-bar transition-all duration-500" style={{ width: `${poolPct}%` }} />
          </div>
          <div className="mt-1.5 text-[11px] text-muted-foreground space-y-0.5">
            <div className="flex justify-between">
              <span>Distribuido: {sym} {fmt(fromPen(totalAllocated))}</span>
              <span className="font-bold text-primary">{poolPct}%</span>
            </div>
            <span>Disponible: {sym} {fmt(fromPen(poolAvailable))}</span>
          </div>
          {poolAvailable > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 px-3 py-2">
              <span className="text-amber-500 text-sm leading-none">⚡</span>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex-1">
                <span className="font-bold">{sym} {fmt(fromPen(poolAvailable))}</span> sin asignar a ninguna meta.
              </p>
              <div className="relative group shrink-0">
                <HelpCircle className="h-3.5 w-3.5 text-amber-500 cursor-pointer" />
                <div className="absolute right-0 bottom-5 w-52 rounded-xl border border-border bg-popover px-3 py-2 shadow-lg text-[11px] text-popover-foreground leading-relaxed opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-20 pointer-events-none">
                  Para ajustar el monto disponible en cada meta, usa la opción <span className="font-semibold">Manual</span> desde el switch en la parte superior.
                  <div className="absolute right-1.5 -bottom-1.5 w-2.5 h-2.5 rotate-45 border-r border-b border-border bg-popover" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Progreso total de metas */}
        <div className="rounded-xl border border-primary/15 bg-card p-[14px_16px]">
          <span className="text-xs font-semibold text-foreground">Progreso total de metas</span>
          <div className="h-2 bg-border rounded-full overflow-hidden mt-2">
            <div className="h-full rounded-full bg-primary rainbow-bar transition-all duration-500" style={{ width: `${totalPct}%` }} />
          </div>
          <div className="mt-1.5 text-[11px] text-muted-foreground space-y-0.5">
            <div className="flex justify-between">
              <span>Ahorrado: {sym} {fmt(fromPen(totalSaved))}</span>
              <span className="font-bold text-primary">{totalPct}%</span>
            </div>
            <span>Objetivo: {sym} {fmt(fromPen(totalTarget))}</span>
          </div>
        </div>
      </div>

      {/* ── Panel modo automático ── */}
      {mode === 'auto' && activeGoals.length > 0 && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
          {/* Encabezado con balance del mes */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary shrink-0" />
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-foreground">Aporte automático</p>
                  <select
                    value={`${selYear}-${selMonth}`}
                    onChange={e => {
                      const [y, m] = e.target.value.split('-').map(Number)
                      setSelYear(y); setSelMonth(m)
                    }}
                    className="text-[11px] font-semibold text-primary bg-transparent border-none outline-none cursor-pointer"
                  >
                    {monthOptions.map(o => (
                      <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <p>Balance neto del mes: <span className="font-semibold text-foreground">{selBalLoading ? '...' : `${sym} ${fmt(fromPen(selBalance))}`}</span></p>
                  {appliedThisMonth > 0 && (
                    <p>Ya aportado: <span className="font-semibold text-amber-600 dark:text-amber-400">− {sym} {fmt(fromPen(appliedThisMonth))}</span></p>
                  )}
                  <p>
                    Disponible:{' '}
                    <span className={`font-semibold ${monthlyAvailable === 0 ? 'text-muted-foreground' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {sym} {fmt(fromPen(monthlyAvailable))}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-muted-foreground">A aportar ahora</p>
              <p className={`text-sm font-extrabold ${pctExceeds100 || autoExceedsPool ? 'text-red-500' : 'text-primary'}`}>
                {sym} {fmt(fromPen(effectiveContribution))}
              </p>
            </div>
          </div>

          {/* Restricción día 21 para mes actual */}
          {!canApplyByDate && (
            <div className="flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2">
              <span className="text-blue-500 text-sm">🗓</span>
              <p className="text-[11px] text-blue-700 dark:text-blue-400 font-medium">
                Los aportes automáticos del mes actual estarán disponibles a partir del <span className="font-bold">día 21</span>.{' '}
              {(() => {
                const daysLeft = 20 - now.getDate()
                if (daysLeft > 0) return `Faltan ${daysLeft} día${daysLeft !== 1 ? 's' : ''}.`
                const hoursLeft = Math.ceil((new Date(now.getFullYear(), now.getMonth(), 21).getTime() - now.getTime()) / 3_600_000)
                return `Regresa en ${hoursLeft} hora${hoursLeft !== 1 ? 's' : ''}.`
              })()}
              </p>
            </div>
          )}

          {/* Barra de porcentaje total */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Porcentaje asignado</span>
              <span className={`font-bold ${pctExceeds100 ? 'text-red-500' : totalPctAssigned > 80 ? 'text-amber-500' : 'text-foreground'}`}>
                {totalPctAssigned}% {pctExceeds100 && '— excede 100%'}
              </span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 rainbow-bar ${pctExceeds100 ? 'bg-red-500' : 'bg-primary'}`}
                style={{ width: `${Math.min(totalPctAssigned, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              % sobre el monto disponible del mes ({sym} {fmt(fromPen(monthlyAvailable))})
            </p>
          </div>

          {/* Advertencias */}
          {pctExceeds100 && (
            <p className="text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
              ⚠️ La suma de porcentajes supera el 100% del balance del mes.
            </p>
          )}
          {autoExceedsPool && !pctExceeds100 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
              ⚠️ El aporte total ({sym} {fmt(fromPen(effectiveContribution))}) supera el balance disponible ({sym} {fmt(fromPen(poolAvailable))}).
            </p>
          )}
          {monthlyAvailable === 0 && selBalance > 0 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2">
              Has aportado todo el balance disponible del mes ({sym} {fmt(fromPen(selBalance))}).
            </p>
          )}
          {selBalance === 0 && !selBalLoading && (
            <p className="text-[11px] text-muted-foreground">Sin balance positivo en este período para calcular aportes.</p>
          )}

          {/* Botones aplicar / deshacer */}
          <div className="flex gap-2">
            <button
              onClick={applyAutoContribution}
              disabled={autoLoading || undoLoading || autoExceedsPool || pctExceeds100 || effectiveContribution <= 0 || !canApplyByDate}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {autoLoading ? 'Aplicando...' : autoApplied ? '✓ Aporte aplicado' : `Aplicar S/ ${fmt(effectiveContribution)}`}
            </button>
            {appliedThisMonth > 0 && (
              <button
                onClick={() => setShowUndoConfirm(true)}
                disabled={undoLoading || autoLoading}
                className="shrink-0 rounded-xl border border-border bg-background p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="Deshacer aportes del mes"
              >
                <RotateCcw className={`h-4 w-4 ${undoLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Grid de metas activas ── */}
      {activeGoals.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {activeGoals.map((g, idx) => {
            const color   = GOAL_COLORS[idx % GOAL_COLORS.length]
            const current = Number(g.current_amount)
            const target  = Number(g.target_amount)
            const pct     = Math.min(Math.round((current / target) * 100), 100)
            const remain  = Math.max(target - current, 0)
            const isUp    = updatingId === g.id
            const isHov   = hovered === g.id

            // Lógica de estado semántico
            const today      = new Date().toISOString().split('T')[0]
            const isOverdue  = !!g.target_date && g.target_date < today && pct < 100
            const barColor   = isOverdue ? '#ef4444' : '#16a34a'

            // Vista previa en modo auto
            const autoPrev = mode === 'auto' ? autoDistribution.find(d => d.goal.id === g.id) : null
            const previewPct = autoPrev ? Math.min(Math.round((autoPrev.newAmount / target) * 100), 100) : pct

            return (
              <div
                key={g.id}
                className={`relative rounded-2xl border p-[16px_18px] transition-colors ${
                  pct >= 100
                    ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30'
                    : isOverdue
                      ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20'
                      : 'border-border bg-card hover:border-primary/30'
                }`}
                onMouseEnter={() => setHovered(g.id)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Check automático cuando meta completada */}
                {pct >= 100 && (
                  <div className="absolute top-2.5 right-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                )}

                {/* Acciones hover (lápiz + papelera) — se ocultan si meta al 100% */}
                {pct < 100 && isHov && !isUp && (
                  <div className="absolute top-2.5 right-2.5 flex gap-1">
                    <button onClick={() => openEditGoal(g)} className="p-1 rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button onClick={() => deleteGoal(g.id)} className="p-1 rounded-md bg-muted text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* Ícono + nombre */}
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-[38px] h-[38px] bg-secondary rounded-xl flex items-center justify-center text-lg flex-none">
                    {g.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-foreground truncate">{g.name}</div>
                    {g.target_date && (
                      <div className="text-[10px] text-muted-foreground">
                        Meta: {new Date(g.target_date + 'T12:00:00').toLocaleDateString('es-PE', { month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Monto + % */}
                <div className="flex justify-between items-baseline mb-2">
                  <div>
                    <div className="text-[17px] font-extrabold leading-none" style={{ color }}>
                      {sym} {fmt(fromPen(current))}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">de {sym} {fmt(fromPen(target))}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-extrabold text-foreground/30">{pct}%</div>
                    {mode === 'auto' && autoPrev && autoPrev.add > 0 && (
                      <div className="text-[10px] font-bold text-primary">→ {previewPct}%</div>
                    )}
                  </div>
                </div>

                {/* Barra de progreso (con preview en modo auto) */}
                <div className="h-[5px] bg-border rounded-full overflow-hidden">
                  {mode === 'auto' && autoPrev && autoPrev.add > 0 ? (
                    <div className="h-full flex">
                      <div className="h-full rounded-l-full" style={{ width: `${pct}%`, backgroundColor: barColor, opacity: 0.45 }} />
                      <div className="h-full rounded-r-full" style={{ width: `${previewPct - pct}%`, backgroundColor: barColor }} />
                    </div>
                  ) : (
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                  )}
                </div>

                {/* Pie de tarjeta */}
                {mode === 'manual' ? (
                  isUp ? (
                    <div className="mt-2 space-y-1">
                      <div className="text-[10px] text-muted-foreground">
                        Disponible: {sym} {fmt(fromPen(Math.max(poolBalance - goals.filter(x => x.id !== g.id).reduce((s, x) => s + Number(x.current_amount), 0), 0)))}
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <input
                          autoFocus type="number" min="0" max={Number(g.target_amount)} step="0.01"
                          value={updateAmount}
                          onChange={e => { setUpdateAmount(e.target.value); setUpdateError('') }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') applyUpdate(g)
                            if (e.key === 'Escape') { setUpdatingId(null); setUpdateAmount(''); setUpdateError('') }
                          }}
                          placeholder={current.toString()}
                          className={`flex-1 rounded-md border px-2 py-1 text-xs text-foreground bg-background focus:outline-none focus:ring-1 focus:ring-ring ${updateError ? 'border-red-500' : 'border-border'}`}
                        />
                        <button onClick={() => applyUpdate(g)} className="rounded-md bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">OK</button>
                        <button onClick={() => { setUpdatingId(null); setUpdateAmount(''); setUpdateError('') }} className="text-[10px] text-muted-foreground">✕</button>
                      </div>
                      {updateError && <p className="text-[10px] text-red-500">{updateError}</p>}
                    </div>
                  ) : (
                    <button
                      onClick={() => { setUpdatingId(g.id); setUpdateAmount(current.toString()); setUpdateError('') }}
                      className="mt-1.5 text-[10px] text-muted-foreground hover:text-primary transition-colors text-left"
                    >
                      {remain > 0 ? `Falta: ${sym} ${fmt(fromPen(remain))}` : '¡Meta alcanzada!'} — <span className="underline underline-offset-2">actualizar</span>
                    </button>
                  )
                ) : (
                  /* Modo auto: input de % por meta */
                  <div className="mt-2 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 flex-1 rounded-lg border border-border bg-background px-2 py-1">
                        <input
                          type="number" min="0" max="100"
                          value={goalPcts[g.id] ?? 0}
                          onChange={e => setGoalPct(g.id, parseInt(e.target.value) || 0)}
                          className="w-10 bg-transparent text-xs text-foreground focus:outline-none text-center"
                        />
                        <span className="text-[10px] text-muted-foreground">% del balance</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">=</span>
                      <span className="text-xs font-bold shrink-0" style={{ color }}>
                        +{sym} {fmt(fromPen(autoPrev?.add ?? 0))}
                      </span>
                    </div>
                    {autoPrev && autoPrev.add > 0 && (
                      <div className="text-[10px] text-muted-foreground">
                        Nuevo total: <span className="font-semibold text-foreground">{sym} {fmt(fromPen(autoPrev.newAmount))}</span>
                        <span className="ml-1">({previewPct}%)</span>
                      </div>
                    )}
                    {remain === 0 && <p className="text-[10px] text-emerald-500">¡Meta alcanzada!</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <p className="text-3xl mb-3">🎯</p>
          <p className="text-sm font-semibold text-foreground mb-1">Sin metas aún</p>
          <p className="text-xs text-muted-foreground mb-4">Define un objetivo de ahorro y empieza a medir tu progreso.</p>
          <button onClick={openNewGoal} className="rounded-[9px] bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors">
            Crear primera meta
          </button>
        </div>
      )}

      {/* ── Metas completadas ── */}
      {completedGoals.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Completadas 🎉</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {completedGoals.map((g, idx) => {
              const color = GOAL_COLORS[idx % GOAL_COLORS.length]
              return (
                <div key={g.id} className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/20 p-3.5">
                  <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center text-lg flex-none">{g.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{g.name}</p>
                    <p className="text-[10px]" style={{ color }}>{sym} {fmt(fromPen(Number(g.target_amount)))} · 100%</p>
                  </div>
                  <button onClick={() => toggleCompleted(g)} className="text-[10px] text-muted-foreground hover:text-primary shrink-0">Reabrir</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Modal nueva / editar meta ── */}
      {showGoalForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowGoalForm(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-bold text-foreground">{editingGoal ? 'Editar meta' : 'Nueva meta de ahorro'}</h3>
              <button onClick={() => setShowGoalForm(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">✕</button>
            </div>
            <form onSubmit={handleGoalSave} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-2">Ícono</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJIS.map(em => (
                    <button key={em} type="button" onClick={() => setGoalForm((f: any) => ({ ...f, emoji: em }))}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-colors ${goalForm.emoji === em ? 'bg-primary/20 ring-2 ring-primary' : 'bg-secondary hover:bg-muted'}`}>
                      {em}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">Nombre de la meta *</label>
                <input required autoFocus type="text" value={goalForm.name}
                  onChange={e => setGoalForm((f: any) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: Fondo de emergencia" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">Objetivo (S/) *</label>
                  <input required type="number" min="1" step="0.01" value={goalForm.target_amount}
                    onChange={e => setGoalForm((f: any) => ({ ...f, target_amount: e.target.value }))}
                    placeholder="10000" className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">Ya tengo (S/)</label>
                  <input type="number" min="0" step="0.01" value={goalForm.current_amount}
                    onChange={e => setGoalForm((f: any) => ({ ...f, current_amount: e.target.value }))}
                    placeholder="0" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">Fecha objetivo (opcional)</label>
                <input type="date" value={goalForm.target_date}
                  onChange={e => setGoalForm((f: any) => ({ ...f, target_date: e.target.value }))}
                  className={inputClass} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">Notas (opcional)</label>
                <input type="text" value={goalForm.notes}
                  onChange={e => setGoalForm((f: any) => ({ ...f, notes: e.target.value }))}
                  placeholder="¿Para qué es esta meta?" className={inputClass} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowGoalForm(false)}
                  className="flex-1 rounded-lg border border-border py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={goalLoading}
                  className="flex-1 rounded-lg bg-primary py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  {goalLoading ? 'Guardando...' : editingGoal ? 'Guardar cambios' : 'Crear meta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal confirmación deshacer aportes ── */}
      {showUndoConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-xl mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                <RotateCcw className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-sm font-bold text-foreground">¿Deshacer aportes del mes?</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
              Se revertirán los aportes automáticos realizados en{' '}
              <span className="font-semibold text-foreground">{monthOptions.find(o => o.year === selYear && o.month === selMonth)?.label}</span>{' '}
              y el balance disponible volverá a <span className="font-semibold text-foreground">{sym} {fmt(fromPen(selBalance))}</span>.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowUndoConfirm(false)}
                className="flex-1 rounded-xl border border-border bg-background py-2 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => { setShowUndoConfirm(false); await undoAutoContribution() }}
                disabled={undoLoading}
                className="flex-1 rounded-xl bg-amber-500 py-2 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {undoLoading ? 'Deshaciendo...' : 'Sí, deshacer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
