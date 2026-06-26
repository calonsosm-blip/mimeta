'use client'

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { createClient } from '@/lib/supabase/client'
import { getLimits } from '@/lib/planLimits'
import { UpgradePrompt } from '@/components/ui/UpgradePrompt'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface Category { id: string; name: string; type: string; sort_order: number }

interface Props {
  categories: Category[]
  userId: string
  type?: 'income' | 'expense'
  plan: 'free' | 'premium'
  totalCategories: number
  onChange: (cats: Category[]) => void
  onClose: () => void
}

function GripIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="9" cy="5" r="1.5" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
    </svg>
  )
}

function SortableItem({
  cat,
  onEdit,
  onDelete,
  editingId,
  editingName,
  setEditingName,
  onSaveEdit,
  onCancelEdit,
}: {
  cat: Category
  onEdit: (id: string, name: string) => void
  onDelete: (id: string) => void
  editingId: string | null
  editingName: string
  setEditingName: (v: string) => void
  onSaveEdit: (id: string) => void
  onCancelEdit: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-muted group bg-card"
    >
      {/* Ícono de arrastre */}
      <button
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab active:cursor-grabbing text-gray-300 hover:text-muted-foreground transition-colors touch-none"
        title="Arrastrar para reordenar"
      >
        <GripIcon />
      </button>

      {editingId === cat.id ? (
        <>
          <input
            autoFocus
            value={editingName}
            onChange={e => setEditingName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onSaveEdit(cat.id)
              if (e.key === 'Escape') onCancelEdit()
            }}
            className="flex-1 rounded border border-border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button onClick={() => onSaveEdit(cat.id)} className="text-xs text-primary font-medium whitespace-nowrap">Guardar</button>
          <button onClick={onCancelEdit} className="text-xs text-muted-foreground">✕</button>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm text-foreground/80">{cat.name}</span>
          <div className="flex gap-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(cat.id, cat.name)}
              className="text-base sm:text-xs text-muted-foreground hover:text-primary p-1 sm:p-0"
              title="Renombrar"
            >
              ✎
            </button>
            <button
              onClick={() => onDelete(cat.id)}
              className="text-base sm:text-xs text-muted-foreground hover:text-red-500 p-1 sm:p-0"
              title="Eliminar"
            >
              ✕
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function CategoryPanel({ categories: initialCats, userId, type = 'expense', plan, totalCategories, onChange, onClose }: Props) {
  const supabase = createClient()
  const [cats, setCats] = useState(initialCats)
  const [newCatName, setNewCatName] = useState('')
  const [addingCat, setAddingCat] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  const limits = getLimits(plan)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = cats.findIndex(c => c.id === active.id)
    const newIndex = cats.findIndex(c => c.id === over.id)
    const reordered = arrayMove(cats, oldIndex, newIndex).map((c, i) => ({ ...c, sort_order: i }))

    setCats(reordered)
    onChange(reordered)

    // Persistir nuevo orden en Supabase
    await Promise.all(
      reordered.map(c => supabase.from('categories').update({ sort_order: c.sort_order }).eq('id', c.id))
    )
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCatName.trim()) return
    if (totalCategories >= limits.categories) { setShowUpgrade(true); return }
    setAddingCat(true)
    const { data } = await supabase
      .from('categories')
      .insert({ user_id: userId, name: newCatName.trim(), type, sort_order: cats.length })
      .select('id, name, type, sort_order')
      .single()
    if (data) {
      const updated = [...cats, data]
      setCats(updated)
      onChange(updated)
    }
    setNewCatName('')
    setAddingCat(false)
  }

  async function saveCatEdit(id: string) {
    if (!editingName.trim()) return
    await supabase.from('categories').update({ name: editingName.trim() }).eq('id', id)
    const updated = cats.map(c => c.id === id ? { ...c, name: editingName.trim() } : c)
    setCats(updated)
    onChange(updated)
    setEditingId(null)
  }

  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function deleteCategory(id: string) {
    setDeleteError(null)
    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id)

    if ((count ?? 0) > 0) {
      setDeleteError(`No se puede eliminar: hay ${count} movimiento${count === 1 ? '' : 's'} registrado${count === 1 ? '' : 's'} con esta categoría.`)
      return
    }

    setConfirm({
      title: 'Eliminar categoría',
      message: '¿Estás seguro? Se quitará de todos los presupuestos donde esté asignada.',
      onConfirm: async () => {
        await supabase.from('budgets').delete().eq('category_id', id)
        await supabase.from('categories').delete().eq('id', id)
        const updated = cats.filter(c => c.id !== id)
        setCats(updated)
        onChange(updated)
        setConfirm(null)
      },
    })
  }

  return (
    <>
      <UpgradePrompt
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="categorías"
        limit={limits.categories}
        unit="categorías"
      />
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        onConfirm={confirm?.onConfirm ?? (() => {})}
        onClose={() => setConfirm(null)}
      />
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-full w-80 bg-card shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">{type === 'income' ? 'Categorías de ingreso' : 'Categorías de egreso'}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Arrastra el ícono ⠿ para reordenar</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-muted-foreground text-xl leading-none">×</button>
        </div>

        {/* Agregar nueva */}
        <form onSubmit={addCategory} className="border-b border-border px-5 py-4">
          <label className="block text-xs font-medium text-muted-foreground mb-2">Nueva categoría</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="Ej: Entretenimiento..."
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={addingCat || !newCatName.trim()}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {addingCat ? '...' : '+'}
            </button>
          </div>
        </form>

        {/* Lista con drag & drop */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {cats.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Sin categorías todavía.</p>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={cats.map(c => c.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {cats.map(cat => (
                  <SortableItem
                    key={cat.id}
                    cat={cat}
                    editingId={editingId}
                    editingName={editingName}
                    setEditingName={setEditingName}
                    onEdit={(id, name) => { setEditingId(id); setEditingName(name) }}
                    onDelete={deleteCategory}
                    onSaveEdit={saveCatEdit}
                    onCancelEdit={() => setEditingId(null)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {deleteError && (
          <div className="mx-5 mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600 flex items-start gap-2">
            <span className="shrink-0 mt-0.5">⚠</span>
            <span>{deleteError}</span>
            <button onClick={() => setDeleteError(null)} className="ml-auto shrink-0 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        <div className="border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-muted py-2 text-sm font-medium text-foreground/80 hover:bg-gray-200 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </>
  )
}
