'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ThemeProviderProps } from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}

export function setAccentTheme(accent: string) {
  document.documentElement.setAttribute('data-accent', accent)
  localStorage.setItem('finanzas-accent', accent)
}

export function getAccentTheme(): string {
  if (typeof window === 'undefined') return 'orange'
  return localStorage.getItem('finanzas-accent') ?? 'mimeta'
}
