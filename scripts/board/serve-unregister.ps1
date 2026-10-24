# Removes the board server task that scripts/board/serve-register.ps1 registered and stops its server.
# Stopping the task leaves its node child running, so that child is ended by its command line, which
# holds the absolute path to board.mjs (unquoted); a manual `pnpm board:serve` runs a relative path and is kept.
$ErrorActionPreference = 'Stop'
$taskName = 'Celebra-me servidor del tablero'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$board = Join-Path $root 'scripts\board\board.mjs'
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
	Stop-ScheduledTask -TaskName $taskName
	Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
	Write-Output "Tarea programada quitada: `"$taskName`"."
} else {
	Write-Output "No hay tarea programada `"$taskName`"."
}
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
	Where-Object { $_.CommandLine -like "*$board view*" } |
	ForEach-Object {
		Stop-Process -Id $_.ProcessId -Confirm:$false
		Write-Output "Servidor del tablero detenido (proceso $($_.ProcessId))."
	}
