# Despliegue de Edge Functions

## Pre-requisitos

```powershell
# Instalar Supabase CLI (si no está instalado)
npm install -g supabase

# Login
supabase login

# Vincular proyecto
supabase link --project-ref rxsrtoehnpshfmqslicm
```

## Variables de entorno requeridas

```powershell
# Clave de API de Resend (obtener en resend.com)
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxx

# URL pública de la app (para links en emails)
supabase secrets set APP_URL=https://app.orangefinanzas.app
```

## Desplegar funciones

```powershell
# Auto-registro de pagos
supabase functions deploy auto-register-payments --no-verify-jwt

# Recordatorios por email
supabase functions deploy payment-reminders --no-verify-jwt
```

## Programar ejecución automática (Supabase Dashboard)

1. Ir a **Supabase Dashboard → Edge Functions**
2. Seleccionar `auto-register-payments` → **Schedule**
   - Cron: `0 11 * * *` (11:00 UTC = 6:00 AM Lima)
3. Seleccionar `payment-reminders` → **Schedule**
   - Cron: `0 13 * * *` (13:00 UTC = 8:00 AM Lima)

## Probar manualmente

```powershell
# Auto-registro
supabase functions invoke auto-register-payments --no-verify-jwt

# Recordatorios
supabase functions invoke payment-reminders --no-verify-jwt
```

## Configurar Resend (SMTP)

1. Crear cuenta en https://resend.com
2. Verificar dominio `orangefinanzas.app`
3. En Supabase Dashboard → Authentication → SMTP Settings:
   - Host: `smtp.resend.com`
   - Port: `465`
   - User: `resend`
   - Password: `re_xxxxxxxxxxxxxxxx` (tu API key de Resend)
   - Sender name: `Orange Finanzas`
   - Sender email: `auth@orangefinanzas.app`
