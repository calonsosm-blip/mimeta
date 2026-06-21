'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { CategoryPanel } from './CategoryPanel'

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
}

const MONTHS_LONG = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function fmt(n: number) {
  return new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function IconSettings() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

export function BudgetsClient({
  budgets: initialBudgets, allCategories, actualByCategory,
  templates: initialTemplates, userId, selectedYear, selectedMonth,
}: Props) {
  const supabase = createClient()
  const router = useRouter()

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
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground/80 transition-colors shadow-sm"
            title="Mes anterior"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
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

          <button
            onClick={nextMonth}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground/80 transition-colors shadow-sm"
            title="Mes siguiente"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {!isCurrentMonth && (
            <button
              onClick={() => router.push('/budgets')}
              className="ml-1 rounded-lg border border-accent bg-accent px-3 py-1.5 text-xs font-medium text-primary hover:bg-accent transition-colors shadow-sm"
            >
              Hoy
            </button>
          )}
        </div>
      </div>

      {/* Header fila 2: acciones */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Copiar mes anterior */}
        <button
          onClick={copyPreviousMonth}
          disabled={copyingPrev}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors shadow-sm disabled:opacity-50"
        >
          {copyingPrev ? 'Copiando...' : '↩ Mes anterior'}
        </button>

        {/* Limpiar mes */}
        {budgets.length > 0 && (
          <button
            onClick={clearAllCategories}
            className="rounded-lg border border-red-100 bg-card px-3 py-2 text-sm text-red-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors shadow-sm"
            title="Quitar todas las categorías de este mes"
          >
            🗑 Limpiar mes
          </button>
        )}

        {/* Plantillas */}
        <div className="relative">
          <div className="flex rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <button
              onClick={() => setShowTemplateModal(true)}
              className="px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors border-r border-border"
              title="Guardar como plantilla"
            >
              💾 Guardar plantilla
            </button>
            <button
              onClick={() => setShowApplyMenu(v => !v)}
              disabled={templates.length === 0 || applyingTemplate}
              className="px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
              title="Aplicar plantilla"
            >
              {applyingTemplate ? 'Aplicando...' : '📋 Aplicar'}
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
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-primary hover:border-accent transition-colors shadow-sm"
        >
          <IconSettings />
          <span>Categorías</span>
        </button>
      </div>

      {/* Totales */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'Presupuesto total', value: totalBudget, color: 'text-foreground' },
          { label: 'Gasto real', value: totalActual, color: 'text-red-500' },
          { label: 'Disponible', value: totalBudget - totalActual, color: totalBudget - totalActual >= 0 ? 'text-emerald-600' : 'text-red-600' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className={`mt-1 text-xl font-bold ${card.color}`}>S/ {fmt(card.value)}</p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {budgets.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <th className="px-4 py-3">Categoría</th>
                <th className="px-4 py-3 text-right">Presupuesto</th>
                <th className="px-4 py-3 text-right">Real</th>
                <th className="px-4 py-3">Progreso</th>
                <th className="px-4 py-3 w-8"></th>
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
                  <tr key={b.id} className="hover:bg-muted transition-colors group">
                    <td className="px-4 py-3 font-medium text-foreground">{b.categories?.name}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-muted-foreground text-xs">S/</span>
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
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${over ? 'text-red-500' : 'text-foreground/80'}`}>
                      S/ {fmt(actual)}
                    </td>
                    <td className="px-4 py-3 w-40">
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
                        <span className="text-xs text-gray-300">Sin monto</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => removeCategoryFromMonth(b.id, b.category_id)}
                        className="text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        title="Quitar del mes"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No hay categorías en este presupuesto.</p>
            <p className="text-xs text-muted-foreground mt-1">Agrega categorías desde abajo o aplica una plantilla.</p>
          </div>
        )}

        {/* Agregar categoría al mes */}
        {availableToAdd.length > 0 && (
          <div className="border-t border-dashed border-border px-4 py-3 flex items-center gap-3">
            <span className="text-xs text-muted-foreground shrink-0">+ Agregar al mes:</span>
            <div className="flex flex-wrap gap-2">
              {availableToAdd.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => addCategoryToMonth(cat.id)}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:border-indigo-300 hover:text-primary hover:bg-accent transition-colors"
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Haz clic en el monto para editarlo · pasa el mouse sobre una fila para quitarla del mes (✕) · las plantillas guardan la estructura completa del mes actual.
      </p>

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
                    <span className="font-medium">S/ {fmt(parseFloat(amounts[b.category_id] ?? '0') || 0)}</span>
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
