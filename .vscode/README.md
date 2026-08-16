# Celebra-me — VS Code Restricted Terminal & Task System

Esta carpeta contiene la infraestructura de **Terminales Restringidas, Tareas Automáticas e Iconos
Temáticos** para el proyecto Celebra-me en VS Code.

---

## 📌 Componentes del Sistema

### 1. `.vscode/tasks.json`

Define las 17 tareas del proyecto registrándolas en VS Code con sus respectivos **Iconos Codicons y
Colores ANSI**:

- **10 Tareas Core Automáticas (`folderOpen`):** Se abren en modo Standby al iniciar cualquier
  worktree:
  - `Servidor dev (pnpm dev)` — Servidor de desarrollo local (`play`, verde)
  - `Tipos (type-check)` — Verificación de tipos TS (`check-all`, azul)
  - `Pruebas (test)` — Pruebas unitarias Jest (`beaker`, verde)
  - `Pruebas cambiadas (test:changed)` — Pruebas en archivos modificados (`beaker`, verde)
  - `Linter JS/TS (lint)` — Análisis con ESLint (`search`, amarillo)
  - `Validar cambios (validate:changed)` — Validador incremental pre-commit (`verified`, azul)
  - `Consola BD (dbs)` — CLI de bases de datos (`database`, cian)
  - `Publicar invitación (release)` — Publicación de versiones (`rocket`, magenta)
  - `Aplicar Producción (prod:apply)` — Parches SQL en producción (`shield`, rojo)
  - `Migraciones BD (db:migrate)` — Migraciones de base de datos (`database`, cian)
- **7 Tareas Especializadas Bajo Demanda:** Disponibles desde la paleta de tareas
  (`Ctrl + Shift + P` -> `Tasks: Run Task`).

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
