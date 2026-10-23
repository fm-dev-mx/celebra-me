#!/usr/bin/env node
/**
 * `pnpm board` — the only way agents read and write the board (rules: .agent/rules/board.md, d143/d144).
 *
 *   list [--agente=<a>|--tab=libres] [--json]   numbered queue with its color
 *   next --agente=<a> [--json]                  first ready, unlocked task that agent finishes alone
 *   show <id> [--json]
 *   add <id> titulo=… urgencia=… actor=… [campo=valor…]
 *   set <id> --rev=<n> campo=valor… [--data=<file.json>] [--quien=<a>] [--corrio=…] [--salio=…]
 *   claim <id> --agente=<a> [--sesion=<id>]     lock: one owner at a time
 *   release <id> --agente=<a>
 *   move <id> --agente=<b> [--quien=<a>]        hand over (only without a lock), with a bitácora row
 *   review <id> --agente=<b>                    child task <id>-revision for a cross review
 *   decide decision=… motivo=… [tareas=a,b] [reemplaza=dNNN] [quien=…]
 *   carril <id> --rev=<n> campo=valor…          lane row (no rev field yet: --rev=0)
 *   estado --rev=<n> campo=valor…               Production strip (estado/actual)
 *   history [--q=<texto>] [--json]
 *   import <export dir> [--mapa=<file.json>] [--force]   one-time migration from the ArtifactData export
 *   view [--port=4390]                          local read-only page at http://127.0.0.1:<port>/
 *
 * Values are JSON when they look like JSON (numbers, true/false/null, [..], {..}); `campo=` removes the field.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	canFinish,
	color,
	nextFor,
	queue,
	requisitos,
	stage,
	taskIssues,
	inTab,
} from './model.mjs';
import {
	assertId,
	boardDir,
	loadBoard,
	readCollection,
	readDoc,
	withLock,
	writeDoc,
} from './store.mjs';

const COLOR_LABEL = {
	own: 'USTED',
	auto: 'AUTÓNOMA',
	block: 'BLOQUEADA',
	run: 'EN CURSO',
	rev: 'EN REVISIÓN',
	done: 'HECHA',
};
const LOOKS_JSON = /^(\[|\{|true$|false$|null$|-?\d+(\.\d+)?$)/;

class UsageError extends Error {}

export function parseArgs(argv) {
	const flags = {};
	const pairs = {};
	const pos = [];
	for (const a of argv) {
		if (a.startsWith('--')) {
			const [k, ...v] = a.slice(2).split('=');
			flags[k] = v.length ? v.join('=') : true;
		} else if (/^[A-Za-z_][\w]*=/.test(a)) {
			const i = a.indexOf('=');
			pairs[a.slice(0, i)] = a.slice(i + 1);
		} else pos.push(a);
	}
	return { flags, pairs, pos };
}

export function parseValue(v) {
	if (v === '') return undefined;
	if (LOOKS_JSON.test(v)) {
		try {
			return JSON.parse(v);
		} catch {
			throw new UsageError(`valor JSON no válido: ${v}`);
		}
	}
	return v;
}

function applyPairs(doc, pairs) {
	const out = { ...doc };
	for (const [k, v] of Object.entries(pairs)) {
		if (k === 'id' || k === 'rev' || k === 'actualizado')
			throw new UsageError(`${k} lo pone el comando`);
		const value = parseValue(v);
		if (value === undefined) delete out[k];
		else out[k] = value;
	}
	return out;
}

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const need = (v, msg) => {
	if (!v || v === true) throw new UsageError(msg);
	return v;
};

function logRow(dir, { tarea, de, a, quien, corrio, salio }) {
	const en = nowIso();
	const base = `${en.replace(/[-:]/g, '')}-${tarea}`;
	let id = base;
	for (let i = 2; readDoc(dir, 'bitacora', id); i++) id = `${base}-${i}`;
	writeDoc(dir, 'bitacora', id, {
		tarea,
		de: de ?? '',
		a: a ?? '',
		en,
		quien: quien ?? '',
		corrio: corrio ?? '',
		salio: salio ?? '',
	});
}

/** Save a task when it gains no shape problem; bump rev and log an estado change. */
function saveTask(dir, before, after, { quien, corrio, salio } = {}) {
	const t = { ...after, rev: (before?.rev ?? 0) + 1, actualizado: nowIso() };
	const old = before ? new Set(taskIssues(before)) : new Set();
	const added = taskIssues(t).filter((m) => !old.has(m));
	if (added.length) throw new UsageError(`no se escribió ${t.id}: ${added.join('; ')}`);
	writeDoc(dir, 'tareas', t.id, t);
	if ((before?.estado ?? null) !== t.estado)
		logRow(dir, { tarea: t.id, de: before?.estado, a: t.estado, quien, corrio, salio });
	return t;
}

