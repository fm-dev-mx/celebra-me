/**
 * d255: no task reaches review without its closing summary. `pnpm board review` refuses a task with no `cierre`,
 * and «Le toca al coordinador» asks for the summary of every task «en revision» or «unida» that lacks one
 * (GitHub may still move a task to «unida» on its own, because a merge is a fact). Pure functions only.
 */
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

/** Why `review` refuses `t` (d255), or null when its closing summary exists. */
export function reviewCierreIssue(t) {
	if (t.cierre) return null;
	return `${t.id} no tiene resumen de cierre (d255): corra primero ${closeCommand(t)}`;
}

/** Coordinator items `{tipo: 'cierre', t, texto}` for the tasks under review or merged without a summary. */
export function missingCierreItems(board) {
	return (board.tareas ?? [])
		.filter((t) => ['en revision', 'unida'].includes(t.estado) && !isReview(t) && !t.cierre)
		.map((t) => ({ tipo: 'cierre', t, texto: `Pedir el resumen de cierre de ${taskTag(t)}` }));
}
