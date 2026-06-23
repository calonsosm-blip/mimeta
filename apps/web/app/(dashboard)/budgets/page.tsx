import { createClient } from '@/lib/supabase/server'
import { BudgetsClient } from '@/components/budgets/BudgetsClient'

interface Props {
  searchParams: Promise<{ year?: string; month?: string }>
}

export default async function BudgetsPage({ searchParams }: Props) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const params = await searchParams
  const now = new Date()
  const year = parseInt(params.year ?? '') || now.getFullYear()
  const month = parseInt(params.month ?? '') || now.getMonth() + 1
  const daysInMonth = new Date(year, month, 0).getDate()

  const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`
  const dateTo   = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

  const [budgetRes, allCatRes, actualRes, templateRes, profileRes, incomeCatRes, actualIncomeRes] = await Promise.all([
    // Todos los presupuestos del mes (ingresos y egresos)
    supabase
      .from('budgets')
      .select('id, category_id, amount, categories(id, name, type, sort_order)')
      .eq('user_id', user!.id)
      .eq('year', year)
      .eq('month', month),
    // Categorías de egreso del usuario
    supabase
      .from('categories')
      .select('id, name, type, sort_order')
      .eq('user_id', user!.id)
      .eq('type', 'expense')
      .order('sort_order'),
    // Gasto real del mes
    supabase
      .from('transactions')
      .select('category_id, amount_pen')
      .eq('user_id', user!.id)
      .eq('type', 'expense')
      .gte('date', dateFrom)
      .lte('date', dateTo),
    // Plantillas guardadas
    supabase
      .from('budget_templates')
      .select('id, name, items, created_at')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('base_currency').eq('id', user!.id).single(),
    // Categorías de ingreso del usuario
    supabase
      .from('categories')
      .select('id, name, type, sort_order')
      .eq('user_id', user!.id)
      .eq('type', 'income')
      .order('sort_order'),
    // Ingreso real del mes
    supabase
      .from('transactions')
      .select('category_id, amount_pen')
      .eq('user_id', user!.id)
      .eq('type', 'income')
      .gte('date', dateFrom)
      .lte('date', dateTo),
  ])

  const actualByCategory: Record<string, number> = {}
  for (const tx of (actualRes.data ?? []) as { category_id: string | null; amount_pen: number }[]) {
    if (tx.category_id) {
      actualByCategory[tx.category_id] = (actualByCategory[tx.category_id] ?? 0) + tx.amount_pen
    }
  }

  const actualIncomeByCategory: Record<string, number> = {}
  for (const tx of (actualIncomeRes.data ?? []) as { category_id: string | null; amount_pen: number }[]) {
    if (tx.category_id) {
      actualIncomeByCategory[tx.category_id] = (actualIncomeByCategory[tx.category_id] ?? 0) + tx.amount_pen
    }
  }

  // Ordenar las filas del presupuesto según sort_order de la categoría
  const budgets = ((budgetRes.data ?? []) as any[]).sort((a, b) => {
    const ao = a.categories?.sort_order ?? 0
    const bo = b.categories?.sort_order ?? 0
    return ao - bo
  })

  return (
    <BudgetsClient
      budgets={budgets as any}
      allCategories={allCatRes.data ?? []}
      actualByCategory={actualByCategory}
      incomeCategories={incomeCatRes.data ?? []}
      actualIncomeByCategory={actualIncomeByCategory}
      templates={templateRes.data ?? []}
      userId={user!.id}
      selectedYear={year}
      selectedMonth={month}
      baseCurrency={(profileRes.data?.base_currency as 'PEN' | 'USD') ?? 'PEN'}
    />
  )
}
