/**
 * `pnpm board` commands that keep the store light (d185–d187): they remove or move board data, so each one
 * lists what it would do first and changes nothing until asked.
 */
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { UsageError, say } from './cli.mjs';
import { taskLabel } from './model.mjs';
import {
	assertId,
	MONTHLY_DIR,
	monthlyZip,
	pruneBackups,
	readCollection,
	withLock,
	writeDoc,
} from './store.mjs';
import { addToZip, readZip } from './zip.mjs';

export const maintenanceCommands = {
	/** d185: backup copies over the newest 2 per document, or of finished tasks; only --aplicar removes them. */
	'prune-backups'({ flags }, dir, out) {
		return withLock(dir, () => {
			const r = pruneBackups(dir, { aplicar: flags.aplicar === true && !flags['dry-run'] });
			const kb = (r.bytes / 1024).toFixed(0);
			const head = `${r.aplicado ? 'Quitados' : 'Sobran'} ${r.sobran.length} respaldos (${kb} KB).`;
			const tail = r.aplicado || !r.sobran.length ? [] : ['Para quitarlos: --aplicar'];
			const text = [head, ...r.sobran.map((x) => `  ${x.archivo}`), ...tail].join('\n');
			say(flags, out, r, text);
		});
	},
};

const DAY_MS = 86_400_000;
const nowIso = (now) => new Date(now).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** `7d` → milliseconds; anything else is refused. */
export function parseAge(value = '7d') {
	const m = /^([1-9]\d*)d$/.exec(String(value));
	if (!m) throw new UsageError(`--antes debe ser <n>d, por ejemplo 7d (recibí ${value})`);
	return Number(m[1]) * DAY_MS;
}

/** The one line a compacted task leaves in resumen-<YYYY-MM>.md: `T31 tablero-arreglos-cli · unida · PR #492 · 2026-10-24`. */
export const summaryLine = (t) =>
	[
		taskLabel(t),
		t.estado,
		...(t.pr ? [`PR ${t.pr}`] : []),
		String(t.archivada).slice(0, 10),
	].join(' · ');

/** What stays on the board for a compacted task: enough for numbers, requisitos and review rounds. */
function archiveRecord(t, en) {
	// d174: a compacted subtask still counts toward its mother's progress.
	const keep = [
		'num',
		'titulo',
		'estado',
		'pr',
		'rama',
		'origen',
		'revisionSha',
		'archivada',
		'padre',
		'grupo',
		'fase',
		'orden',
		'agente',
	];
	const r = Object.fromEntries(keep.filter((k) => t[k] !== undefined).map((k) => [k, t[k]]));
	return { ...r, compactada: en, zip: `${MONTHLY_DIR}/${String(t.archivada).slice(0, 7)}.zip` };
}

/**
 * d187: every task archived at least `antesMs` ago goes whole to its archive month's .zip (`tareas/<id>.json`),
 * leaves one line in resumen-<YYYY-MM>.md and a small `archivo` record; its tareas/ file goes only after the
 * .zip holds an identical copy. `dryRun` lists and writes nothing.
 */
export function compactArchived(dir, { antesMs, now = Date.now(), dryRun = false }) {
	const due = readCollection(dir, 'tareas')
		.filter((t) => t.archivada && now - Date.parse(t.archivada) >= antesMs)
		.sort((a, b) => (a.num ?? 0) - (b.num ?? 0));
	const tareas = due.map((t) => ({
		id: t.id,
		mes: String(t.archivada).slice(0, 7),
		linea: summaryLine(t),
	}));
	if (dryRun || !due.length) return { tareas, escrito: false };
	const en = nowIso(now);
	for (const mes of [...new Set(tareas.map((x) => x.mes))]) {
		const list = due.filter((t) => String(t.archivada).startsWith(mes));
		const zip = monthlyZip(dir, mes);
		const docs = list.map((t) => ({
			name: `tareas/${t.id}.json`,
			data: readTaskFile(dir, t.id),
		}));
		addToZip(zip, docs);
		const stored = new Map(readZip(zip).map((e) => [e.name, e.data.toString('utf8')]));
		const lost = docs.filter((d) => stored.get(d.name) !== d.data).map((d) => d.name);
		if (lost.length)
			throw new Error(`el .zip ${mes} no guardó ${lost.join(', ')}: nada se quitó`);
		writeSummary(join(dir, MONTHLY_DIR, `resumen-${mes}.md`), mes, list);
		for (const t of list) {
			writeDoc(dir, 'archivo', t.id, archiveRecord(t, en));
			rmSync(join(dir, 'tareas', `${t.id}.json`));
		}
	}
	return { tareas, escrito: true };
}

