'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, ArrowUpDown, Bell, PieChart, CreditCard,
  PiggyBank, TrendingUp, Sparkles, Target,
  Sun, Moon, Settings, LogOut, Crown, ChevronUp,
} from 'lucide-react'

type Profile = Pick<Database['public']['Tables']['profiles']['Row'], 'display_name' | 'plan' | 'plan_type'>

const NAV_GROUPS = [
  {
    label: 'Mi dinero',
    items: [
      { href: '/',               label: 'Dashboard',       icon: LayoutDashboard },
      { href: '/transactions',   label: 'Transacciones',   icon: ArrowUpDown },
      { href: '/reports/monthly',label: 'Reportes',        icon: TrendingUp },
    ],
  },
  {
    label: 'Mi planificación',
    items: [
      { href: '/budgets',          label: 'Presupuesto',     icon: PieChart },
      { href: '/debts',            label: 'Deudas',          icon: CreditCard },
      { href: '/planned-payments', label: 'Alertas de pago', icon: Bell },
      { href: '/savings',          label: 'Metas de ahorro', icon: PiggyBank },
    ],
  },
  {
    label: 'Premium',
    items: [
      { href: '/ai-insights',  label: 'Análisis IA', icon: Sparkles, premiumOnly: true },
      { href: '/challenges',   label: 'Retos',       icon: Target,   premiumOnly: true },
    ],
  },
]

interface SidebarProps {
  user: User
  profile: Profile | null
  isOpen?: boolean
  onClose?: () => void
}

function UserAvatar({ name }: { name: string }) {
  const initials = name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
      {initials || '?'}
    </div>
  )
}

export function Sidebar({ user, profile, isOpen = false, onClose }: SidebarProps) {
  const pathname  = usePathname()
  const router    = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const isPremium   = profile?.plan === 'premium'
  const displayName = profile?.display_name ?? user.email ?? ''
  const supabase    = createClient()

  useEffect(() => { setMounted(true) }, [])

  // Cerrar el menú al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className={`
      fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar
      transform transition-transform duration-200 ease-in-out
      lg:static lg:translate-x-0 lg:z-auto
      ${isOpen ? 'translate-x-0' : '-translate-x-full'}
    `}>

      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        <Image src="/mimeta-horizontal.png" alt="MiMeta" height={52} width={125} className="object-contain object-left shrink-0" />
        {isPremium && (
          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
            {profile?.plan_type ?? 'pro'}
          </span>
        )}
      </div>

      {/* Navegación agrupada */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {NAV_GROUPS.map(group => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
                const isLocked = (item as any).premiumOnly && !isPremium
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={isLocked ? '/pricing' : item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'bg-primary/15 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-secondary hover:text-sidebar-foreground'
                    } ${isLocked ? 'opacity-50' : ''}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                    {isLocked && <span className="ml-auto text-xs opacity-60">Pro</span>}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Avatar + menú desplegable */}
      <div className="border-t border-sidebar-border p-3" ref={menuRef}>

        {/* Menú flotante */}
        {menuOpen && mounted && (
          <div className="mb-2 rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
            {/* Modo oscuro — toggle directo */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex w-full items-center justify-between px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-2.5">
                {theme === 'dark'
                  ? <Sun className="h-4 w-4 text-muted-foreground" />
                  : <Moon className="h-4 w-4 text-muted-foreground" />
                }
                <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>
              </div>
            </button>

            <div className="my-0.5 h-px bg-border" />

            {/* Configuración */}
            <Link
              href="/settings"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span>Configuración</span>
            </Link>

            {/* Actualizar a Premium */}
            {!isPremium && (
              <Link
                href="/pricing"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-primary hover:bg-muted transition-colors"
              >
                <Crown className="h-4 w-4" />
                <span className="font-semibold">Actualizar a Premium</span>
              </Link>
            )}

            <div className="my-0.5 h-px bg-border" />

            {/* Cerrar sesión */}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        )}

        {/* Botón de usuario */}
        <button
          onClick={() => setMenuOpen(v => !v)}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-secondary transition-colors"
        >
          <UserAvatar name={displayName} />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
          </div>
          <ChevronUp className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${menuOpen ? '' : 'rotate-180'}`} />
        </button>
      </div>
    </aside>
  )
}
