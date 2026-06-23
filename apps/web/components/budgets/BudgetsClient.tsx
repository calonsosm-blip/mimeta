'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useCurrency } from '@/hooks/useCurrency'
import { useIsMobile } from '@/hooks/useIsMobile'
import { CategoryPanel } from './CategoryPanel'
import { ArrowLeft, Bookmark, Check, ChevronLeft, ChevronRight, ClipboardList, Pencil, Settings2, Trash2 } from 'lucide-react'

interface Category { id: string; name: string; type: string; sort_order: number }
interface BudgetRow {
  id: string
  category_id: string
  amount: number
  categories: Category
}
interface Template {
  id: string
  name: string
  items: { category_id: string; category_name: string; amount: number }[]
  created_at: string
}

interface Props {
  budgets: BudgetRow[]
  allCategories: Category[]
  actualByCategory: Record<string, number>
  templates: Template[]
  userId: string
  selectedYear: number
  selectedMonth: number
  baseCurrency: 'PEN' | 'USD'
}

const MONTHS_LONG = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']


export function BudgetsClient({
  budgets: initialBudgets, allCategories, actualByCategory,
  templates: initialTemplates, userId, selectedYear, selectedMonth, baseCurrency,
}: Props) {
  const supabase = createClient()
  const router = useRouter()
  const { sym, fromPen, fmt } = useCurrency(baseCurrency)

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 3 + i)

  const [budgets, setBudgets] = useState(initialBudgets)
  const [allCats, setAllCats] = useState(allCategories)
  const [templates, setTemplates] = useState(initialTemplates)
  const [amounts, setAmounts] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    initialBudgets.forEach(b => { map[b.category_id] = b.amount.toString() })
    return map
  })

  const isMobile = useIsMobile()
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [copyingPrev, setCopyingPrev] = useState(false)
  const [showCatPanel, setShowCatPanel] = useState(false)

  // Estado plantillas
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [showApplyMenu, setShowApplyMenu] = useState(false)
  const [applyingTemplate, setApplyingTemplate] = useState(false)

  // Categorías ya en el presupuesto de este mes
  const budgetedCatIds = new Set(budgets.map(b => b.category_id))

  // Categorías disponibles para agregar (las que aún no están en este mes)
  const availableToAdd = allCats.filter(c => !budgetedCatIds.has(c.id))

  function changePeriod(year: number, month: number) {
    router.push(`/budgets?year=${year}&month=${month}`)
  }

  function prevMonth() {
    if (selectedMonth === 1) changePeriod(selectedYear - 1, 12)
    else changePeriod(selectedYear, selectedMonth - 1)
  }

  function nextMonth() {
    if (selectedMonth === 12) changePeriod(selectedYear + 1, 1)
    else changePeriod(selectedYear, selectedMonth + 1)
  }

  async function saveBudget(categoryId: string) {
    const val = parseFloat(amounts[categoryId] ?? '0')
    if (isNaN(val) || val < 0) return
    setSaving(categoryId)
    const existing = budgets.find(b => b.category_id === categoryId)
    if (existing) {
      await supabase.from('budgets').update({ amount: val }).eq('id', existing.id)
    } else {
      await supabase.from('budgets').insert({
        user_id: userId, year: selectedYear, month: selectedMonth,
        category_id: categoryId, amount: val,
      })
    }
    setSaving(null)
  }

  async function addCategoryToMonth(catId: string) {
    const cat = allCats.find(c => c.id === catId)
    if (!cat) return
    const { data, error } = await supabase
      .from('budgets')
      .insert({ user_id: userId, year: selectedYear, month: selectedMonth, category_id: catId, amount: 0 })
      .select('id, category_id, amount')
      .single()
    if (error) { console.error('addCategoryToMonth:', error.message); return }
    if (data) {
      const newRow = { ...data, categories: cat }
      setBudgets(prev =>
        [...prev, newRow as any].sort((a, b) => (a.categories?.sort_order ?? 0) - (b.categories?.sort_order ?? 0))
      )
      setAmounts(prev => ({ ...prev, [catId]: '0' }))
    }
  }

  async function removeCategoryFromMonth(budgetId: string, categoryId: string) {
    await supabase.from('budgets').delete().eq('id', budgetId)
    setBudgets(prev => prev.filter(b => b.id !== budgetId))
    setAmounts(prev => { const next = { ...prev }; delete next[categoryId]; return next })
  }

  async function clearAllCategories() {
    if (!confirm('¿Quitar todas las categorías de este mes? Los montos se perderán.')) return
    const { error } = await supabase.from('budgets')
      .delete()
      .eq('user_id', userId)
      .eq('year', selectedYear)
      .eq('month', selectedMonth)
    if (!error) {
      setBudgets([])
      setAmounts({})
    }
  }

  async function copyPreviousMonth() {
    setCopyingPrev(true)
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear
    const { data: prevBudgets } = await supabase
      .from('budgets').select('category_id, amount')
      .eq('user_id', userId).eq('year', prevYear).eq('month', prevMonth)

    if (prevBudgets && prevBudgets.length > 0) {
      // Limpiar mes actual y copiar del anterior
      await supabase.from('budgets').delete()
        .eq('user_id', userId).eq('year', selectedYear).eq('month', selectedMonth)

      const { data: inserted } = await supabase.from('budgets')
        .insert(prevBudgets.map(pb => ({
          user_id: userId, year: selectedYear, month: selectedMonth,
          category_id: pb.category_id, amount: pb.amount,
        })))
        .select('id, category_id, amount')

      if (inserted) {
        const newBudgets = inserted
          .map(row => ({ ...row, categories: allCats.find(c => c.id === row.category_id)! }))
          .filter(row => row.categories)
          .sort((a, b) => (a.categories?.sort_order ?? 0) - (b.categories?.sort_order ?? 0))
        const newAmounts: Record<string, string> = {}
        inserted.forEach(row => {
          const pb = prevBudgets.find(p => p.category_id === row.category_id)
          if (pb) newAmounts[row.category_id] = pb.amount.toString()
        })
        setBudgets(newBudgets as any)
        setAmounts(newAmounts)
      }
    }
    setCopyingPrev(false)
  }

  // Guardar plantilla
  async function saveTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!templateName.trim()) return
    setSavingTemplate(true)
    const items = budgets.map(b => ({
      category_id: b.category_id,
      category_name: b.categories?.name ?? '',
      amount: parseFloat(amounts[b.category_id] ?? '0') || 0,
    }))
    const { data } = await supabase
      .from('budget_templates')
      .insert({ user_id: userId, name: templateName.trim(), items })
      .select('id, name, items, created_at').single()
    if (data) setTemplates(prev => [data, ...prev])
    setTemplateName('')
    setSavingTemplate(false)
    setShowTemplateModal(false)
  }

  // Aplicar plantilla
  async function applyTemplate(template: Template) {
    if (!confirm(`¿Aplicar la plantilla "${template.name}"? Se reemplazará el presupuesto actual de este mes.`)) return
    setApplyingTemplate(true)
    setShowApplyMenu(false)

    // 1. Borrar todo el presupuesto del mes
    await supabase.from('budgets')
      .delete()
      .eq('user_id', userId)
      .eq('year', selectedYear)
      .eq('month', selectedMonth)

    // 2. Insertar las categorías de la plantilla (solo las que aún existen)
    const validItems = template.items.filter(item => allCats.find(c => c.id === item.category_id))

    if (validItems.length > 0) {
      const { data: inserted } = await supabase.from('budgets')
        .insert(validItems.map(item => ({
          user_id: userId,
          year: selectedYear,
          month: selectedMonth,
          category_id: item.category_id,
          amount: item.amount,
        })))
        .select('id, category_id, amount')

      if (inserted) {
        // Actualizar estado local con los datos reales de la BD
        const newBudgets = inserted.map(row => ({
          ...row,
          categories: allCats.find(c => c.id === row.category_id)!,
        })).sort((a, b) => (a.categories?.sort_order ?? 0) - (b.categories?.sort_order ?? 0))

        const newAmounts: Record<string, string> = {}
        validItems.forEach(item => { newAmounts[item.category_id] = item.amount.toString() })

        setBudgets(newBudgets as any)
        setAmounts(newAmounts)
      }
    } else {
      setBudgets([])
      setAmounts({})
    }

    setApplyingTemplate(false)
  }

  async function deleteTemplate(id: string) {
    if (!confirm('¿Eliminar esta plantilla?')) return
    await supabase.from('budget_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  const totalBudget = budgets.reduce((s, b) => s + (parseFloat(amounts[b.category_id] ?? '0') || 0), 0)
  const totalActual = budgets.reduce((s, b) => s + (actualByCategory[b.category_id] ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Header fila 1: título + navegación de período */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-foreground">Presupuesto</h1>

        {/* Navegación de período */}
        {isMobile ? (
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="text-muted-foreground/60 hover:text-foreground transition-colors">
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <div className="relative">
              <span className="text-sm text-muted-foreground cursor-pointer">
                {MONTHS_LONG[selectedMonth - 1]}
              </span>
              <select
                value={selectedMonth}
                onChange={e => changePeriod(selectedYear, parseInt(e.target.value))}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
              >
                {MONTHS_LONG.map((name, i) => (
                  <option key={i + 1} value={i + 1}>{name}</option>
                ))}
              </select>
            </div>
            <span className="text-muted-foreground/40 text-xs">·</span>
            <div className="relative">
              <span className="text-sm text-muted-foreground cursor-pointer">{selectedYear}</span>
              <select
                value={selectedYear}
                onChange={e => changePeriod(parseInt(e.target.value), selectedMonth)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={nextMonth} className="text-muted-foreground/60 hover:text-foreground transition-colors">
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            {!isCurrentMonth && (
              <button onClick={() => router.push('/budgets')} className="text-xs text-primary ml-0.5">hoy</button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground/80 transition-colors shadow-sm" title="Mes anterior">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <select
              value={selectedMonth}
              onChange={e => changePeriod(selectedYear, parseInt(e.target.value))}
              className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {MONTHS_LONG.map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={e => changePeriod(parseInt(e.target.value), selectedMonth)}
              className="rounded-lg border border-border bg-card px-2 py-1.5 text-sm text-foreground/80 shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button onClick={nextMonth} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground/80 transition-colors shadow-sm" title="Mes siguiente">
              <ChevronRight className="h-4 w-4" />
            </button>
            {!isCurrentMonth && (
              <button onClick={() => router.push('/budgets')} className="ml-1 rounded-lg border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-primary hover:bg-accent transition-colors shadow-sm">
                Hoy
              </button>
            )}
          </div>
        )}
      </div>

      {/* Header fila 2: acciones — solo en modo edición */}
      {isEditing && <div className="flex items-center gap-1 sm:gap-2">
        {/* Copiar mes anterior */}
        <button
          onClick={copyPreviousMonth}
          disabled={copyingPrev}
          title="Copiar mes anterior"
          className="flex h-9 w-9 sm:w-auto sm:px-3 items-center justify-center sm:gap-1.5 rounded-lg border border-border bg-card text-sm text-muted-foreground hover:bg-muted transition-colors shadow-sm disabled:opacity-50"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">{copyingPrev ? 'Copiando...' : 'Mes anterior'}</span>
        </button>

        {/* Limpiar mes */}
        {budgets.length > 0 && (
          <button
            onClick={clearAllCategories}
            title="Limpiar mes"
            className="flex h-9 w-9 sm:w-auto sm:px-3 items-center justify-center sm:gap-1.5 rounded-lg border border-red-100 bg-card text-sm text-red-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors shadow-sm"
          >
            <Trash2 className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Limpiar mes</span>
          </button>
        )}

        {/* Plantillas */}
        <div className="relative">
          <div className="flex rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <button
              onClick={() => setShowTemplateModal(true)}
              title="Guardar como plantilla"
              className="flex h-9 w-9 sm:w-auto sm:px-3 items-center justify-center sm:gap-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors border-r border-border"
            >
              <Bookmark className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Guardar plantilla</span>
            </button>
            <button
              onClick={() => setShowApplyMenu(v => !v)}
              disabled={templates.length === 0 || applyingTemplate}
              title="Aplicar plantilla"
              className="flex h-9 w-9 sm:w-auto sm:px-3 items-center justify-center sm:gap-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
            >
              <ClipboardList className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{applyingTemplate ? 'Aplicando...' : 'Aplicar'}</span>
            </button>
          </div>

          {/* Menú de plantillas */}
          {showApplyMenu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setShowApplyMenu(false)} />
              <div className="absolute left-0 top-full mt-1 z-40 w-64 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
                <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                  Mis plantillas
                </p>
                {templates.map(t => (
                  <div key={t.id} className="flex items-center group hover:bg-muted">
                    <button
                      onClick={() => applyTemplate(t)}
                      className="flex-1 px-4 py-3 text-left text-sm text-foreground/80"
                    >
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.items.length} categorías</p>
                    </button>
                    <button
                      onClick={() => deleteTemplate(t.id)}
                      className="pr-3 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Eliminar plantilla"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Gestión de categorías */}
        <button
          onClick={() => setShowCatPanel(true)}
          title="Gestionar categorías"
          className="flex h-9 w-9 sm:w-auto sm:px-3 items-center justify-center sm:gap-1.5 rounded-lg border border-border bg-card text-sm text-muted-foreground hover:bg-accent hover:text-primary hover:border-accent transition-colors shadow-sm"
        >
          <Settings2 className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Categorías</span>
        </button>
      </div>}

      {/* Totales */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: 'Presupuesto', value: totalBudget, color: 'text-foreground' },
          { label: 'Gasto real', value: totalActual, color: 'text-red-500' },
          { label: 'Disponible', value: totalBudget - totalActual, color: totalBudget - totalActual >= 0 ? 'text-emerald-600' : 'text-red-600' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-3 sm:p-4 shadow-sm">
            <p className="text-xs text-muted-foreground truncate">{card.label}</p>
            <p className={`mt-1 text-base sm:text-xl font-bold truncate ${card.color}`}>{sym} {fmt(fromPen(card.value))}</p>
          </div>
        ))}
      </div>

      {/* Tabla / Tarjetas */}
      <div className="rounded-xl border border-border bg-card shadow-sm">

        {/* Header del card: título + botón editar/listo */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Categorías del mes</span>
          {budgets.length > 0 && (
            isEditing ? (
              <button
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                Listo
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </button>
            )
          )}
        </div>

        {budgets.length > 0 ? (
          <>
            {/* Móvil: tarjetas */}
            <div className="sm:hidden divide-y divide-border">
              {budgets.map(b => {
                const budget = parseFloat(amounts[b.category_id] ?? '0') || 0
                const actual = actualByCategory[b.category_id] ?? 0
                const pct = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0
                const over = budget > 0 && actual > budget
                const warn = budget > 0 && pct >= 80 && !over

                return (
                  <div key={b.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{b.categories?.name}</span>
                      {isEditing && (
                        <button
                          onClick={() => removeCategoryFromMonth(b.id, b.category_id)}
                          className="text-muted-foreground/40 hover:text-red-400 transition-colors p-1 -mr-1"
                          title="Quitar del mes"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">{sym}</span>
                          <input
                            type="number" min="0" step="1"
                            value={amounts[b.category_id] ?? ''}
                            onChange={e => setAmounts(prev => ({ ...prev, [b.category_id]: e.target.value }))}
                            onBlur={() => saveBudget(b.category_id)}
                            onKeyDown={e => e.key === 'Enter' && saveBudget(b.category_id)}
                            placeholder="0"
                            className="w-24 rounded border border-border px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                          {saving === b.category_id && <span className="text-xs text-muted-foreground">...</span>}
                        </div>
                      ) : (
                        <span className="text-sm font-semibold text-foreground">
                          {budget > 0 ? `${sym} ${fmt(fromPen(budget))}` : <span className="text-muted-foreground/50 font-normal text-xs">Sin monto</span>}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground text-right">
                        Real: <span className={`font-medium ${over ? 'text-red-500' : 'text-foreground/80'}`}>{sym} {fmt(fromPen(actual))}</span>
                      </span>
                    </div>
                    {budget > 0 ? (
                      <div className="space-y-1">
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : warn ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className={`text-xs ${over ? 'text-red-500' : warn ? 'text-amber-600' : 'text-muted-foreground'}`}>
                          {Math.round(pct)}%{over ? ' — excedido' : ''}
                        </p>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>

            {/* Desktop: tabla */}
            <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <th className="px-4 py-3 w-[22%]">Categoría</th>
                  <th className="px-4 py-3 w-[20%] text-right">Presupuesto</th>
                  <th className="px-4 py-3 w-[18%] text-right">Real</th>
                  <th className="px-4 py-3">Progreso</th>
                  {isEditing && <th className="px-4 py-3 w-10"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {budgets.map(b => {
                  const budget = parseFloat(amounts[b.category_id] ?? '0') || 0
                  const actual = actualByCategory[b.category_id] ?? 0
                  const pct = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0
                  const over = budget > 0 && actual > budget
                  const warn = budget > 0 && pct >= 80 && !over

                  return (
                    <tr key={b.id} className="hover:bg-muted/50 transition-colors group">
                      <td className="px-4 py-3 font-medium text-foreground">{b.categories?.name}</td>
                      <td className="px-4 py-3 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-muted-foreground text-xs">{sym}</span>
                            <input
                              type="number" min="0" step="1"
                              value={amounts[b.category_id] ?? ''}
                              onChange={e => setAmounts(prev => ({ ...prev, [b.category_id]: e.target.value }))}
                              onBlur={() => saveBudget(b.category_id)}
                              onKeyDown={e => e.key === 'Enter' && saveBudget(b.category_id)}
                              placeholder="0"
                              className="w-24 rounded border border-border px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                            {saving === b.category_id && <span className="text-xs text-muted-foreground">...</span>}
                          </div>
                        ) : (
                          <span className={`font-semibold ${budget > 0 ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                            {budget > 0 ? `${sym} ${fmt(fromPen(budget))}` : '—'}
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${over ? 'text-red-500' : 'text-foreground/80'}`}>
                        {sym} {fmt(fromPen(actual))}
                      </td>
                      <td className="px-4 py-3">
                        {budget > 0 ? (
                          <div className="space-y-1">
                            <div className="h-2 w-full rounded-full bg-muted">
                              <div className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : warn ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <p className={`text-xs ${over ? 'text-red-500' : warn ? 'text-amber-600' : 'text-muted-foreground'}`}>
                              {Math.round(pct)}%{over ? ' — excedido' : ''}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">Sin monto</span>
                        )}
                      </td>
                      {isEditing && (
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => removeCategoryFromMonth(b.id, b.category_id)}
                            className="text-muted-foreground/30 hover:text-red-400 transition-colors"
                            title="Quitar del mes"
                          >
                            ✕
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No hay categorías en este presupuesto.</p>
            <p className="text-xs text-muted-foreground mt-1">Pulsa <strong>Editar</strong> y agrega categorías o aplica una plantilla.</p>
          </div>
        )}

        {/* Agregar categoría al mes — solo en modo edición */}
        {isEditing && availableToAdd.length > 0 && (
          <div className="border-t border-dashed border-border px-4 py-3 flex items-center gap-3">
            <span className="text-xs text-muted-foreground shrink-0">+ Agregar:</span>
            <div className="flex flex-wrap gap-2">
              {availableToAdd.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => addCategoryToMonth(cat.id)}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-accent transition-colors"
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal guardar plantilla */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-card shadow-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-foreground">Guardar como plantilla</h2>
            <p className="text-sm text-muted-foreground">
              Se guardarán {budgets.length} categorías con sus montos actuales.
            </p>
            <form onSubmit={saveTemplate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Nombre de la plantilla</label>
                <input
                  autoFocus
                  type="text"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  placeholder="Ej: Presupuesto estándar, Mes de vacaciones..."
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  required
                />
              </div>
              {/* Preview */}
              <ul className="text-xs text-muted-foreground space-y-1 max-h-36 overflow-y-auto bg-muted rounded-lg p-3">
                {budgets.map(b => (
                  <li key={b.id} className="flex justify-between">
                    <span>{b.categories?.name}</span>
                    <span className="font-medium">{sym} {fmt(parseFloat(amounts[b.category_id] ?? '0') || 0)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowTemplateModal(false)} className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted">
                  Cancelar
                </button>
                <button type="submit" disabled={savingTemplate || !templateName.trim()} className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                  {savingTemplate ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Panel categorías */}
      {showCatPanel && (
        <CategoryPanel
          categories={allCats}
          userId={userId}
          onChange={updated => {
            setAllCats(updated)
            setBudgets(prev =>
              prev
                .map(b => ({ ...b, categories: updated.find(c => c.id === b.category_id) ?? b.categories }))
                .sort((a, b) => (a.categories?.sort_order ?? 0) - (b.categories?.sort_order ?? 0))
            )
          }}
          onClose={() => setShowCatPanel(false)}
        />
      )}
    </div>
  )
}
