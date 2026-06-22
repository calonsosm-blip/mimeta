import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/providers/ThemeProvider'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'MiMeta — Tus metas, más cerca cada día.',
  description: 'Controla tus finanzas, ahorra con inteligencia y cumple tus metas.',
  metadataBase: new URL('https://mimeta-web.vercel.app'),
  openGraph: {
    title: 'MiMeta — Tus metas, más cerca cada día.',
    description: 'Controla tus finanzas, ahorra con inteligencia y cumple tus metas.',
    url: 'https://mimeta-web.vercel.app',
    siteName: 'MiMeta',
    type: 'website',
    locale: 'es_PE',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MiMeta — Tus metas, más cerca cada día.',
    description: 'Controla tus finanzas, ahorra con inteligencia y cumple tus metas.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${manrope.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try {
              var a = localStorage.getItem('finanzas-accent') || 'mimeta';
              document.documentElement.setAttribute('data-accent', a);
            } catch(e){}
          })();
        ` }} />
      </head>
      <body className="h-full bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
