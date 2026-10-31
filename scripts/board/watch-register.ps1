# Registers the no-AI master watcher in Windows Task Scheduler: every minute,
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
$watch = Join-Path $root 'scripts\board\tablero-core.mjs'

# conhost --headless keeps a console window from flashing every minute; each run is one pass.
$action = New-ScheduledTaskAction -Execute 'conhost.exe' `
	-Argument "--headless `"$node`" `"$watch`" watch --once" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
	-RepetitionInterval (New-TimeSpan -Minutes 1)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
	-StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
	-Principal $principal -Description 'Despierta a los chats maestros solo cuando hay trabajo nuevo (d351, sin IA).' `
	-Force | Out-Null
Write-Output "Tarea programada registrada: `"$taskName`", cada minuto desde $root."
