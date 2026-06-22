import { ImageResponse } from 'next/og'

export const runtime     = 'edge'
export const alt         = 'MiMeta — Tus metas, más cerca cada día.'
export const size        = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0f172a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          padding: '0 80px',
        }}
      >
        {/* Pill badge */}
        <div
          style={{
            background: '#0E7C4A22',
            border: '1px solid #0E7C4A66',
            borderRadius: 999,
            padding: '6px 20px',
            fontSize: 18,
            color: '#2ED68A',
            fontWeight: 600,
            letterSpacing: 1,
            marginBottom: 8,
          }}
        >
          BETA · Finanzas personales
        </div>

        {/* Nombre */}
        <div
          style={{
            fontSize: 96,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-3px',
            lineHeight: 1,
          }}
        >
          MiMeta
        </div>

        {/* Eslogan */}
        <div
          style={{
            fontSize: 32,
            color: '#2ED68A',
            fontWeight: 500,
            marginTop: 4,
          }}
        >
          Tus metas, más cerca cada día.
        </div>

        {/* Features */}
        <div
          style={{
            display: 'flex',
            gap: 32,
            marginTop: 24,
          }}
        >
          {['Dashboard inteligente', 'Metas de ahorro', 'Alertas de pago', 'Análisis con IA'].map(f => (
            <div
              key={f}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: '#94a3b8',
                fontSize: 18,
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: 999, background: '#0E7C4A' }} />
              {f}
            </div>
          ))}
        </div>

        {/* URL */}
        <div
          style={{
            marginTop: 32,
            fontSize: 18,
            color: '#475569',
          }}
        >
          mimeta-web.vercel.app
        </div>
      </div>
    ),
    { ...size },
  )
}
