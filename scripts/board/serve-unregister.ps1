# Removes the board server task that scripts/board/serve-register.ps1 registered and stops its server.
# Stopping the task ends its conhost process but leaves the node child running, so the children of the
# task's running instances are collected first and ended after it. Only those children are stopped: a
# server started any other way, such as a manual `pnpm board:serve`, is never touched.
$ErrorActionPreference = 'Stop'
$taskName = 'Celebra-me servidor del tablero'
if (-not (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue)) {
	Write-Output "No hay tarea programada `"$taskName`"."
	return
}
$scheduler = New-Object -ComObject Schedule.Service
$scheduler.Connect()
$children = @(
	@($scheduler.GetRunningTasks(0)) | Where-Object { $_.Name -eq $taskName } | ForEach-Object {
		Get-CimInstance Win32_Process -Filter "ParentProcessId=$($_.EnginePID) AND Name='node.exe'"
	}
)
# scripts/board/tablero-core.mjs runs the core server as its own node child; stop that one too.
$children += @(
	$children | ForEach-Object {
		Get-CimInstance Win32_Process -Filter "ParentProcessId=$($_.ProcessId) AND Name='node.exe'"
	}
)
Stop-ScheduledTask -TaskName $taskName
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
Write-Output "Tarea programada quitada: `"$taskName`"."
foreach ($child in $children) {
	Stop-Process -Id $child.ProcessId -Confirm:$false -ErrorAction SilentlyContinue
	Write-Output "Servidor del tablero detenido (proceso $($child.ProcessId))."
}
