/**
 * The «Mapa» of the board (T471): which open tasks wait on which, as a pure graph the view draws in columns.
 * Shared by the view payload (view-payload.mjs); no I/O.
 *
 * - Nodes are the open tasks with a relation: a tarea requisito either way, an unmet dueño/decisión requisito,
 *   or a padre/grupo group with an open subtask. Tasks they point to that are done or archived (archivo/, or
 *   only in a monthly .zip) come in gray; an unmet dueño/decisión requisito is a red root box.
 * - Edges go from the task that waits to the one it is missing (`espera`), or from a mother to its subtask
 *   (`subtarea`).
 * - `capa` is the column: 0 for what waits on nothing, then one more than the deepest thing it waits on; a
 *   cycle shares one column. A subtask sits at least one column right of its mother.
 * - `desbloquea` counts the distinct open tasks that wait on a node, directly or down a chain.
 */
import { archivedTask, isFinished, requisitos, taskTag } from './model.mjs';

const isOpen = (t) => !t.archivada && !isFinished(t);
const short = (s, n = 90) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** Strongly connected components (Tarjan) of `ids` over `next(id)`. */
function components(ids, next) {
	const index = new Map();
	const low = new Map();
	const stack = [];
	const onStack = new Set();
	const out = [];
	let i = 0;
	const visit = (v) => {
		index.set(v, i);
		low.set(v, i++);
		stack.push(v);
		onStack.add(v);
		for (const w of next(v)) {
			if (!index.has(w)) {
				visit(w);
				low.set(v, Math.min(low.get(v), low.get(w)));
			} else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
		}
		if (low.get(v) !== index.get(v)) return;
		const scc = [];
		let w;
		do {
			w = stack.pop();
			onStack.delete(w);
			scc.push(w);
		} while (w !== v);
		out.push(scc);
	};
	for (const v of ids) if (!index.has(v)) visit(v);
	return out;
}

/** A red root box for an unmet dueño/decisión requisito; one decision box is shared by every task waiting on it. */
function rootNode(r, t, board) {
	const ref = String(r.ref ?? '');
	if (r.tipo !== 'decision')
		return {
			id: `raiz:dueno:${t.id}:${ref}`,
			tipo: 'raiz',
			ref,
			texto: `Usted: ${short(ref)}`,
		};
	const dec = (board.decisiones ?? []).find((x) => x.id === ref);
	const about = dec?.decision ? `: ${short(String(dec.decision), 60)}` : '';
	return {
		id: `raiz:decision:${ref}`,
		tipo: 'raiz',
		ref,
		texto: `Usted: decidir ${ref}${about}`,
	};
}

/** Waits-on edges of one open task: to the tasks its tarea requisitos name, and to its unmet owner steps. */
function addRequisitos(g, t, board, reqs) {
	for (const r of reqs) {
		if (r.tipo === 'tarea') {
			const d = g.lookup(r.ref);
			if (!d) {
				g.avisos.push({
					tipo: 'ref',
					tarea: t.id,
					texto: `${taskTag(t)} espera «${r.ref}», que no existe en el tablero`,
				});
				continue;
			}
			g.addTask(t);
			g.addTask({ ...d, id: r.ref });
			g.edges.push({ de: t.id, a: r.ref, tipo: 'espera', ok: r.ok });
		} else if ((r.tipo === 'dueno' || r.tipo === 'decision') && !r.ok) {
			const root = rootNode(r, t, board);
			if (!g.nodes.has(root.id)) g.nodes.set(root.id, root);
			g.addTask(t);
			g.edges.push({ de: t.id, a: root.id, tipo: 'espera', ok: false });
		}
	}
}

/** d174 groups: a mother (by padre, or the task whose id is the grupo) with at least one open subtask. */
function addSubtask(g, t) {
	const ref = t.padre ?? t.grupo;
	if (!ref || ref === t.id) return;
	const mother = g.lookup(ref);
	if (!mother) {
		if (t.padre)
			g.avisos.push({
				tipo: 'ref',
				tarea: t.id,
				texto: `${taskTag(t)} tiene como madre «${ref}», que no existe en el tablero`,
			});
		return;
	}
	g.addTask({ ...mother, id: ref });
	g.addTask(t);
	g.nodes.get(t.id).madre = ref;
	g.edges.push({ de: ref, a: t.id, tipo: 'subtarea', ok: true });
}

