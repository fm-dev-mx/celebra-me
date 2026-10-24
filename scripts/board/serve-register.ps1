# Registers the board server (pnpm board:serve, http://127.0.0.1:4320/) in the Windows Task Scheduler for
# the signed-in user, from the checkout that holds this script. It starts at sign-in and is retried every
# 5 minutes: while a server is running the retry is ignored, and when port 4320 is already taken by a
# manual `pnpm board:serve` the new one exits at once. The owner runs it once from the Integration
# checkout: pnpm board:serve:register. Remove it with pnpm board:serve:unregister.
$ErrorActionPreference = 'Stop'
$taskName = 'Celebra-me servidor del tablero'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$node = (Get-Command node -ErrorAction Stop).Source
# fnm puts node behind a per-shell junction that it deletes later; the task needs the real install.
# After installing another Node version, register the task again.
$nodeDir = Get-Item (Split-Path $node)
if ($nodeDir.LinkType) { $node = Join-Path @($nodeDir.Target)[0] (Split-Path $node -Leaf) }
$board = Join-Path $root 'scripts\board\board.mjs'

# conhost --headless runs the server without a console window.
$action = New-ScheduledTaskAction -Execute 'conhost.exe' `
	-Argument "--headless `"$node`" `"$board`" view" -WorkingDirectory $root
$atLogon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$retry = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
	-StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($atLogon, $retry) `
	-Settings $settings -Principal $principal `
	-Description 'Tablero en vivo en http://127.0.0.1:4320/ (pnpm board:serve).' -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Output "Tarea programada registrada: `"$taskName`", al entrar a Windows y cada 5 minutos desde $root."
