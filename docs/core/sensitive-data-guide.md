# Guía de Prevención de Datos Sensibles

**Última actualización:** 2026-05-29

## ¿Qué constituye información sensible (PII)?

En el contexto de Celebra-me, se considera información sensible todo aquello que pueda identificar
directa o indirectamente a un cliente real:

- **Nombres completos** reales de clientes, familiares, padrinos, invitados
- **Direcciones físicas** reales (domicilios, venues, salones)
- **Números de teléfono** reales de clientes o contactos
- **Correos electrónicos** reales de clientes
- **URLs de Cloudinary u otros assets** que expongan IDs de proyectos reales
- **Preferencias o datos personales** que puedan vincularse a una persona real
- **Tokens o enlaces de captura** reales que hayan sido compartidos con clientes

## Reglas para datos en el repositorio

### Emails

- Todo email en archivos de código, tests, fixtures, o contenido **debe** usar el dominio
  `@example.com`.
- Ejemplo: `cliente@example.com`, `invitado@example.com`

### Teléfonos

- Todo número telefónico en archivos de prueba, demos, contenido mock, o placeholders **debe** usar
  `+521000000000` (o `521000000000` sin prefijo).
- Excepción: números usados en validación de formato (e.g., probar que 10 dígitos funciona) pueden
  usar patrones sintéticos como `0000000000`.

### Nombres

- En archivos de contenido (`src/content/events/`) para eventos **no reales**, usar placeholders
  como `Juan Pérez`, `María García`, `Ciudad de Prueba`.
- En contenido de eventos reales en producción, los datos de clientes deben manejarse a través del
  módulo intake, no hardcodearse en archivos JSON.

### URLs de assets

- URLs de Cloudinary que apunten a assets de clientes reales **nunca** deben committease.
- En demos y tests, usar URLs de ejemplo (`https://res.cloudinary.com/example/...`) o de servicios
  de stock images.

## Prohibiciones explícitas

1. **No hacer commit** de scripts con datos de clientes reales (ej. scripts de seed con nombres
   verdaderos, direcciones reales).
2. **No hardcodear** números de WhatsApp reales en componentes o data files. Usar siempre la
   variable de entorno `CONTACT_WHATSAPP`.
3. **No incluir** archivos `.bak`, `.tmp`, o copias de seguridad que contengan datos sensibles en el
   repositorio.
4. **No exponer** tokens de captura, API keys, o secrets en archivos de código.

## Proceso de revisión pre-commit

Antes de cada commit, verificar:

1. **¿Contiene nombres reales de clientes?** → Reemplazar con placeholders.
2. **¿Contiene teléfonos o emails reales?** → Reemplazar con `+521000000000` o `@example.com`.
3. **¿Contiene URLs de Cloudinary con IDs reales?** → Reemplazar con URLs de ejemplo.
4. **¿Es un script que crea datos en Supabase?** → Asegurarse de que usa datos mock.
5. **¿El commit incluye archivos `.bak`, `.log`, `.tmp`?** → Excluirlos con `.gitignore` o no
   incluirlos.

### Uso de hooks

El proyecto usa husky + lint-staged. Si se detectan archivos con extensión `.bak`, el equipo debe
revisar manualmente si contienen datos sensibles antes de eliminarlos.

## Uso de variables de entorno

- Los secrets y datos de configuración sensible deben ir en `.env.local` (incluido en `.gitignore`).
- `.env.example` contiene solo placeholders.
- `src/env.d.ts` tipa las variables de entorno disponibles.
- Nunca committear `.env.local` con valores reales.

## Archivos de contenido (`src/content/events/`)

Los archivos JSON en `src/content/events/` son parte del repositorio público. Por lo tanto:

- Los eventos de demostración (`isDemo: true`) deben usar datos placeholder.
- Los eventos reales (`isDemo: false`) deben contener solo la información mínima necesaria para el
  funcionamiento técnico (nombres del festejado, fechas, venues). No deben incluir datos personales
  sensibles de terceros (padrinos, invitados) que puedan ser considerados PII.

Para manejar datos de clientes reales, el sistema debe usar el módulo intake:

- `invitation_projects` + `intake_requests` + `intake_submissions` en Supabase.
- Los datos se almacenan en la base de datos, no en archivos del repositorio.

## Referencias

- `.env.example` — template de variables de entorno
- `src/env.d.ts` — tipado de variables de entorno
- `docs/core/git-governance.md` — política de commits
- `CONTRIBUTING.md` — guía de contribución
