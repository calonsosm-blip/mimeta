'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type Profile = Pick<Database['public']['Tables']['profiles']['Row'], 'display_name' | 'plan' | 'plan_type'>

interface Props {
  user: User
  profile: Profile | null
  children: React.ReactNode
}

export function DashboardShell({ user, profile, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  // Cerrar sidebar al navegar en móvil
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  // Bloquear scroll del body cuando sidebar está abierto en móvil
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        user={user}
        profile={profile}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Contenido principal */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Header móvil */}
        <header className="flex h-14 items-center gap-3 border-b border-border bg-background px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary transition-colors"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-bold text-foreground">MiMeta</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
