# Ventana diaria de Producción: sube, activa y comprueba el Worker de la main actual, deja el checkout
# en esa main y encadena `pnpm prod:apply -- --schema --all-ready`.
# Uso: pnpm prod:window [-UploadRunId <id de un run de upload ya lanzado>]
# Se detiene en el primer fallo. Se puede volver a correr: salta lo que ya está hecho.
# Es del dueño: no omite ninguna confirmación del deploy ni de prod:apply (se contestan a mano).
param([string]$UploadRunId = '')
$ErrorActionPreference = 'Stop'
$repo = 'fm-dev-mx/celebra-me'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..\..'))
fnm env --shell powershell | Out-String | Invoke-Expression

function Runs-Dispatch {
    # Newest workflow_dispatch runs of the deploy workflow on main.
    @(gh run list --repo $repo --workflow deploy-production.yml --branch main --event workflow_dispatch --limit 20 --json databaseId,headSha | ConvertFrom-Json)
}

function Nuevo-Run([string[]]$previos, [string]$headSha) {
    # Returns the id of the first run for $headSha that was not listed before the dispatch.
    # It compares run ids, not timestamps: the local clock can differ from GitHub's by
    # seconds (a run created right after dispatch then looks older) or by the UTC offset.
    for ($i = 0; $i -lt 30; $i++) {
        $run = Runs-Dispatch | Where-Object { $_.headSha -eq $headSha -and [string]$_.databaseId -notin $previos } | Select-Object -First 1
        if ($run) { return [string]$run.databaseId }
        Start-Sleep 5
    }
    throw "No apareció el run del workflow para $headSha."
}

function Esperar-Run([string]$id) {
    # Espera a que el run termine; falla si no terminó en success.
    while ($true) {
        $r = gh run view $id --repo $repo --json status,conclusion | ConvertFrom-Json
        if ($r.status -eq 'completed') { break }
        Write-Host "  run $id : $($r.status)…"
        Start-Sleep 15
    }
    if ($r.conclusion -ne 'success') { throw "El run $id terminó en $($r.conclusion)." }
    Write-Host "  run $id : success"
}

# 1. Checkout en la main nueva.
git fetch origin
$sha = git rev-parse origin/main
Write-Host "main = $sha"
if ((git rev-parse HEAD) -ne $sha) {
    git checkout --detach origin/main
}
if (git status --porcelain) { throw 'El checkout no quedó limpio.' }

# 2. Subir el Worker (o seguir el run de upload ya lanzado).
if (-not $UploadRunId) {
    $previos = @(Runs-Dispatch | ForEach-Object { [string]$_.databaseId })
    gh workflow run deploy-production.yml --repo $repo --ref main -f step=upload
    $UploadRunId = Nuevo-Run $previos $sha
}
Esperar-Run $UploadRunId
$linea = gh run view $UploadRunId --repo $repo --log | Select-String 'Worker Version ID: ([0-9a-f-]{36})' | Select-Object -First 1
if (-not $linea) { throw 'No encontré el Worker Version ID en el log.' }
$ver = $linea.Matches[0].Groups[1].Value
Write-Host "Versión subida: $ver"

# 3. Activarla al 100 % y comprobarla.
pnpm exec wrangler versions deploy "$ver@100%" --config wrangler.jsonc --env production --yes
if ($LASTEXITCODE) { throw 'Falló la activación.' }
pnpm exec wrangler deployments status --config wrangler.jsonc --env production
for ($i = 0; $i -lt 24; $i++) {
    $h = Invoke-RestMethod https://www.celebra-me.com/api/health
    if ($h.build.commitSha -eq $sha) { break }
    Start-Sleep 5
}
if ($h.build.commitSha -ne $sha) { throw "El dominio sirve $($h.build.commitSha), no $sha." }
Write-Host 'El dominio ya sirve la main nueva.'

# 4. Smoke del dominio en GitHub y estado del release.
$previos = @(Runs-Dispatch | ForEach-Object { [string]$_.databaseId })
gh workflow run deploy-production.yml --repo $repo --ref main -f step=domain-smoke
Esperar-Run (Nuevo-Run $previos $sha)
pnpm ops:release-status --target production --sha $sha --wait
if ($LASTEXITCODE) { throw 'ops:release-status no quedó en verde.' }
Write-Host 'Worker verificado. Sigue prod:apply (te pedirá tus confirmaciones).'

# 5. Contenido y esquema: plan y confirmaciones interactivas de prod:apply, sin saltarlas.
pnpm prod:apply -- --schema --all-ready
if ($LASTEXITCODE) { throw 'prod:apply no terminó bien.' }
Write-Host 'Ventana diaria completa.'
