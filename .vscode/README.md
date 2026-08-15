# Celebra-me — VS Code Restricted Terminal & Task System

Esta carpeta contiene la infraestructura de **Terminales Restringidas y Tareas Automáticas** para el proyecto Celebra-me en VS Code.

---

## 📌 Componentes del Sistema

### 1. `.vscode/tasks.json`
Define las 17 tareas del proyecto registrándolas en VS Code:
* **10 Tareas Core Automáticas (`folderOpen`):** Se abren en modo Standby al iniciar cualquier worktree:
  * `dev`
  * `type-check`
  * `test`
  * `test:changed`
  * `lint`
  * `validate:changed`
  * `dbs`
  * `invitation:release`
  * `prod:apply`
  * `db:migrate`
* **7 Tareas Especializadas Bajo Demanda:** Disponibles desde la paleta de tareas (`Ctrl + Shift + P` -> `Tasks: Run Task`).

### 2. `.vscode/task-runner.ps1`
Script helper ejecutor que controla cada pestaña de terminal:
* **Restricción de Shell:** Solo permite ejecutar `pnpm <Command> [sus argumentos]`.
* **Seguridad:** Previene encadenamiento no autorizado de comandos (bloquea `;`, `&`, `|`).
* **Métricas en Tiempo Real:** Mide la duración con cronómetro de alta precisión, hora de inicio/fin y código de salida.
* **Información de Contexto:** Muestra en pantalla el nombre del Worktree, la **Rama Git activa** y el propósito del comando.
* **Historial Persistente:** Registra cada ejecución en `.vscode/history/<comando>.log`.

### 3. `.vscode/settings.json`
Configuración de formateo y estilo propia del proyecto Celebra-me (Prettier obligatorio para Astro/TS/JSON/MD e indexación de archivos SCSS).

### 4. `.vscode/history/` *(Ignorado en Git)*
Carpeta local que contiene los archivos de historial de ejecuciones en disco.

---

## 🚀 Cómo Usar

1. **Pestañas Automáticas:** Al abrir cualquier worktree en VS Code, se abrirán las 10 pestañas principales en reposo.
2. **Ejecutar un Comando:**
   * Haz clic en la pestaña deseada (ej. `pnpm test`).
   * Escribe argumentos opcionales (ej: `tests/unit/git-safety.test.ts` o `--watch`).
   * Presiona `ENTER`.
3. **Ejecutar Tareas Secundarias:**
   * Presiona `Ctrl + Shift + P` -> `Tasks: Run Task` -> Selecciona la tarea deseada (ej. `pnpm screenshot` o `pnpm lint:styles`).
