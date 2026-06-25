'use client'

import { Crown, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onClose: () => void
  feature: string
  limit: number
  unit: string
}

export function UpgradePrompt({ open, onClose, feature, limit, unit }: Props) {
  const router = useRouter()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Crown className="h-6 w-6 text-primary" />
        </div>

        <h2 className="mb-2 text-lg font-semibold">Límite del plan gratuito</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          El plan gratuito incluye hasta{' '}
          <span className="font-medium text-foreground">
            {limit} {unit}
          </span>
          . Actualiza a Premium para {feature} ilimitado
          {unit === 'metas' || unit === 'categorías' ? 's' : ''}.
        </p>

        <div className="flex flex-col gap-2">
          <Button
            className="w-full"
            onClick={() => { onClose(); router.push('/pricing') }}
          >
            <Crown className="mr-2 h-4 w-4" />
            Ver planes Premium
          </Button>
          <Button variant="outline" className="w-full" onClick={onClose}>
            Continuar con el plan gratuito
          </Button>
        </div>
      </div>
    </div>
  )
}
