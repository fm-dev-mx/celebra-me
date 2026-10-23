# Removes the board watcher task that scripts/board/watch-register.ps1 registered.
$ErrorActionPreference = 'Stop'
$taskName = 'Celebra-me vigilante del tablero'
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
	Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
	Write-Output "Tarea programada quitada: `"$taskName`"."
} else {
	Write-Output "No hay tarea programada `"$taskName`"."
}
