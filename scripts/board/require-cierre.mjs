/**
 * d255: no task reaches review without a valid closing summary. `pnpm board review` refuses a task whose `cierre`
 * is missing or breaks its contract (`cierreIssues`: a cancelled task reopened keeps a cierre without `resultado`),
 * and «Le toca al coordinador» asks for the summary of every task «en revision» or «unida» in that state
 * (GitHub may still move a task to «unida» on its own, because a merge is a fact). Pure functions only.
 */
import { cierreIssues } from './cierre.mjs';
import { isReview, taskTag } from './model.mjs';

/**
 * The command that writes the missing summary, with every list and resultado flag a `contrato: 2` task needs
 * (T129), so `close` accepts it once each `…` is filled in.
 */
export const closeCommand = (t) =>
	[
		`pnpm board close ${t.id} --resumen=… --comprobacion=… --saltada=…`,
		'--fallida=… --riesgo=… --duda=… --excepcion=…',
		`--pr=${t.pr ?? '#<n>'} --sha=<sha del PR> --nivel=type-check`,
	].join(' ');

/** Why `review` refuses `t` (d255), or null when its closing summary is valid on `board`. */
export function reviewCierreIssue(t, board) {
	const issues = cierreIssues(t, board);
	if (!issues.length) return null;
	const why = t.cierre
		? `su resumen de cierre no vale: ${issues.join('; ')}`
		: 'no tiene resumen de cierre';
	return `${t.id} ${why} (d255): corra primero ${closeCommand(t)}`;
}

/** Coordinator items `{tipo: 'cierre', t, texto}` for the tasks under review or merged without a valid summary. */
export function missingCierreItems(board) {
	return (board.tareas ?? [])
		.filter((t) => ['en revision', 'unida'].includes(t.estado) && !isReview(t))
		.filter((t) => cierreIssues(t, board).length)
		.map((t) => ({ tipo: 'cierre', t, texto: `Pedir el resumen de cierre de ${taskTag(t)}` }));
}
