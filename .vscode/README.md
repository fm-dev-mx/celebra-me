# Celebra-me — VS Code Restricted Terminal & Task System

Esta carpeta contiene la infraestructura de **Terminales Restringidas, Tareas Automáticas e Iconos
Temáticos** para el proyecto Celebra-me en VS Code.

---

## 📌 Componentes del Sistema

### 1. `.vscode/tasks.json`

Define las 19 tareas del proyecto registrándolas en VS Code con sus respectivos **Iconos Codicons y
Colores ANSI**:

- **12 Tareas Core Automáticas (`folderOpen`):** Se abren en modo Standby al iniciar cualquier
  worktree:
  - `Servidor dev (pnpm dev)` — Servidor de desarrollo local (`play`, verde). Enter siempre arranca:
    primero cierra el proceso `node` que ocupe el puerto de ese carril (nunca otro programa).
  - `Tablero (board:serve)` — Tablero en `127.0.0.1:4320` (`checklist`, magenta). Desde cualquier
    carril corre el código de Integration; Enter cierra el `node` que ocupe el 4320 y lo reinicia.
  - `Sincronizar tablero (board:sync)` — Sincronización sin IA con ramas, PRs y carriles, con el
    código de Integration; `--dry-run` solo muestra los cambios (`sync`, magenta)
  - `Tipos (type-check)` — Verificación de tipos TS (`check-all`, azul)
  - `Pruebas (test)` — Pruebas unitarias Jest (`beaker`, verde)
  - `Pruebas cambiadas (test:changed)` — Pruebas en archivos modificados (`beaker`, verde)
  - `Linter JS/TS (lint)` — Análisis con ESLint (`search`, amarillo)
  - `Validar cambios (validate:changed)` — Validación de los archivos cambiados del árbol de trabajo
    (`verified`, azul)
  - `Consola BD (dbs)` — CLI de bases de datos (`database`, cian)
  - `Publicar invitación (release)` — `invitation:release` en Local/Preview; requiere `--status`,
    `--dry-run` o `--apply` (el menú guiado es `pnpm dbs`) (`rocket`, magenta)
  - `Aplicar Producción (prod:apply)` — Plan/apply de Producción solo para el owner (`--schema`,
    `--slug`, `--patch`) (`shield`, rojo)
  - `Migraciones BD (db:migrate)` — Migraciones de base de datos (`database`, cian)
- **7 Tareas Especializadas Bajo Demanda:** Disponibles desde la paleta de tareas
  (`Ctrl + Shift + P` -> `Tasks: Run Task`):
  - `Linter estilos (lint:styles)` — Stylelint sobre SCSS (`paintcan`, amarillo)
  - `Paridad de rama (db:branch:parity)` — Paridad de esquema entre ramas (`git-compare`, cian)
  - `Respaldo Producción (db:prod:backup)` — Respaldo de la BD de Producción (`archive`, rojo)
  - `Reconciliar (reconcile)` — `invitation:reconcile` (`sync`, magenta)
  - `Auditoría PII (published-audit)` — `invitation:published-audit` (`eye`, magenta)
  - `Capturas visuales (screenshot)` — Capturas de invitaciones (`device-camera`, magenta)
  - `Estado (ops:status)` — Estado de operación en texto, solo lectura: develop frente a main,
    uniones a main sin tag, diagnóstico de `prod:apply`, limpieza pendiente con su comando y `dbs`
    de Local; con `--remote`, migraciones pendientes en Preview y Production (`pulse`, cian)

### 2. `.vscode/task-runner.ps1`

Script helper ejecutor que controla cada pestaña de terminal:

- **Modo Dual:** Modos restringidos a `pnpm <Command>` y modo `terminal`/`pwsh` por defecto para
  otros comandos.
- **Seguridad:** Previene encadenamiento no autorizado en comandos restringidos (bloquea `;`, `&`,
  `|`).
- **Métricas en Tiempo Real:** Mide la duración con cronómetro de alta precisión, hora de inicio/fin
  y código de salida.
- **Información de Contexto:** Muestra en pantalla el nombre del Worktree, la **Rama Git activa** y
  el propósito del comando.
- **Historial de Últimas 3 Ejecuciones:** Muestra las últimas 3 ejecuciones en la cabecera e imprime
  el historial persistente en `.vscode/history/<comando>.log`.

### 3. `.vscode/settings.json`

Configuración de formateo y estilo propia del proyecto Celebra-me (Prettier obligatorio para
Astro/TS/JSON/MD e indexación de archivos SCSS).

### 4. `.vscode/history/` _(Ignorado en Git)_

Carpeta local que contiene los archivos de historial de ejecuciones en disco.

---

## 🚀 Cómo Usar

1. **Pestañas Automáticas:** Al abrir cualquier worktree en VS Code, se abrirán las 10 pestañas
   principales en reposo.
2. **Ejecutar Tareas Restringidas:**
   - Haz clic en la pestaña deseada (ej. `pnpm test`).
   - Escribe argumentos opcionales (ej: `tests/unit/git-safety.test.ts` o `--watch`).
   - Presiona `ENTER`.
3. **Ejecutar Tareas Secundarias:**
   - Presiona `Ctrl + Shift + P` -> `Tasks: Run Task` -> Selecciona la tarea deseada (ej.
     `pnpm screenshot` o `pnpm lint:styles`).

## Lane discovery

The terminal fallback reads the executable lane table rather than maintaining editor-specific paths.
Use `lanes` to display canonical ids and `lane <id>` to navigate when explicitly assigned. See the
[lane guide](../docs/core/worktrees/README.md). Keyboard/profile installation is separate; the
repository does not install shortcuts or move checkouts.