function getTask(dir, id) {
	const t = readDoc(dir, 'tareas', assertId(id));
	if (!t) throw new UsageError(`no existe la tarea ${id}`);
	return t;
}

function checkRev(doc, flags) {
	const want = Number(need(flags.rev, 'falta --rev=<n> (la versión que leyó)'));
	const have = doc?.rev ?? 0;
	if (have !== want)
		throw new UsageError(
			`${doc?.id ?? 'documento'} cambió: está en rev ${have}, usted leyó ${want}. Vuelva a leerla.`,
		);
}

function row(t, n, board, agente) {
	const c = color(t, board, { agente });
	const lock = t.candado ? ` [${t.candado.agente}]` : '';
	const first = requisitos(t, board).find((r) => !r.ok);
	const why =
		stage(t, board) === 'bloqueada' && first ? `espera ${first.tipo} ${first.ref}`.trim() : '';
	return `${String(n).padStart(2)}. ${COLOR_LABEL[c].padEnd(11)} ${String(t.urgencia ?? '').padEnd(8)} ${t.id}${lock}${why ? `  — ${why}` : ''}`;
}

const commands = {
	list({ flags }, dir, out) {
		const board = loadBoard(dir);
		const tab = flags.agente ?? flags.tab;
		const q = queue(board).filter((t) => inTab(t, tab));
		if (flags.json)
			return out(
				JSON.stringify(
					q.map((t, i) => ({
						n: i + 1,
						id: t.id,
						titulo: t.titulo,
						color: color(t, board, { agente: flags.agente }),
						stage: stage(t, board),
					})),
					null,
					2,
				),
			);
		if (!q.length) return out('Sin tareas abiertas.');
		q.forEach((t, i) => out(row(t, i + 1, board, flags.agente)));
		const mine = q.filter((t) => color(t, board) === 'own').length;
		out(`\nUsted: ${mine ? `${mine} ${mine > 1 ? 'cosas' : 'cosa'}` : 'nada'}`);
	},
	next({ flags }, dir, out) {
		const agente = need(flags.agente, 'falta --agente=claude|codex|gemini');
		const t = nextFor(agente, loadBoard(dir));
		if (flags.json) return out(JSON.stringify(t, null, 2));
		if (!t) return out(`Nada listo para ${agente}.`);
		out(`${t.id} (rev ${t.rev}) — ${t.titulo}\n\n${t.prompt ?? ''}`);
	},
	show({ pos, flags }, dir, out) {
		const t = getTask(dir, need(pos[0], 'falta <id>'));
		const board = loadBoard(dir);
		if (flags.json)
			return out(
				JSON.stringify(
					{
						...t,
						color: color(t, board),
						stage: stage(t, board),
						requisitos: requisitos(t, board),
					},
					null,
					2,
				),
			);
		out(
			`${t.id} · rev ${t.rev} · ${COLOR_LABEL[color(t, board)]} · ${t.estado ?? 'pendiente'}\n${t.titulo}`,
		);
		for (const r of requisitos(t, board)) out(`  ${r.ok ? '✓' : '○'} ${r.tipo} ${r.ref}`);
		for (const k of [
			'urgencia',
			'actor',
			'agente',
			'toca',
			'requiere',
			'candado',
			'carril',
			'rama',
			'pr',
			'sesion',
			'ahora',
		])
			if (t[k] !== undefined)
				out(`  ${k}: ${typeof t[k] === 'string' ? t[k] : JSON.stringify(t[k])}`);
		if (t.prompt) out(`\n${t.prompt}`);
	},
	add({ pos, pairs, flags }, dir, out) {
		const id = assertId(need(pos[0], 'falta <id>'));
		return withLock(dir, () => {
			if (readDoc(dir, 'tareas', id)) throw new UsageError(`ya existe la tarea ${id}`);
			const t = applyPairs({ id, estado: 'pendiente', requisitos: [] }, pairs);
			out(`${saveTask(dir, null, t, { quien: flags.quien }).id} creada (rev 1)`);
		});
	},
	set({ pos, pairs, flags }, dir, out) {
		const id = need(pos[0], 'falta <id>');
		return withLock(dir, () => {
			const before = getTask(dir, id);
			checkRev(before, flags);
			const data = flags.data ? JSON.parse(readFileSync(resolve(flags.data), 'utf8')) : {};
			const merged = applyPairs({ ...before, ...data, id }, pairs);
			const t = saveTask(dir, before, merged, flags);
			out(`${t.id} rev ${t.rev}`);
		});
	},
	claim({ pos, flags }, dir, out) {
		const agente = need(flags.agente, 'falta --agente');
		return withLock(dir, () => {
			const before = getTask(dir, need(pos[0], 'falta <id>'));
			if (before.candado && before.candado.agente !== agente)
				throw new UsageError(
					`${before.id} ya la tiene ${before.candado.agente} desde ${before.candado.desde}`,
				);
			if (before.agente && before.agente !== 'cualquiera' && before.agente !== agente)
				throw new UsageError(
					`${before.id} es de ${before.agente}: pídale al coordinador un «move»`,
				);
			if (!canFinish(before, agente, loadBoard(dir)))
				throw new UsageError(
					`${agente} no tiene todo lo que pide requiere: ${(before.requiere ?? []).join(', ')}`,
				);
			const candado = {
				agente,
				desde: nowIso(),
				...(flags.sesion ? { sesion: flags.sesion } : {}),
			};
			const t = saveTask(dir, before, { ...before, candado });
			out(`${t.id} es de ${agente} (rev ${t.rev})`);
		});
	},
	release({ pos, flags }, dir, out) {
		const agente = need(flags.agente, 'falta --agente');
		return withLock(dir, () => {
			const before = getTask(dir, need(pos[0], 'falta <id>'));
			if (!before.candado) return out(`${before.id} no tiene candado`);
			if (before.candado.agente !== agente)
				throw new UsageError(`el candado es de ${before.candado.agente}`);
			const rest = { ...before };
			delete rest.candado;
			const t = saveTask(dir, before, rest);
			out(`${t.id} libre (rev ${t.rev})`);
		});
	},
	move({ pos, flags }, dir, out) {
		const agente = need(flags.agente, 'falta --agente=<destino>');
		return withLock(dir, () => {
			const before = getTask(dir, need(pos[0], 'falta <id>'));
			if (before.candado)
				throw new UsageError(
					`${before.id} tiene candado de ${before.candado.agente}: primero «release»`,
				);
			const t = saveTask(dir, before, { ...before, agente });
			logRow(dir, {
				tarea: t.id,
				de: before.agente ?? 'cualquiera',
				a: agente,
				quien: flags.quien,
				corrio: 'pnpm board move',
			});
			out(`${t.id} pasa a ${agente} (rev ${t.rev})`);
		});
	},
	review({ pos, flags }, dir, out) {
		const agente = need(flags.agente, 'falta --agente=<revisor>');
		return withLock(dir, () => {
			const src = getTask(dir, need(pos[0], 'falta <id>'));
			const id = `${src.id}-revision`;
			if (readDoc(dir, 'tareas', id)) throw new UsageError(`ya existe ${id}`);
			const t = {
				id,
				titulo: `Revisión cruzada: ${src.titulo}`,
				estado: 'pendiente',
				urgencia: src.urgencia,
				actor: 'sesion',
				agente,
				origen: src.id,
				carril: src.carril,
				requisitos: [{ tipo: 'tarea', ref: src.id }],
				...(src.rama ? { rama: src.rama } : {}),
				...(src.pr ? { pr: src.pr } : {}),
			};
			out(`${saveTask(dir, null, t, { quien: flags.quien }).id} creada para ${agente}`);
		});
	},
	decide({ pairs }, dir, out) {
		need(pairs.decision, 'falta decision=…');
		return withLock(dir, () => {
			const all = readCollection(dir, 'decisiones');
			const n =
				Math.max(0, ...all.map((d) => Number(String(d.id).replace(/^d/, '')) || 0)) + 1;
			const id = `d${String(n).padStart(3, '0')}`;
			if (pairs.reemplaza) {
				const old = readDoc(dir, 'decisiones', pairs.reemplaza);
				if (!old) throw new UsageError(`no existe ${pairs.reemplaza}`);
				writeDoc(dir, 'decisiones', old.id, { ...old, vigente: false });
			}
			const tareas = pairs.tareas ? pairs.tareas.split(',').filter(Boolean) : [];
			writeDoc(dir, 'decisiones', id, {
				...pairs,
				tareas,
				id,
				en: nowIso(),
				vigente: true,
				quien: pairs.quien ?? 'dueño',
			});
			out(`${id} registrada`);
		});
	},
	carril({ pos, pairs, flags }, dir, out) {
		const id = assertId(need(pos[0], 'falta <id>'));
		return withLock(dir, () => {
			const before = readDoc(dir, 'carriles', id) ?? { id };
			checkRev(before, flags);
			const l = {
				...applyPairs(before, pairs),
				rev: (before.rev ?? 0) + 1,
				comprobadoEn: nowIso(),
			};
			writeDoc(dir, 'carriles', id, l);
			out(`${id} rev ${l.rev}`);
		});
	},
	estado({ pairs, flags }, dir, out) {
		return withLock(dir, () => {
			const before = readDoc(dir, 'estado', 'actual') ?? { id: 'actual' };
			checkRev(before, flags);
			const e = { ...applyPairs(before, pairs), rev: (before.rev ?? 0) + 1, revEn: nowIso() };
			writeDoc(dir, 'estado', 'actual', e);
			out(`estado rev ${e.rev}`);
		});
	},
	history({ flags }, dir, out) {
		const board = loadBoard(dir);
		const q = typeof flags.q === 'string' ? flags.q.toLowerCase() : '';
		const rows = [
			...board.decisiones.map((d) => ({
				en: d.en,
				txt: `${d.id}${d.vigente === false ? ' (reemplazada)' : ''} ${d.decision ?? ''}`,
			})),
			...board.bitacora.map((b) => ({
				en: b.en,
				txt: `${b.tarea} ${b.de ?? ''} → ${b.a ?? ''} ${b.corrio ?? ''}`,
			})),
		]
			.filter((r) => !q || r.txt.toLowerCase().includes(q))
			.sort((a, b) => Date.parse(b.en) - Date.parse(a.en));
		if (flags.json) return out(JSON.stringify(rows, null, 2));
		for (const r of rows.slice(0, 50)) out(`${r.en}  ${r.txt.slice(0, 140)}`);
	},
	async import({ pos, flags }, dir, out) {
		const { importExport } = await import('./import.mjs');
		const src = resolve(
			process.env.INIT_CWD || process.cwd(),
			need(pos[0], 'falta <export dir>'),
		);
		const mapa = flags.mapa
			? JSON.parse(
					readFileSync(
						resolve(process.env.INIT_CWD || process.cwd(), flags.mapa),
						'utf8',
					),
				)
			: {};
		return withLock(dir, () => {
			if (readCollection(dir, 'tareas').length && !flags.force)
				throw new UsageError(
					'el tablero local ya tiene tareas: use --force para reemplazarlas',
				);
			const r = importExport(src, dir, mapa);
			out(
				`importadas: ${Object.entries(r)
					.map(([k, v]) => `${v} ${k}`)
					.join(', ')}`,
			);
		});
	},
	async view({ flags }, dir, out) {
		const { serveView } = await import('./view-server.mjs');
		const port = Number(flags.port ?? 4390);
		await serveView(dir, port);
		out(`Tablero en http://127.0.0.1:${port}/  (Ctrl+C para cerrar)`);
	},
};

export async function run(argv, { dir = boardDir(), out = console.log } = {}) {
	const [cmd, ...rest] = argv;
	const fn = commands[cmd];
	if (!fn)
		throw new UsageError(
			`comando desconocido: ${cmd ?? '(ninguno)'}. Use: ${Object.keys(commands).join(', ')}`,
		);
	return fn(parseArgs(rest), dir, out);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	run(process.argv.slice(2)).catch((e) => {
		console.error(e instanceof UsageError ? e.message : e);
		process.exitCode = e instanceof UsageError ? 2 : 1;
	});
}
