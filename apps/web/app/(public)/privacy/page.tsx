import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <Link href="/" className="text-sm text-indigo-600 hover:underline">
            ← Volver al inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Política de Privacidad</h1>
        <p className="text-sm text-gray-500 mb-10">Última actualización: junio 2026</p>

        <div className="prose prose-gray max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. ¿Quiénes somos?</h2>
            <p className="text-gray-600 leading-relaxed">
              Somos <strong>Finanzas Personales</strong>, una plataforma web diseñada para ayudarte
              a controlar tus ingresos, gastos y metas de ahorro. Operamos bajo la legislación peruana,
              cumpliendo la <strong>Ley N° 29733 — Ley de Protección de Datos Personales</strong> y su
              reglamento aprobado por D.S. 003-2013-JUS.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. ¿Qué datos recopilamos?</h2>
            <p className="text-gray-600 leading-relaxed mb-3">Recopilamos únicamente lo necesario para prestarte el servicio:</p>
            <ul className="space-y-2 text-gray-600">
              <li className="flex gap-2"><span className="text-indigo-500 shrink-0 mt-1">•</span><span><strong>Correo electrónico:</strong> para crear tu cuenta e identificarte (no usamos contraseñas).</span></li>
              <li className="flex gap-2"><span className="text-indigo-500 shrink-0 mt-1">•</span><span><strong>Datos financieros que tú ingresas:</strong> transacciones, presupuestos, deudas y ahorro. Tú decides qué registras.</span></li>
              <li className="flex gap-2"><span className="text-indigo-500 shrink-0 mt-1">•</span><span><strong>Fotos de comprobantes (plan Premium):</strong> se guardan de forma privada en nuestro almacenamiento seguro. Solo tú puedes verlas.</span></li>
              <li className="flex gap-2"><span className="text-indigo-500 shrink-0 mt-1">•</span><span><strong>Datos de uso básicos:</strong> registros técnicos de acceso para seguridad (IP, fecha/hora). No los vendemos.</span></li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-3 bg-green-50 rounded-lg p-4 border border-green-200">
              🔒 <strong>No nos conectamos con tu banco.</strong> Tú ingresas los datos manualmente. Nunca accedemos a tu cuenta bancaria.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. ¿Cómo usamos tus datos?</h2>
            <ul className="space-y-2 text-gray-600">
              <li className="flex gap-2"><span className="text-indigo-500 shrink-0 mt-1">•</span><span>Para mostrarte tu dashboard, gráficas y reportes personales.</span></li>
              <li className="flex gap-2"><span className="text-indigo-500 shrink-0 mt-1">•</span><span>Para que la IA (Claude de Anthropic) genere análisis y recomendaciones. Los datos se envían de forma cifrada y no se usan para entrenar modelos.</span></li>
              <li className="flex gap-2"><span className="text-indigo-500 shrink-0 mt-1">•</span><span>Para enviarte alertas de pago por email si las activaste.</span></li>
              <li className="flex gap-2"><span className="text-indigo-500 shrink-0 mt-1">•</span><span>Para procesar el pago de tu suscripción (Culqi o Stripe). No almacenamos datos de tarjetas.</span></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. ¿Compartimos tus datos?</h2>
            <p className="text-gray-600 leading-relaxed">
              <strong>No.</strong> No vendemos, arrendamos ni compartimos tus datos personales con terceros
              con fines comerciales. Solo compartimos datos con proveedores de infraestructura necesarios
              para operar el servicio (Supabase para la base de datos, Vercel para el hosting,
              Anthropic para la IA), quienes están obligados contractualmente a proteger tu información.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Seguridad</h2>
            <ul className="space-y-2 text-gray-600">
              <li className="flex gap-2"><span className="text-indigo-500 shrink-0 mt-1">•</span><span>Datos cifrados en reposo (AES-256) y en tránsito (TLS 1.3).</span></li>
              <li className="flex gap-2"><span className="text-indigo-500 shrink-0 mt-1">•</span><span>Cada usuario tiene acceso exclusivo a sus propios datos (Row Level Security en la base de datos).</span></li>
              <li className="flex gap-2"><span className="text-indigo-500 shrink-0 mt-1">•</span><span>Acceso por magic link (sin contraseñas que puedan ser robadas).</span></li>
              <li className="flex gap-2"><span className="text-indigo-500 shrink-0 mt-1">•</span><span>Opción de autenticación de dos factores (2FA) disponible en Configuración.</span></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Tus derechos (Ley 29733)</h2>
            <p className="text-gray-600 leading-relaxed mb-3">
              Tienes derecho a acceder, rectificar, cancelar y oponerte al tratamiento de tus datos
              (derechos ARCO). Puedes ejercerlos desde la app:
            </p>
            <ul className="space-y-2 text-gray-600">
              <li className="flex gap-2"><span className="text-indigo-500 shrink-0 mt-1">•</span><span><strong>Exportar tus datos:</strong> descarga todo tu historial en CSV/Excel desde Configuración.</span></li>
              <li className="flex gap-2"><span className="text-indigo-500 shrink-0 mt-1">•</span><span><strong>Eliminar tu cuenta:</strong> borra tu perfil y todos tus datos permanentemente desde Configuración → Privacidad.</span></li>
              <li className="flex gap-2"><span className="text-indigo-500 shrink-0 mt-1">•</span><span><strong>Ver sesiones activas:</strong> cierra sesiones en otros dispositivos desde Configuración.</span></li>
            </ul>
            <p className="text-gray-600 leading-relaxed mt-3">
              También puedes escribirnos a{' '}
              <a href="mailto:privacidad@finanzaspersonales.app" className="text-indigo-600 hover:underline">
                privacidad@finanzaspersonales.app
              </a>
              {' '}para cualquier solicitud de privacidad.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Cookies</h2>
            <p className="text-gray-600 leading-relaxed">
              Usamos cookies técnicas estrictamente necesarias para mantener tu sesión activa.
              No usamos cookies de rastreo publicitario ni de terceros con fines de marketing.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Menores de edad</h2>
            <p className="text-gray-600 leading-relaxed">
              Este servicio está dirigido a personas mayores de 18 años. No recopilamos
              intencionalmente datos de menores de edad.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Cambios a esta política</h2>
            <p className="text-gray-600 leading-relaxed">
              Si realizamos cambios materiales a esta política, te notificaremos por email con al menos
              15 días de anticipación. El uso continuado del servicio implica la aceptación de la
              política actualizada.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Contacto</h2>
            <p className="text-gray-600 leading-relaxed">
              Para cualquier consulta sobre privacidad o protección de datos, contáctanos en{' '}
              <a href="mailto:privacidad@finanzaspersonales.app" className="text-indigo-600 hover:underline">
                privacidad@finanzaspersonales.app
              </a>
            </p>
          </section>
        </div>
      </main>

      <footer className="border-t border-gray-200 mt-16 py-8">
        <div className="mx-auto max-w-4xl px-6 text-center text-sm text-gray-500">
          <Link href="/pricing" className="text-indigo-600 hover:underline">Ver planes</Link>
          {' · '}
          <Link href="/login" className="text-indigo-600 hover:underline">Ingresar</Link>
        </div>
      </footer>
    </div>
  )
}
