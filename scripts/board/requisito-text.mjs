/**
 * How a requisito reads to a person (T41), shared by model.mjs, `pnpm board` and the view (as
 * /requisito-text.mjs). Pure and dependency-free.
 */
const REQ_TZ = 'America/Mazatlan';
const dayEs = (s) =>
	new Date(s).toLocaleDateString('es-MX', {
		timeZone: REQ_TZ,
		weekday: 'short',
		day: 'numeric',
		month: 'short',
	});
/** «T35 · Dividir reglas del tablero» for a task id, with a note when it is archived or missing. */
export function taskName(ref, board) {
	const live = (board.tareas ?? []).find((x) => x.id === ref);
	const d = live ?? (board.archivo ?? []).find((x) => x.id === ref);
	if (!d) return `la tarea «${ref}», que ya no está en el tablero`;
	const name = d.titulo ? `${d.num ? `T${d.num} · ` : ''}${d.titulo}` : ref;
	return live ? name : `${name} (archivada)`;
}

function decisionAbout(ref, board) {
	const d = (board.decisiones ?? []).find((x) => x.id === ref);
	if (!d) return ' (todavía no existe)';
	if (d.vigente !== true) return ' (ya no vigente)';
	const txt = String(d.decision ?? '');
	return `: ${txt.slice(0, 90)}${txt.length > 90 ? '…' : ''}`;
}
export const dayOf = (ref) => (Number.isNaN(new Date(ref).getTime()) ? ref : dayEs(ref));
/** Per tipo: [checklist form, blocked-card form]. */
const REQ_TEXT = {
	tarea: (ref, b) => [`Termina ${taskName(ref, b)}`, `Espera ${taskName(ref, b)}`],
	revision: (ref, b) => [
		`Tiene PR en revisión: ${taskName(ref, b)}`,
		`Espera el PR en revisión de ${taskName(ref, b)}`,
	],
	fecha: (ref) => [`Llega el ${dayOf(ref)}`, `Espera al ${dayOf(ref)}`],
	decision: (ref, b) => [
		`Decisión ${ref}${decisionAbout(ref, b)}`,
		`Espera la decisión ${ref}${decisionAbout(ref, b)}`,
	],
	prompt: () => [
		'Falta el prompt (lo escribe el coordinador)',
		'Espera su prompt (lo escribe el coordinador)',
	],
	dueno: (ref) => [`Le toca a usted: ${ref}`, `Espera su respuesta: ${ref}`],
};

/**
 * A requisito as a person reads it (T41): `{tipo: 'tarea', ref: 'board-agent-alignment'}` →
 * «Termina T35 · Dividir reglas del tablero»; with `{espera: true}` the blocked-card form,
 * «Espera T35 · Dividir reglas del tablero».
 */
export function requisitoText(r, board, { espera = false } = {}) {
	const text = REQ_TEXT[r.tipo] ?? REQ_TEXT.dueno;
	return text(String(r.ref ?? ''), board)[espera ? 1 : 0];
}
/** One checklist line of `pnpm board show`: «○ Termina T35 · Dividir reglas del tablero». */
export const requisitoLine = (r, board) => `${r.ok ? '✓' : '○'} ${requisitoText(r, board)}`;
