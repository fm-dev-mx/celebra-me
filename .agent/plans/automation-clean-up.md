# Plan: Automation & Scripts Clean-up

## Propósito

Unificar el ecosistema de tooling, erradicar scripts temporales, obsoletos o huérfanos y mejorar la
usabilidad (incluyendo mejor manejo de errores) de los flujos de operaciones críticos en un esquema
estándar de portabilidad cruzada.

## Fase 1: Limpieza Inicial (Inmediata)

- [ ] Mapear y destinar a eliminación incondicional los scripts de testeo directo ubicados en la
      raíz que no pertenecen a la canalización DevOps principal:
    - `test_empty_body.js`
    - `test_json_error.js`
    - `test-error-mapper.js`
- [ ] Eliminar o integrar los scripts listados de `scripts/` (huérfanos) al flujo maestro
      (`package.json`) en caso de ser utilizados esporádicamente (ej. migrarlos a comandos directos
      en `.agent/governance/bin/`).

## Fase 2: Estandarización de Lenguaje (Políglota a TypeScript/MJS)

- [ ] Convertir utilidades en bash (`rotate-credentials.sh`, `check-links.sh`, `find-stale.sh`,
      `sync-runner.sh`) a scripts unificados de **Node.js** (`.mjs` o TypeScript puro). Esto
      previene choques en desarrolladores con entornos nativos Windows.
- [ ] Analizar portabilidad del entorno PowerShell `rsvp-db-remote-runbook.ps1` y reimplementarlo en
      un marco uniforme de JS/TS.

## Fase 3: Hardening de Funcionalidad

- [ ] **Manejo de argumentos:** Implementar un esqueleto o empaquetador simple (como
      `util.parseArgs` interconstruido en Node >= 18) en todos los scripts de operaciones críticos
      para homogeneizar banderas.
- [ ] **Modo Dry-Run:** Proveer compatibilidad flag `--dry-run` a scripts inestables que mutan
      entornos locales, archivos y CI/CD.
- [ ] **Help Flag (`--help`):** Establecer salidas directas con documentaciones simples listadas del
      uso a todo script para optimizar auto-descubrimiento en un ecosistema central.

## Fase 4: Sincronismo de Variables de Entorno y Configuraciones Purgadas

- [ ] Ajustar `src/lib/env-validation.ts` anexando las variables olvidadas durante la validación
      inicial (e.g. `ENABLE_MFA`, `SENTRY_AUTH_TOKEN`, `TRUST_DEVICE_MAX_AGE_DAYS`). Esta
      sincronización garantizará coherencia 1-1 con `.env.example`.
- [ ] Depurar atributos expuestos en `.env.example` que hayan quedado deprecados realmente durante
      el análisis.