/** Columns over the waits-on edges, a cycle condensed to one column; returns a warning per cycle. */
function layOut(nodes, edges) {
	const ids = [...nodes.keys()];
	const waits = new Map(ids.map((id) => [id, []]));
	for (const e of edges) if (e.tipo === 'espera') waits.get(e.de).push(e.a);
	const sccs = components(ids, (id) => waits.get(id));
	const sccOf = new Map();
	sccs.forEach((c, k) => {
		for (const id of c) sccOf.set(id, k);
	});
	const avisos = sccs
		.filter((c) => c.length > 1 || waits.get(c[0]).includes(c[0]))
		.map((c) => {
			const tags = c
				.map((id) => nodes.get(id))
				.sort((a, b) => (a.num ?? 0) - (b.num ?? 0))
				.map((n) => (n.num ? `T${n.num}` : n.id));
			return {
				tipo: 'ciclo',
				tareas: c,
				texto: `Ciclo: ${tags.join(' → ')} se esperan entre sí; ninguna puede empezar`,
			};
		});
	// Tarjan emits components in reverse topological order: what a component waits on comes first.
	const capaScc = sccs.map(() => 0);
	sccs.forEach((c, k) => {
		for (const id of c)
			for (const w of waits.get(id))
				if (sccOf.get(w) !== k)
					capaScc[k] = Math.max(capaScc[k], capaScc[sccOf.get(w)] + 1);
	});
	for (const id of ids) nodes.get(id).capa = capaScc[sccOf.get(id)];
	// Subtasks right of their mother; repeat for nested groups and the chains that follow them. A mother that
	// waits on its own subtask is a loop of «right of» rules: its waits-on column wins and the rule is skipped.
	const rightOf = new Map(ids.map((id) => [id, [...waits.get(id)]]));
	for (const e of edges) if (e.tipo === 'subtarea') rightOf.get(e.a).push(e.de);
	const loopOf = new Map();
	components(ids, (id) => rightOf.get(id)).forEach((c, k) => {
		for (const id of c) loopOf.set(id, k);
	});
	for (let pass = 0, moved = true; moved && pass < ids.length; pass++) {
		moved = false;
		for (const e of edges) {
			if (loopOf.get(e.de) === loopOf.get(e.a)) continue;
			const [a, b] = [nodes.get(e.de), nodes.get(e.a)];
			const [node, min] = e.tipo === 'subtarea' ? [b, a.capa + 1] : [a, b.capa + 1];
			if (node.capa < min) {
				node.capa = min;
				moved = true;
			}
		}
	}
	return avisos;
}

/** desbloquea: open tasks that reach the node backwards over waits-on edges. */
function countUnlocks(nodes, edges) {
	const waitedBy = new Map([...nodes.keys()].map((id) => [id, []]));
	for (const e of edges) if (e.tipo === 'espera') waitedBy.get(e.a).push(e.de);
	for (const [id, n] of nodes) {
		const seen = new Set([id]);
		const queue = [id];
		while (queue.length)
			for (const w of waitedBy.get(queue.shift())) {
				if (seen.has(w)) continue;
				seen.add(w);
				queue.push(w);
			}
		seen.delete(id);
		n.desbloquea =
			n.tipo === 'hecha' ? 0 : [...seen].filter((w) => nodes.get(w).tipo === 'tarea').length;
	}
}

const order = (a, b) =>
	a.capa - b.capa ||
	(a.madre ?? a.id).localeCompare(b.madre ?? b.id) ||
	(a.num ?? 1e9) - (b.num ?? 1e9) ||
	a.id.localeCompare(b.id);

export function dependencyGraph(board, now = Date.now()) {
	const tareas = board.tareas ?? [];
	const live = new Map(tareas.map((t) => [t.id, t]));
	const open = tareas.filter(isOpen);
	const g = {
		nodes: new Map(),
		edges: [],
		avisos: [],
		lookup: (id) => live.get(id) ?? archivedTask(id, board),
		addTask: (t) => {
			if (g.nodes.has(t.id)) return;
			g.nodes.set(t.id, {
				id: t.id,
				num: t.num,
				titulo: t.titulo ?? t.id,
				estado: t.estado ?? 'pendiente',
				tipo: isOpen(t) ? 'tarea' : 'hecha',
				...(t.archivada || !live.has(t.id) ? { archivada: true } : {}),
			});
		},
	};
	const reqsOf = new Map(open.map((t) => [t.id, requisitos(t, board, now)]));
	for (const t of open) addRequisitos(g, t, board, reqsOf.get(t.id));
	for (const t of open) addSubtask(g, t);
	const avisos = [...g.avisos, ...layOut(g.nodes, g.edges)];
	countUnlocks(g.nodes, g.edges);
	const nodos = [...g.nodes.values()].sort(order);
	return {
		nodos,
		aristas: g.edges,
		avisos,
		bloqueadasSinMotivo: open
			.filter((t) => t.estado === 'bloqueada' && reqsOf.get(t.id).every((r) => r.ok))
			.map((t) => ({ id: t.id, num: t.num, titulo: t.titulo ?? t.id })),
		abiertas: nodos.filter((n) => n.tipo === 'tarea').length,
	};
}
