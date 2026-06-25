import Link from 'next/link'
import Image from 'next/image'

const PLANS = [
  {
    name: 'Gratis',
    price: 'S/ 0',
    period: 'siempre',
    description: 'Para empezar a tomar el control sin compromiso',
    cta: 'Empezar gratis',
    ctaHref: '/login',
    highlight: false,
    features: [
      'Registro de transacciones ilimitado',
      '6 meses de historial',
      'Hasta 10 categorías',
      'Dashboard con Termómetro de Fin de Mes',
      'Modo Invisible (ocultar saldos)',
      '1 análisis IA por mes',
      'Hasta 3 pagos recurrentes',
    ],
  },
  {
    name: 'Personal',
    price: 'S/ 12',
    period: 'mes',
    annual: 'S/ 99/año — ahorras S/ 45',
    description: 'Para quien quiere control total de sus finanzas',
    cta: 'Comenzar ahora',
    ctaHref: '/login',
    highlight: true,
    features: [
      'Todo lo del plan Gratis',
      'Historial completo ilimitado',
      'Gráficas y reportes mensuales/anuales',
      'Categorías ilimitadas',
      'Pagos recurrentes ilimitados',
      'Tracker de deudas con proyección',
      'Alertas de pago por email',
      'Análisis IA ilimitado',
      'Categorización automática IA',
      'Registro por Voz',
      'Score de Salud Financiera',
      'Detector de Gastos Hormiga',
      'Simulador de Decisiones',
      'Retos de Ahorro personalizados',
      'Scanner de comprobantes (30/mes)',
      'Exportar datos en Excel/CSV',
      'Compartir Resumen mensual',
    ],
  },
  {
    name: 'Pareja',
    price: 'S/ 18',
    period: 'mes',
    annual: 'S/ 149/año — ahorras S/ 67',
    description: 'Dos personas con sus datos separados, un solo pago',
    cta: 'Comenzar ahora',
    ctaHref: '/login',
    highlight: false,
    features: [
      'Todo lo del plan Personal',
      '2 usuarios con datos completamente separados',
      'Un solo pago mensual',
    ],
  },
  {
    name: 'Familiar',
    price: 'S/ 28',
    period: 'mes',
    annual: 'S/ 229/año — ahorras S/ 107',
    description: 'El dueño paga, la familia entera controla sus finanzas',
    cta: 'Comenzar ahora',
    ctaHref: '/login',
    highlight: false,
    features: [
      'Todo lo del plan Personal',
      'Hasta 5 usuarios (tú + 4 miembros)',
      'Datos completamente separados por persona',
      'Vista resumen consolidada del grupo',
      'Invitar miembros por email',
    ],
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/isotipo.svg" alt="MiMeta" width={32} height={32} className="object-contain shrink-0 dark:invert" />
            <div>
              <p className="text-sm font-bold text-foreground leading-tight">MiMeta</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Tus metas, más cerca cada día.</p>
            </div>
          </Link>
          <Link
            href="/login"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Ingresar
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-14">
          <span className="inline-block rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-semibold text-primary mb-4">
            Planes y precios
          </span>
          <h1 className="text-4xl font-extrabold text-foreground sm:text-5xl tracking-tight">
            Simple, accesible y sin letra chica
          </h1>
          <p className="mt-4 text-base text-muted-foreground max-w-xl mx-auto">
            Empieza gratis y sube de plan cuando lo necesites. Pensado para el mercado peruano.
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border bg-card p-7 flex flex-col transition-shadow hover:shadow-md ${
                plan.highlight
                  ? 'border-primary ring-2 ring-primary/30 shadow-lg'
                  : 'border-border'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground shadow-sm">
                    Más popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-base font-bold text-foreground">{plan.name}</h2>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">/{plan.period}</span>
                </div>
                {plan.annual && (
                  <p className="mt-1 text-[11px] text-primary font-semibold">{plan.annual}</p>
                )}
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{plan.description}</p>
              </div>

              <ul className="flex-1 space-y-2 mb-7">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-0.5 text-primary shrink-0 font-bold">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.ctaHref}
                className={`block w-full rounded-xl py-2.5 text-center text-sm font-bold transition-colors ${
                  plan.highlight
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'border border-border text-foreground hover:bg-muted'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ bottom note */}
        <div className="mt-14 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            ¿Tienes preguntas?{' '}
            <a href="mailto:soporte@mimeta.app" className="text-primary hover:underline font-medium">
              Escríbenos
            </a>
          </p>
          <p className="text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-primary transition-colors">Política de privacidad</Link>
            {' · '}
            <Link href="/login" className="hover:text-primary transition-colors">Ingresar</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
