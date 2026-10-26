/**
 * `pnpm board` commands over the board's other collections: decisions (`decide`), lane records (`carril`), the
 * Production strip (`estado`) and agent capabilities (`agentes`). board.mjs passes the helpers it owns.
 */
import { UsageError, say } from './cli.mjs';
import { readLive } from './live.mjs';
import { AGENT_REGISTRY } from './model.mjs';
import { liveLanes, unreadFor } from './next.mjs';
import { appendLog, loadBoard, readCollection, readDoc, withLock, writeDoc } from './store.mjs';

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const need = (v, msg) => {
	if (!v || v === true) throw new UsageError(msg);
	return v;
};

/** «(reemplaza d123)», «reemplaza a d123 y d124»: the decisions a decision's text says it replaces. */
const REPLACES = /\breemplaza\b([^)\n]*)/gi;
export function citedReplacements(text) {
	const ids = new Set();
	for (const [, rest] of String(text ?? '').matchAll(REPLACES))
		for (const [id] of rest.matchAll(/\bd\d{3,4}\b/g)) ids.add(id);
	return [...ids];
}

/**
 * T172: the decision `decide` replaces. `reemplaza=dNNN` wins when the text cites it too; a text that cites one
 * replaced decision without the field links it; any other mismatch is refused, so no decision stays «vigente» by
 * accident.
 */
export function replacedDecision(pairs) {
	const cited = citedReplacements(pairs.decision);
	const given = typeof pairs.reemplaza === 'string' && pairs.reemplaza ? pairs.reemplaza : '';
	if (given) {
		if (cited.length && !cited.includes(given))
			throw new UsageError(
				`decision cita reemplaza ${cited.join(', ')} pero reemplaza=${given}`,
			);
		return given;
	}
	if (cited.length > 1)
		throw new UsageError(
			`decision cita reemplaza ${cited.join(', ')}: indique cuál con reemplaza=dNNN`,
		);
	return cited[0] ?? '';
}

export function inventoryCommands({ applyPairs, checkRev }) {
	return {
		decide({ pairs, flags, pos = [] }, dir, out) {
			need(pairs.decision, 'falta decision=…');
			if (pos.length || (!pairs.tareas && flags['sin-tarea'] !== true))
				throw new UsageError(
					'decide exige tareas=<slug> o --sin-tarea; un id suelto no liga la tarea',
				);
			if (pairs.tareas && flags['sin-tarea'])
				throw new UsageError('use tareas=<slug> o --sin-tarea, no ambos');
			const reemplaza = replacedDecision(pairs);
			return withLock(dir, () => {
				const board = loadBoard(dir);
				const tareas = pairs.tareas ? pairs.tareas.split(',').map((s) => s.trim()) : [];
				if (tareas.some((id) => !board.tareas.some((t) => t.id === id)))
					throw new UsageError('tareas debe contener slugs de tareas existentes');
				const questions = unreadFor('dueno', { ...board, bandejas: [] }).filter((r) =>
					tareas.includes(r.tarea),
				);
				if (questions.length > 1 && !flags.mensaje)
					throw new UsageError(
						'hay varias preguntas: indique --mensaje=<id> para responder exactamente una',
					);
				const selected = flags.mensaje
					? questions.filter((r) => r.mensaje.id === flags.mensaje)
					: questions;
				if (flags.mensaje && selected.length !== 1)
					throw new UsageError('--mensaje no es una pregunta abierta de estas tareas');
				const all = readCollection(dir, 'decisiones');
				const n =
					Math.max(0, ...all.map((d) => Number(String(d.id).replace(/^d/, '')) || 0)) + 1;
				const id = `d${String(n).padStart(3, '0')}`;
				if (reemplaza) {
					const old = readDoc(dir, 'decisiones', reemplaza);
					if (!old) throw new UsageError(`no existe ${reemplaza}`);
					writeDoc(dir, 'decisiones', old.id, { ...old, vigente: false });
				}
				const d = {
					...pairs,
					...(reemplaza ? { reemplaza } : {}),
					tareas,
					id,
					en: nowIso(),
					vigente: true,
					quien: pairs.quien ?? 'dueño',
					respuestas: selected.map((r) => ({
						tarea: r.tarea,
						mensaje: r.mensaje.id,
						pregunta: r.mensaje.texto,
						opcion: pairs.decision,
						rev: board.tareas.find((t) => t.id === r.tarea).rev,
					})),
				};
				writeDoc(dir, 'decisiones', id, d);
				for (const r of selected)
					appendLog(dir, {
						tarea: r.tarea,
						en: d.en,
						quien: d.quien,
						atendido: { para: 'dueno', mensajes: [r.mensaje.id], nota: id },
					});
				const linked = reemplaza && !pairs.reemplaza ? ` (reemplaza ${reemplaza})` : '';
				say(flags, out, d, `${id} registrada${linked}`);
			});
		},
		/** Lanes are code-owned metadata plus live Git/task state; static record writes are retired. */
		async carril({ pos, pairs, flags }, dir, out) {
			if (pos.length || Object.keys(pairs).length)
				throw new UsageError(
					'el catálogo de carriles vive en WORKTREE_LANES; cámbielo mediante un PR',
				);
			const board = loadBoard(dir);
			const rows = liveLanes(board, (await readLive(dir)).carriles);
			return say(flags, out, rows, rows.map((l) => l.texto).join('\n'));
		},
		estado({ pairs, flags }, dir, out) {
			if (!Object.keys(pairs).length)
				return say(
					flags,
					out,
					readDoc(dir, 'estado', 'actual'),
					JSON.stringify(readDoc(dir, 'estado', 'actual'), null, 2),
				);
			return withLock(dir, () => {
				const before = readDoc(dir, 'estado', 'actual') ?? { id: 'actual' };
				checkRev(before, flags);
				const e = {
					...applyPairs(before, pairs),
					rev: (before.rev ?? 0) + 1,
					revEn: nowIso(),
				};
				writeDoc(dir, 'estado', 'actual', e);
				say(flags, out, { ...e, id: 'actual' }, `estado rev ${e.rev}`);
			});
		},
		agentes({ pos, flags, pairs }, dir, out) {
			if (!pos.length) {
				const records = Object.entries(AGENT_REGISTRY).map(([id, a]) => ({
					id,
					...a,
					...readDoc(dir, 'agentes', id),
				}));
				return say(flags, out, records, JSON.stringify(records, null, 2));
			}
			if (!flags.coordinador) throw new UsageError('capacidades requieren --coordinador');
			const id = pos[0];
			if (!Object.hasOwn(AGENT_REGISTRY, id)) throw new UsageError('agente desconocido');
			return withLock(dir, () => {
				const before = readDoc(dir, 'agentes', id);
				checkRev(before, flags);
				if (Object.keys(pairs).some((k) => k !== 'capacidades'))
					throw new UsageError('solo se actualiza capacidades');
				const after = applyPairs({ id, ...before }, pairs);
				if (
					!Array.isArray(after.capacidades) ||
					after.capacidades.some((c) => typeof c !== 'string')
				)
					throw new UsageError('capacidades debe ser lista de texto');
				after.rev = (before?.rev ?? 0) + 1;
				writeDoc(dir, 'agentes', id, after);
				say(flags, out, after, `${id} rev ${after.rev}`);
			});
		},
	};
}
