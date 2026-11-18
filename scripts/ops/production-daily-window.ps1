# Ventana diaria de Producción: sube, activa y comprueba el Worker de la main actual, deja el checkout
# en esa main y encadena `pnpm prod:apply -- --schema --all-ready`.
# Uso: pnpm prod:window [-UploadRunId <id de un run de upload ya lanzado>]
# Se detiene en el primer fallo. Se puede volver a correr: salta lo que ya está hecho.
# Es del dueño: no omite ninguna confirmación del deploy ni de prod:apply (se contestan a mano).
param(
    [string]$UploadRunId = '',
    [ValidateRange(0, 3600)][int]$CiTimeoutSeconds = 600
)
$ErrorActionPreference = 'Stop'
$repo = 'fm-dev-mx/celebra-me'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..\..'))
fnm env --shell powershell | Out-String | Invoke-Expression

function Runs-Dispatch {
    # Newest workflow_dispatch runs of the deploy workflow on main.
    @(gh run list --repo $repo --workflow deploy-production.yml --branch main --event workflow_dispatch --limit 20 --json databaseId,headSha | ConvertFrom-Json)
}

function Wait-CiEvidence([string]$headSha) {
    # Reuse the canonical trusted, exact-SHA gate instead of duplicating check names or trust rules.
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    do {
        $raw = pnpm --silent ops:release-checks $headSha
        if ($LASTEXITCODE -eq 0) {
            try { $evidence = ($raw -join "`n") | ConvertFrom-Json } catch {
                throw "La evidencia de CI para $headSha no es JSON válido."
            }
            if ($evidence.sha -ne $headSha -or $evidence.state -ne 'CHECKS_PASSED') {
                throw "La evidencia de CI no acredita el SHA $headSha."
            }
            Write-Host "CI verificado para $headSha."
            return
        }
        $remaining = $CiTimeoutSeconds - $timer.Elapsed.TotalSeconds
        if ($remaining -le 0) { break }
        Write-Host "Esperando evidencia de CI para $headSha (máximo $CiTimeoutSeconds s)…"
        Start-Sleep -Seconds ([Math]::Min(15, $remaining))
    } while ($timer.Elapsed.TotalSeconds -lt $CiTimeoutSeconds)
    throw "Se agotó la espera de CI ($CiTimeoutSeconds s) para $headSha; no se despachó ni activó el Worker."
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

function Version-Del-Upload([string]$id, [string]$headSha) {
    # Returns the Worker version uploaded by run $id after checking that the run is a successful
    # `step=upload` dispatch of deploy-production.yml on main for $headSha. It covers both a run
    # this script dispatched and one passed with -UploadRunId, so nothing reaches traffic otherwise.
    $workflowId = [string](gh api "repos/$repo/actions/workflows/deploy-production.yml" --jq .id)
    if (-not $workflowId) { throw 'No pude leer el id del workflow deploy-production.yml.' }
    $r = gh run view $id --repo $repo --json databaseId,headSha,headBranch,event,workflowDatabaseId,status,conclusion,jobs | ConvertFrom-Json
    if (-not $r) { throw "No pude leer el run $id." }
    if ([string]$r.workflowDatabaseId -ne $workflowId) { throw "El run $id no es de deploy-production.yml." }
    if ($r.headBranch -ne 'main' -or $r.event -ne 'workflow_dispatch') {
        throw "El run $id no es un workflow_dispatch en main ($($r.event) en $($r.headBranch))."
    }
    if ($r.headSha -ne $headSha) { throw "El run $id es de $($r.headSha), no de la main $headSha." }
    if ($r.status -ne 'completed' -or $r.conclusion -ne 'success') {
        throw "El run $id no terminó en success ($($r.status)/$($r.conclusion))."
    }
    $job = @($r.jobs | Where-Object { $_.name -eq 'Cloudflare production upload' })
    if ($job.Count -ne 1 -or $job[0].conclusion -ne 'success') { throw "El run $id no tiene un upload exitoso." }
    foreach ($paso in 'Upload Worker version', 'Smoke the uploaded version') {
        $s = @($job[0].steps | Where-Object { $_.name -eq $paso })
        if ($s.Count -ne 1 -or $s[0].conclusion -ne 'success') { throw "En el run $id el paso '$paso' no terminó en success." }
    }
    $ids = @(gh run view $id --repo $repo --log --job $job[0].databaseId |
        Select-String 'Worker Version ID: ([0-9a-f-]{36})' -AllMatches |
        ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
    if ($ids.Count -ne 1) { throw "El log del upload del run $id tiene $($ids.Count) Worker Version ID; espero 1." }
    return $ids[0]
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
Wait-CiEvidence $sha
if (-not $UploadRunId) {
    $previos = @(Runs-Dispatch | ForEach-Object { [string]$_.databaseId })
    gh workflow run deploy-production.yml --repo $repo --ref main -f step=upload
    $UploadRunId = Nuevo-Run $previos $sha
}
Esperar-Run $UploadRunId
$ver = Version-Del-Upload $UploadRunId $sha
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
