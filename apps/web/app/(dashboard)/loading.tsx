export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background">
      <div className="relative flex items-center justify-center">
        {/* Anillo giratorio */}
        <div className="absolute h-20 w-20 animate-spin rounded-full border-4 border-border border-t-primary" />
        {/* Isotipo centrado */}
        <div className="relative z-10 h-12 w-12 overflow-hidden rounded-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mimeta-isotipo.png" alt="MiMeta" className="h-full w-full object-contain" />
        </div>
      </div>
      <p className="text-sm font-medium text-muted-foreground animate-pulse">Cargando...</p>
    </div>
  )
}
