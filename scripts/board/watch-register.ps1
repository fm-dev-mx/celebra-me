# Registers the board watcher (scripts/board/watch.mjs) in the Windows Task Scheduler: every 10 minutes,
# for the signed-in user, from the checkout that holds this script. The owner runs it once from the
# Integration checkout: pnpm board:watch:register. Remove it with pnpm board:watch:unregister.
$ErrorActionPreference = 'Stop'
$taskName = 'Celebra-me vigilante del tablero'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$node = (Get-Command node -ErrorAction Stop).Source
# fnm puts node behind a per-shell junction that it deletes later; the task needs the real install.
# After installing another Node version, register the task again.
$nodeDir = Get-Item (Split-Path $node)
if ($nodeDir.LinkType) { $node = Join-Path @($nodeDir.Target)[0] (Split-Path $node -Leaf) }
$watch = Join-Path $root 'scripts\board\watch.mjs'

# conhost --headless keeps a console window from flashing every 10 minutes.
$action = New-ScheduledTaskAction -Execute 'conhost.exe' `
	-Argument "--headless `"$node`" `"$watch`"" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
	-RepetitionInterval (New-TimeSpan -Minutes 10)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
	-StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 2)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
	-Principal $principal -Description 'Aviso de Windows cuando un agente tiene una tarea nueva lista (pnpm board:watch).' `
	-Force | Out-Null
Write-Output "Tarea programada registrada: `"$taskName`", cada 10 minutos desde $root."
