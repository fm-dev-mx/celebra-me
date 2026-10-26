/**
 * The scope warnings of `pnpm board verify` (rules: .agent/rules/board.md): tasks in progress or in review crossed
 * by the files they change. verify-board.mjs passes how to read a task's changed files.
 */
import { isReview, taskLane } from './model.mjs';

const ACTIVE = new Set(['en curso', 'en revision']);
const BOARD_CODE = 'scripts/board/';
const MIGRATIONS = 'supabase/migrations/';
/** d270: at most two board PRs at once, and only when they share no file. */
const BOARD_PR_LIMIT = 2;
/** Files every lane touches and Git merges or regenerates without a real collision: no shared-file warning. */
const SHARED_IGNORED = /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$|\.md$/;

/** Each pair of tasks in different lanes that change the same files, lockfiles and Markdown aside. */
function sharedFileWarnings(active, who) {
	const avisos = [];
	for (const a of active)
		for (const b of active) {
			if (a === b || a.lane === b.lane) continue;
			const shared = a.files.filter((f) => b.files.includes(f) && !SHARED_IGNORED.test(f));
			if (!shared.length) continue;
			const more = shared.length > 3 ? ` y ${shared.length - 3} más` : '';
			avisos.push({
				id: a.t.id,
				msg: `comparte ${shared.length} archivos con ${who(b.t)} (carril ${b.lane || 'sin carril'}): ${shared.slice(0, 3).join(', ')}${more}`,
			});
		}
	return avisos;
}

/**
 * Tasks in progress or in review crossed by the files they change: a file shared between lanes, more than two
 * tasks on scripts/board/ (d270), and a migration without `toca: ["migracion"]`. Review rounds change nothing.
 */
export function scopeWarnings(tareas, changedFiles) {
	const avisos = [];
	let complete = true;
	const active = [];
	for (const t of tareas.filter((x) => ACTIVE.has(x.estado) && !isReview(x) && !x.archivada)) {
		const changed = changedFiles(t);
		if (!changed?.exact) complete = false;
		if (changed?.files.length)
			active.push({ t, files: changed.files, lane: taskLane(t) ?? '' });
	}
	const who = (t) => (t.num ? `T${t.num} ${t.id}` : t.id);
	avisos.push(...sharedFileWarnings(active, who));
	const board = active.filter((x) => x.files.some((f) => f.startsWith(BOARD_CODE)));
	if (board.length > BOARD_PR_LIMIT)
		for (const x of board)
			avisos.push({
				id: x.t.id,
				msg: `d270: ${board.length} tareas cambian ${BOARD_CODE} a la vez (máximo ${BOARD_PR_LIMIT}): ${board.map((y) => who(y.t)).join(', ')}`,
			});
	for (const x of active)
		if (
			x.files.some((f) => f.startsWith(MIGRATIONS)) &&
			!(Array.isArray(x.t.toca) && x.t.toca.includes('migracion'))
		)
			avisos.push({
				id: x.t.id,
				msg: `cambia ${MIGRATIONS} sin toca: ["migracion"]: pnpm board set ${x.t.id} --rev=${x.t.rev} toca=migracion`,
			});
	return { avisos, cobertura: { archivos: complete ? 'VERIFIED' : 'UNVERIFIED' } };
}
