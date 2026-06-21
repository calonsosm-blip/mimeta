export default function DebugLogin() {
  return (
    <div style={{ padding: 40, fontFamily: 'monospace' }}>
      <h2>Debug Login (sin JS)</h2>
      <form action="/api/debug-login-form" method="POST">
        <input name="email" type="email" defaultValue="calonsosm@gmail.com"
          style={{ display: 'block', padding: 8, marginBottom: 8, width: 300 }} />
        <input name="password" type="password" placeholder="contraseña"
          style={{ display: 'block', padding: 8, marginBottom: 8, width: 300 }} />
        <button type="submit" style={{ padding: '8px 24px', background: '#22c55e', color: 'white', border: 'none', cursor: 'pointer' }}>
          Probar login
        </button>
      </form>
    </div>
  )
}
