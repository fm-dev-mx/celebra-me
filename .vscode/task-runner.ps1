<#
.SYNOPSIS
    Script ejecutor de terminales restringidas e interactivas para Celebra-me.

.DESCRIPTION
    Este script actúa como interfaz segura (Task Runner) en VS Code. Bloquea el shell a la
    ejecución exclusiva del comando asignado (`pnpm <Command>`), soporta el paso de argumentos
    dinámicos, mide la duración exacta de ejecución, previene el encadenamiento de comandos
    no autorizados y registra un historial persistente en disco (.vscode/history/).

.PARAMETER Command
    El nombre del subcomando de pnpm a ejecutar exclusivamente (ej: type-check, test, dev, dbs).

.NOTES
    Proyecto: Celebra-me (Astro, TypeScript, Supabase)
    Configuración asociada: .vscode/tasks.json
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory = $true, HelpMessage = "Subcomando de pnpm asignado a esta terminal")]
    [string]$Command
)

# Establecer título de la pestaña en VS Code
$Host.UI.RawUI.WindowTitle = "pnpm $Command"

#region Metadata & Dictionaries
# Catálogo de metadatos, propósitos y guías de ayuda por comando
$commandDetails = @{
    "type-check"                = @{
        Desc    = "Verificacion de tipos TypeScript y esquemas Astro sin compilar."
        UseCase = "Detectar errores de sintaxis y tipos TS antes de abrir un PR o subir cambios."
        Help    = "Ingrese '--help' (o '--preserveWatchOutput' para modo observador)"
    }
    "test"                      = @{
        Desc    = "Ejecucion de pruebas unitarias Jest del proyecto."
        UseCase = "Comprobar que las funciones, calculos y reglas de negocio pasen las pruebas."
        Help    = "Ingrese '--help' (o una ruta especificando la prueba: tests/unit/mi-prueba.test.ts)"
    }
    "test:changed"              = @{
        Desc    = "Ejecuta unicamente unit tests de los archivos modificados."
        UseCase = "Validar rapidamente las pruebas unitarias afectadas por tus cambios locales."
        Help    = "Ingrese '--help' para ver opciones de Jest relativas a cambios"
    }
    "lint"                      = @{
        Desc    = "Analisis estatico de codigo TS/JS/Astro con ESLint."
        UseCase = "Identificar variables sin uso, importaciones rotas o violaciones de formato."
        Help    = "Ingrese '--help' (o '--fix' para autocorregir errores de formato)"
    }
    "lint:styles"               = @{
        Desc    = "Linter exclusivo de estilos SCSS/CSS con Stylelint."
        UseCase = "Detectar inconsistencias en archivos .scss y variables de diseño del proyecto."
        Help    = "Ingrese '--help' (o '--fix' para corregir formato en SCSS)"
    }
    "validate:changed"          = @{
        Desc    = "Validacion ultrarrapida de reglas solo en archivos cambiados."
        UseCase = "Verificar linter, tipos y tablas en el worktree actual antes de hacer commit."
        Help    = "Ingrese '--help' para ver opciones del validador incremental"
    }
    "dev"                       = @{
        Desc    = "Servidor de desarrollo local de Astro."
        UseCase = "Levantar la app en localhost para previsualizar invitaciones en el navegador."
        Help    = "Ingrese '--help' (o '--host' / '--port 3000' para cambiar puerto/red)"
    }
    "dbs"                       = @{
        Desc    = "CLI de operaciones de base de datos y provisionamiento."
        UseCase = "Consultar el estado de las BD locales/remotas y verificar conectividad."
        Help    = "Ingrese 'status' o '--help' para ver todas las suboperaciones disponibles"
    }
    "db:branch:parity"          = @{
        Desc    = "Verificacion de paridad de migraciones entre ramas/worktrees."
        UseCase = "Confirmar que la secuencia de migraciones de tu rama coincide con develop/main."
        Help    = "Ingrese '--help' para ver detalles del reporte de paridad"
    }
    "db:prod:backup"            = @{
        Desc    = "Respaldo seguro de la base de datos de produccion."
        UseCase = "Generar copia de respaldo previa a la aplicacion de parches o cambios de esquema."
        Help    = "Ingrese '--help' para ver opciones del guard de respaldo"
    }
    "invitation:release"        = @{
        Desc    = "CLI de preparacion y publicacion de versiones de invitaciones."
        UseCase = "Publicar o actualizar una version oficial de invitacion (ej: Daniela y Martin)."
        Help    = "Ingrese '--help' (o '--slug <nombre>' para indicar la invitacion a lanzar)"
    }
    "invitation:reconcile"      = @{
        Desc    = "Reconciliacion e integridad entre borrador y publicado."
        UseCase = "Sincronizar y corregir discrepancias entre borrador y la version desplegada."
        Help    = "Ingrese '--help' (o '--slug <nombre>' para reconciliar una invitacion especifica)"
    }
    "invitation:published-audit" = @{
        Desc    = "Auditoria de integridad de contenido publicado."
        UseCase = "Verificar que el contenido publicado no contenga datos PII o inconsistencias."
        Help    = "Ingrese '--help' (o '--all' para auditar todo el catalogo)"
    }
    "prod:apply"                = @{
        Desc    = "Aplicacion controlada de parches en produccion."
        UseCase = "Ejecutar parches SQL autorizados con guardas de seguridad en BD produccion."
        Help    = "Ingrese '--help' (o '--patch-id <id>' para seleccionar un parche especifico)"
    }
    "screenshot"                = @{
        Desc    = "Generacion automatizada de capturas de pantalla visuales."
        UseCase = "Capturar imagenes del renderizado de invitaciones para revision de diseño visual."
        Help    = "Ingrese '--help' (o '--interactive' para selector guiado de capturas)"
    }
    "test:e2e:landing"          = @{
        Desc    = "Pruebas End-to-End Playwright en la landing page."
        UseCase = "Simular interacciones reales de un invitado navegando en la landing page."
        Help    = "Ingrese '--help' (o '--headed' / '--ui' para modo visual interactivo)"
    }
}

