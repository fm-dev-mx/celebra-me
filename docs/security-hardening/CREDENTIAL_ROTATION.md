# 🔐 Guía de Rotación de Credenciales

## ⚠️ URGENTE - Acción Requerida

Las siguientes credenciales están expuestas en el repositorio y DEBEN ser rotadas ANTES de cualquier
deploy a producción.

---

## 📋 Lista de Credenciales a Rotar

### 1. SendGrid API Key

**Riesgo:** Envío de emails spoofing, uso de cuota

**Pasos:**

1. Ir a: https://app.sendgrid.com/settings/api_keys
2. Localizar la API key existente (termina en las últimas 4 dígitos del archivo .env)
3. Click en "Delete" para revocar
4. Click en "Create API Key"
5. Nombre: "Celebra-me Production"
6. Permisos: "Full Access" o "Restricted Access" (Mail Send)
7. Copiar la nueva key (solo se muestra una vez)
8. Actualizar en Vercel:
    - Ir a: https://vercel.com/dashboard
    - Seleccionar proyecto
    - Settings > Environment Variables
    - Actualizar `SENDGRID_API_KEY`

**Test:**

```bash
# Verificar que emails funcionan
npm run test:email
```

---

### 2. Gmail App Password

**Riesgo:** Acceso completo a cuenta de Gmail

**Pasos:**

1. Ir a: https://myaccount.google.com/apppasswords
2. Iniciar sesión con la cuenta de Gmail
3. Localizar el app password existente
4. Click en "Delete" para revocar
5. Click en "Select app" > "Other (Custom name)"
6. Nombre: "Celebra-me Production"
7. Click "Generate"
8. Copiar el password de 16 caracteres (sin espacios)
9. Actualizar en Vercel:
    - Variable: `GMAIL_PASS`
    - Valor: El nuevo password de 16 caracteres

**Nota:** La cuenta debe tener 2FA habilitado para usar App Passwords.

---

### 3. Supabase Service Role Key

**Riesgo:** Acceso total a la base de datos (bypass RLS)

**Pasos:**

1. Ir a: https://supabase.com/dashboard/project/_/settings/api
2. Seleccionar el proyecto
3. Sección "Project API keys"
4. Localizar `service_role` key
5. Click en "Regenerate" junto a service_role
6. Confirmar regeneración
7. Copiar la nueva key
8. Actualizar en Vercel:
    - Variable: `SUPABASE_SERVICE_ROLE_KEY`
    - Valor: Nueva service_role key

**⚠️ Importante:** Esta acción invalidará todas las sesiones/operaciones usando la key anterior.

**Test:**

```bash
# Verificar conexión
npm run db:test-connection
```

---

### 4. Supabase Anon Key

**Riesgo:** Acceso a la base de datos como usuario anónimo

**Pasos:**

1. Ir a: https://supabase.com/dashboard/project/_/settings/api
2. Sección "Project API keys"
3. Localizar `anon` key
4. Click en "Regenerate" junto a anon
5. Confirmar regeneración
6. Copiar la nueva key
7. Actualizar en Vercel:
    - Variable: `SUPABASE_ANON_KEY`
    - Valor: Nueva anon key

**Nota:** Los usuarios autenticados tendrán que re-logear después de este cambio.

---

### 5. RSVP Admin Password

**Riesgo:** Acceso administrativo al sistema RSVP

**Pasos:**

1. Si es un usuario de Supabase Auth:
    - Ir a: https://supabase.com/dashboard/project/_/auth/users
    - Localizar el usuario admin
    - Click en "Edit" > "Password"
    - Generar nuevo password seguro (12+ caracteres, mezcla de tipos)
2. Si es variable de entorno:
    - Generar nuevo password: `openssl rand -base64 24`
    - Actualizar en Vercel:
        - Variable: `RSVP_ADMIN_PASSWORD`
        - Valor: Nuevo password

---

## ✅ Checklist Post-Rotación

Después de rotar TODAS las credenciales:

- [ ] Nueva SendGrid API Key funciona (test envío de email)
- [ ] Nueva Gmail App Password funciona
- [ ] Nueva Supabase Service Role Key funciona
- [ ] Nueva Supabase Anon Key funciona
- [ ] Nuevo RSVP Admin Password funciona
- [ ] Todas las credenciales están en Vercel (Production, Preview, Development)
- [ ] Aplicación funciona correctamente en local
- [ ] Aplicación funciona correctamente en preview deploy

---

## 🚨 Después de Rotar

1. **NO commitear las nuevas credenciales al repo**
2. **Ejecutar:** `./scripts/remove-env-from-history.sh`
3. **Configurar:** Pre-commit hooks para evitar futuros leaks
4. **Notificar:** Al equipo que deben reclonar el repo o hacer `git pull --force`

---

## 📞 Soporte

Si tienes problemas:

- SendGrid: https://support.sendgrid.com
- Supabase: https://supabase.com/support
- Gmail: https://support.google.com/accounts

---

**Documento creado:** 2026-02-15  
**Última actualización:** 2026-02-15
