/** Read-only view projections. Store records and command validation always use the full board. */
import { archiveBlock } from './cierre.mjs';
import { dependencyGraph } from './dependency-graph.mjs';
import { leadOf } from './format.mjs';
import { AGENT_REGISTRY, findTask, ownerWhere } from './model.mjs';
import { unreadFor } from './next.mjs';
import { promptTitle } from './owner-where.mjs';
import { missingCierreItems } from './require-cierre.mjs';

export function taskSummary(t, board) {
	const { prompt, cierre, ...rest } = t;
	return {
		...rest,
		// T391: the prompt's session title survives, so the view names the same new chat as `pnpm board list`.
		...(prompt
			? {
					prompt: true,
					donde: ownerWhere(t) ?? t.donde,
					promptTitulo: promptTitle(t) ?? undefined,
				}
			: {}),
		bloqueoArchivo: archiveBlock(t, board),
		...(cierre
			? {
					cierre: {
						resumen: leadOf(cierre.resumen, t).lead,
						en: cierre.en,
						quien: cierre.quien,
						pr: cierre.pr,
						pendientes: cierre.pendientes,
						resultado: cierre.resultado,
					},
				}
			: {}),
	};
}

export function liveBoard(board, now = Date.now()) {
	const open = board.tareas.filter((t) => !t.archivada);
	const recent = board.bitacora
		.filter((r) => Date.parse(r.en) >= now - 3 * 86_400_000)
		.sort((a, b) => Date.parse(a.en) - Date.parse(b.en));
	const retained = new Set([
		...recent.slice(-200),
		...['dueno', 'coordinador', ...Object.keys(AGENT_REGISTRY)].flatMap((a) =>
			unreadFor(a, { ...board, bitacora: recent }),
		),
		...recent.filter((r) => r.atendido),
	]);
	const bitacora = recent.filter((r) => retained.has(r));
	const archived = neededArchives(board, open, bitacora);
	return {
		...board,
		tareas: open.map((t) => taskSummary(t, board)),
		// Dependency, subtask, follow-up and review references survive without archived task documents.
		archivo: [
			...archived.map((t) => {
				const keys = [
					'id',
					'num',
					'titulo',
					'estado',
					'pr',
					'origen',
					'revisionSha',
					'padre',
					'deriva',
					'grupo',
					'fase',
					'orden',
					'agente',
					'archivada',
				];
				return {
					...Object.fromEntries(keys.map((k) => [k, t[k]])),
					...(t.cierre
						? {
								cierre: {
									resultado: t.cierre.resultado,
									pendientes: t.cierre.pendientes,
								},
							}
						: {}),
				};
			}),
		],
		bitacora,
		mapa: dependencyGraph(board, now),
		cierresPendientes: missingCierreItems(board)
			.filter(({ t }) => !t.archivada)
			.map(({ t, texto }) => ({ id: t.id, tarea: `T${t.num}`, tipo: 'cierre', texto })),
	};
}

/** Keep the reference graph used by open tasks, including archived review rounds and group progress. */
function neededArchives(board, open, log) {
	const all = [...(board.archivo ?? []), ...board.tareas];
	const selected = new Map(open.map((t) => [t.id, t]));
	const add = (ref) => {
		const t = findTask(ref, board);
		if (t) selected.set(t.id, t);
	};
	for (const row of log) if (row.mensaje) add(row.tarea);
	let size;
	do {
		size = selected.size;
		for (const t of selected.values()) {
			for (const ref of [
				t.padre,
				t.origen,
				t.deriva,
				...(t.requisitos ?? [])
					.filter((r) => ['tarea', 'revision'].includes(r.tipo))
					.map((r) => r.ref),
				...(t.cierre?.pendientes ?? []).map((p) => p.tarea),
			])
				if (ref) add(ref);
			for (const related of all)
				if (
					related.padre === t.id ||
					related.origen === t.id ||
					(t.grupo && related.grupo === t.grupo)
				)
					selected.set(related.id, related);
		}
	} while (selected.size !== size);
	const active = new Set(open.map((t) => t.id));
	return [...selected.values()].filter((t) => !active.has(t.id));
}
