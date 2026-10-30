#!/usr/bin/env node
/**
 * `pnpm board:watch` — no-AI watcher (d164). Reads the board and shows one Windows notification per agent
 * with the ready tasks it was not told about yet, e.g. «Codex tiene 1 tarea lista: T34 serenata-fotos».
 * It never writes the board and never wakes an agent. The Windows Task Scheduler runs it every 10 minutes
 * (scripts/board/watch-register.ps1).
 *
 *   node scripts/board/watch.mjs [--dry-run]    --dry-run prints the notifications and keeps no memory
 *
 * Tasks already announced are remembered in .agent/tmp/board-watch.json next to the board store
 * (CELEBRA_BOARD_WATCH_STATE overrides it). A task that stops being ready is forgotten, so it is announced
 * again when it becomes ready later. Gemini relay outages share this state file and are announced once
 * when unread messages need the relay, until a fresh heartbeat is observed.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AGENT_REGISTRY, agentPaused, claimable, queue, taskLabel as label } from './model.mjs';
import { boardDir, loadBoard } from './store.mjs';
import { geminiRelayAlert, geminiRelayStale } from './next.mjs';

export const TITLE = 'Tablero Celebra-me';

/** Ready tasks per agent, in queue order: the same eligibility as `pnpm board next`. T382: none while paused. */
export function readyByAgent(board, now = Date.now()) {
	const order = queue(board, now);
	return Object.fromEntries(
		Object.keys(AGENT_REGISTRY).map((agente) => [
			agente,
			agentPaused(agente, board, now)
				? []
				: order.filter(
						(t) =>
							claimable(t, agente, board, now) &&
							!t.candado &&
							t.actor !== 'coordinador',
					),
		]),
	);
}

/** «Codex tiene 1 tarea lista: T34 serenata-fotos» or «… tiene 2 tareas listas: T34 a, T35 b». */
export function message(agente, tasks) {
	const nombre = AGENT_REGISTRY[agente]?.nombre ?? agente;
	const n = tasks.length;
	const what = n === 1 ? '1 tarea lista' : `${n} tareas listas`;
	return `${nombre} tiene ${what}: ${tasks.map(label).join(', ')}`;
}

/**
 * Compare the ready tasks with the ones already announced (`seen`: agent → task ids). Returns the
 * notifications for the new ones and the memory to keep: only tasks still ready.
 */
export function diff(ready, seen = {}) {
	const notices = [];
	const next = {};
	for (const [agente, tasks] of Object.entries(ready)) {
		const known = new Set(seen[agente] ?? []);
		const fresh = tasks.filter((t) => !known.has(t.id));
		if (fresh.length) notices.push({ agente, text: message(agente, fresh) });
		next[agente] = tasks.map((t) => t.id);
	}
	return { notices, seen: next };
}

export function statePath(dir) {
	return process.env.CELEBRA_BOARD_WATCH_STATE
		? resolve(process.env.CELEBRA_BOARD_WATCH_STATE)
		: join(dirname(dir), 'board-watch.json');
}

function readState(file) {
	if (!existsSync(file)) return {};
	try {
		return JSON.parse(readFileSync(file, 'utf8')) ?? {};
	} catch {
		return {};
	}
}

function writeSeen(file, seen, geminiRelayNotified) {
	mkdirSync(dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	writeFileSync(
		tmp,
		`${JSON.stringify({ actualizado: new Date().toISOString(), seen, geminiRelayNotified }, null, '\t')}\n`,
	);
	renameSync(tmp, file);
}

/**
 * A Windows toast through Windows PowerShell 5.1 (its WinRT projection; pwsh 7 has none). The text goes in
 * environment variables, so nothing from the board is ever parsed as a command.
 */
const TOAST_PS = `
$ErrorActionPreference = 'Stop'
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom, ContentType = WindowsRuntime] | Out-Null
$t = [Security.SecurityElement]::Escape($env:BOARD_WATCH_TITLE)
$b = [Security.SecurityElement]::Escape($env:BOARD_WATCH_BODY)
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml("<toast><visual><binding template='ToastGeneric'><text>$t</text><text>$b</text></binding></visual></toast>")
$app = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($app).Show([Windows.UI.Notifications.ToastNotification]::new($xml))
`;

export function notify(text) {
	execFileSync(
		'powershell.exe',
		['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', TOAST_PS],
		{
			env: { ...process.env, BOARD_WATCH_TITLE: TITLE, BOARD_WATCH_BODY: text },
			stdio: ['ignore', 'ignore', 'pipe'],
			windowsHide: true,
		},
	);
}

export function run({ dryRun = false, out = console.log, show = notify, now = Date.now() } = {}) {
	const dir = boardDir();
	const file = statePath(dir);
	const board = loadBoard(dir);
	const state = readState(file);
	const { notices, seen } = diff(readyByAgent(board, now), state.seen);
	const stale = geminiRelayStale(board, now);
	const alert = geminiRelayAlert(board, now);
	const geminiRelayNotified = stale && (state.geminiRelayNotified === true || Boolean(alert));
	if (alert && state.geminiRelayNotified !== true) notices.push({ agente: 'dueno', text: alert });
	for (const n of notices) {
		out(dryRun ? `[prueba] ${n.text}` : n.text);
		if (!dryRun) show(n.text);
	}
	if (!notices.length) out('Sin tareas nuevas listas.');
	if (!dryRun) writeSeen(file, seen, geminiRelayNotified);
	return notices;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		run({ dryRun: process.argv.includes('--dry-run') });
	} catch (e) {
		console.error(`board:watch: ${e.message}`);
		process.exitCode = 1;
	}
}