/** One line per task: a task compacted again (after restore, or on a retry) replaces its own line. */
function writeSummary(file, mes, list) {
	const text = existsSync(file) ? readFileSync(file, 'utf8') : `# Tareas resumidas · ${mes}\n\n`;
	const own = list.map((t) => `- ${taskLabel(t)} · `);
	const kept = text.split('\n').filter((l) => !own.some((p) => l.startsWith(p)));
	const body = kept.join('\n');
	writeFileSync(
		file,
		(body.endsWith('\n') ? body : `${body}\n`) +
			list.map((t) => `- ${summaryLine(t)}\n`).join(''),
	);
}

const readTaskFile = (dir, id) => readFileSync(join(dir, 'tareas', `${assertId(id)}.json`), 'utf8');

/** Put a compacted task back in tareas/ exactly as the newest .zip that holds it kept it; `dryRun` only finds it. */
export function restoreTask(dir, id, { dryRun = false } = {}) {
	const name = `tareas/${assertId(id)}.json`;
	if (existsSync(join(dir, name))) throw new UsageError(`${id} ya está en el tablero`);
	const months = existsSync(join(dir, MONTHLY_DIR))
		? readdirSync(join(dir, MONTHLY_DIR)).filter((f) => /^\d{4}-\d{2}\.zip$/.test(f))
		: [];
	for (const f of months.sort().reverse()) {
		const entry = readZip(join(dir, MONTHLY_DIR, f)).find((e) => e.name === name);
		if (!entry) continue;
		if (!dryRun) {
			writeDoc(dir, 'tareas', id, JSON.parse(entry.data.toString('utf8')), { backup: false });
			rmSync(join(dir, 'archivo', `${id}.json`), { force: true });
		}
		return { id, zip: `${MONTHLY_DIR}/${f}`, escrito: !dryRun };
	}
	throw new UsageError(`${id} no está en ningún .zip de ${MONTHLY_DIR}/`);
}

Object.assign(maintenanceCommands, {
	/** d187: pnpm board compact --antes=7d [--dry-run]. */
	compact({ flags }, dir, out) {
		const antesMs = parseAge(typeof flags.antes === 'string' ? flags.antes : undefined);
		return withLock(dir, () => {
			const r = compactArchived(dir, { antesMs, dryRun: Boolean(flags['dry-run']) });
			const head = r.tareas.length
				? `${r.escrito ? 'Resumidas' : 'Se resumirían'} ${r.tareas.length} tareas archivadas:`
				: 'Ninguna tarea archivada para resumir.';
			say(flags, out, r, [head, ...r.tareas.map((x) => `  ${x.linea}`)].join('\n'));
		});
	},
	/** pnpm board restore <id> [--dry-run]: a compacted task back from its .zip. */
	restore({ pos, flags }, dir, out) {
		if (!pos[0]) throw new UsageError('falta <id>');
		return withLock(dir, () => {
			const r = restoreTask(dir, pos[0], { dryRun: Boolean(flags['dry-run']) });
			say(
				flags,
				out,
				r,
				`${r.id} ${r.escrito ? 'restaurada' : 'se restauraría'} desde ${r.zip}`,
			);
		});
	},
});