# Comandos de alto impacto que requieren advertencia visual de seguridad
$sensitiveCommands = @("dbs", "prod:apply", "invitation:release", "db:prod:backup")
$isSensitive = $sensitiveCommands -contains $Command

# Obtener metadata del comando actual
$meta = $commandDetails[$Command]
$desc = if ($meta) { $meta.Desc } else { "Ejecucion exclusiva de 'pnpm $Command'." }
$useCase = if ($meta) { $meta.UseCase } else { "Ejecucion del comando en el worktree actual." }
$help = if ($meta) { $meta.Help } else { "Ingrese '--help' para ver la ayuda disponible." }

# Directorio y archivo de historial persistente en disco
$historyDir = Join-Path (Get-Location) ".vscode\history"
if (-not (Test-Path $historyDir)) {
    New-Item -ItemType Directory -Path $historyDir -Force | Out-Null
}
$safeCmdName = $Command -replace ':', '_'
$historyFile = Join-Path $historyDir "$safeCmdName.log"
#endregion

#region Loop Principal de Ejecucion
$runCount = 0
$shouldClearOnNextLoop = $true

while ($true) {
    try {
        if ($shouldClearOnNextLoop) {
            Clear-Host
        }
        $shouldClearOnNextLoop = $true

        $worktreeName = Split-Path (Get-Location) -Leaf
        $gitBranch = try { (git branch --show-current 2>$null) } catch { "" }
        if ([string]::IsNullOrWhiteSpace($gitBranch)) { $gitBranch = "detached/N/A" }

        # --- Renderizado de Cabecera Visual ---
        Write-Host ""
        Write-Host "+--------------------------------------------------------------------------+" -ForegroundColor Cyan
        
        if ($isSensitive) {
            Write-Host "|  [!] CELEBRA-ME BD/PROD  ::  pnpm $Command  [Rama: $gitBranch]" -ForegroundColor Red
        } else {
            Write-Host "|  [*] CELEBRA-ME DEV      ::  pnpm $Command  [Rama: $gitBranch]" -ForegroundColor Yellow
        }

        Write-Host "+--------------------------------------------------------------------------+" -ForegroundColor Cyan
        Write-Host "  Proposito : $desc" -ForegroundColor White
        Write-Host "  Caso Uso  : $useCase" -ForegroundColor Yellow
        Write-Host "  Ayuda/Doc : $help" -ForegroundColor DarkCyan
        Write-Host "  Contexto  : Worktree: $worktreeName  |  Ejecucion: #$runCount  |  Config: .vscode/tasks.json" -ForegroundColor DarkGray

        # Mostrar ultimas ejecuciones del historial persistente si existen
        if (Test-Path $historyFile) {
            $recentLogs = Get-Content $historyFile -Tail 3
            if ($recentLogs.Count -gt 0) {
                Write-Host "  Historial :" -ForegroundColor Magenta
                foreach ($logLine in $recentLogs) {
                    Write-Host "    $logLine" -ForegroundColor Gray
                }
            }
        }

        Write-Host "+--------------------------------------------------------------------------+" -ForegroundColor Cyan
        Write-Host ""

        # --- Prompt Interactivo ---
        $argsInput = Read-Host "[$gitBranch] pnpm $Command"
        
        # Guardas de Seguridad: Prevenir encadenamiento de comandos prohibidos (; & |)
        if ($argsInput -match '[;&|]') {
            Write-Host ""
            Write-Host "[!] SEGURIDAD: Operadores de encadenamiento (;, &, |) no estan permitidos." -ForegroundColor Red
            Write-Host "    Esta terminal ejecuta exclusivamente 'pnpm $Command [sus argumentos]'." -ForegroundColor Red
            Start-Sleep -Seconds 2
            continue
        }

        $runCount++
        $fullCmd = if ([string]::IsNullOrWhiteSpace($argsInput)) { "pnpm $Command" } else { "pnpm $Command $argsInput" }

        $startTime = Get-Date
        Write-Host ""
        Write-Host "[>] [$($startTime.ToString('HH:mm:ss'))] [$gitBranch] Ejecutando: $fullCmd" -ForegroundColor Green
        Write-Host "==========================================================================" -ForegroundColor DarkGray

        # Iniciar cronometro de alta precision
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

        # Ejecutar subcomando asignado
        cmd /c $fullCmd
        $exitCode = $LASTEXITCODE

        $stopwatch.Stop()
        $endTime = Get-Date
        $duration = $stopwatch.Elapsed

        $durationFormatted = if ($duration.TotalMinutes -ge 1) {
            "{0:m'm 's's'}" -f $duration
        } else {
            "{0:s\.ff's'}" -f $duration
        }

        Write-Host "==========================================================================" -ForegroundColor DarkGray

        # Distinguir entre exito (0), Ctrl+C (130 / -1073741510) y error de proceso
        if ($exitCode -eq 0) {
            $statusText = "EXITO (0)"
            Write-Host "[OK] PROCESO FINALIZADO [$($endTime.ToString('HH:mm:ss'))] | Duracion: $durationFormatted | Exit Code: 0" -ForegroundColor Green
        } elseif ($exitCode -eq 130 -or $exitCode -eq -1073741510) {
            # Ctrl+C o interrupcion voluntaria
            $statusText = "DETENIDO/FINALIZADO"
            Write-Host "[i] PROCESO FINALIZADO O DETENIDO [$($endTime.ToString('HH:mm:ss'))] | Tiempo activo: $durationFormatted" -ForegroundColor Yellow
        } else {
            $statusText = "FALLO ($exitCode)"
            Write-Host "[FAIL] PROCESO FINALIZADO CON ERROR [$($endTime.ToString('HH:mm:ss'))] | Duracion: $durationFormatted | Exit Code: $exitCode" -ForegroundColor Red
        }

        # Registrar entrada en el log persistente (.vscode/history/$safeCmdName.log)
        $logEntry = "• [$($endTime.ToString('dd/MM HH:mm:ss'))] [$gitBranch] [$fullCmd] -> $statusText ($durationFormatted)"
        Add-Content -Path $historyFile -Value $logEntry -Encoding UTF8

        Write-Host ""
        Write-Host "💡 Presione ENTER para reiniciar o ingrese nuevos argumentos." -ForegroundColor DarkCyan
        
        # En la siguiente iteracion no limpiamos la pantalla inmediatamente para que el usuario pueda leer los logs de salida
        $shouldClearOnNextLoop = $false

    } catch [System.Management.Automation.PipelineStoppedException], [System.OperationCanceledException] {
        Write-Host ""
        Write-Host "[i] Interrupcion capturada (Ctrl+C). La pestaña permanece activa." -ForegroundColor Yellow
        Write-Host "💡 Presione ENTER para reiniciar '$fullCmd'." -ForegroundColor DarkCyan
        $shouldClearOnNextLoop = $false
        Start-Sleep -Milliseconds 500
        continue
    } catch {
        Write-Host "[!] Error imprevisto en el runner: $_" -ForegroundColor Red
        $shouldClearOnNextLoop = $false
        Start-Sleep -Seconds 2
    }
}
#endregion
