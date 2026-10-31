/** Local identities only; never commit master chat IDs or infer them from recency. */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { INTEGRATION_SHORT, LEGACY_INTEGRATION_SHORT } from './board-constants.mjs';

const MASTER_ROLES = ['Coordinador principal', 'Codex maestro', 'Gemini maestro'];
export const MASTER_NAMES = new Set([
	...[INTEGRATION_SHORT, LEGACY_INTEGRATION_SHORT].flatMap((short) =>
		MASTER_ROLES.map((role) => `${short} · ${role}`),
	),
	'Chat Maestro MCP Configuration',
]);
export const masterConfigPath = (dir) => join(dirname(dir), 'board-masters.json');
export function readLocal(file, fallback = {}) {
	return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback;
}
export function writeLocal(file, value) {
	mkdirSync(dirname(file), { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	writeFileSync(tmp, `${JSON.stringify(value, null, '\t')}\n`);
	renameSync(tmp, file);
}
export function setMaster(dir, agent, thread, relayTask) {
	if (!['claude', 'codex', 'gemini'].includes(agent) || !/^[\w-]{1,200}$/.test(thread ?? ''))
		throw new Error('Use --set-master=claude|codex|gemini --thread=<id>');
	if (relayTask !== undefined && !/^[\w-]{1,200}$/.test(relayTask))
		throw new Error('--relay-task debe ser un id de tarea');
	const file = masterConfigPath(dir);
	const config = readLocal(file);
	config.masters = { ...config.masters, [agent]: thread };
	config.since = { ...config.since, [agent]: config.since?.[agent] ?? new Date().toISOString() };
	if (relayTask) config.relayTask = relayTask;
	writeLocal(file, config);
	return config;
}
export function isMaster(row, config) {
	return Object.values(config.masters ?? {}).includes(row.id) || MASTER_NAMES.has(row.titulo);
}

/** Claude exposes no host archive flag; record only an explicit post-archive confirmation. */
export function confirmClaudeArchive(dir, id) {
	if (!/^[\w-]{1,200}$/.test(id ?? '')) throw new Error('Use --confirm-claude-archive=<id>');
	const file = masterConfigPath(dir);
	const config = readLocal(file);
	if (Object.values(config.masters ?? {}).includes(id))
		throw new Error('Nunca se archiva un maestro');
	config.archivedClaude = [...new Set([...(config.archivedClaude ?? []), id])];
	writeLocal(file, config);
}
