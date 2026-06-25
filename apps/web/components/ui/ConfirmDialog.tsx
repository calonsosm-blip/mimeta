'use client'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  variant?: 'danger' | 'primary'
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmDialog({
  open, title, message,
  confirmLabel = 'Eliminar',
  variant = 'danger',
  onConfirm, onClose,
}: Props) {
  if (!open) return null

  const confirmClass = variant === 'danger'
    ? 'flex-1 rounded-lg bg-red-500 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors'
    : 'flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-xl p-6 space-y-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button onClick={onConfirm} className={confirmClass}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
