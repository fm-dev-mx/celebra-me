/**
 * T383: `pnpm board resumen [--agente=<a>] [--json]`
 * Prints a table per agent: task, status, PR, SHA, latest novelty and what it is waiting for.
 */
import { AGENT_REGISTRY, isReview, logChange, normalizePr, reviewRounds } from './model.mjs';
import { reviewVerdict, unreadFor } from './next.mjs';
import { readLive } from './live.mjs';
import { loadBoard, readLog } from './store.mjs';
import { say } from './cli.mjs';

export const SUMMARY_AGENTS = ['claude', 'codex', 'gemini'];

export function taskNovelty(t, log = []) {
	const tLogs = log.filter((l) => l.tarea === t.id);
	for (let i = tLogs.length - 1; i >= 0; i--) {
		const l = tLogs[i];
		if (l.mensaje?.texto) return l.mensaje.texto.split(/\r?\n/)[0].trim();
		if (l.cierre?.resumen) return l.cierre.resumen.split(/\r?\n/)[0].trim();
		if (l.atendido)
			return `${l.quien || 'coordinador'} atendió mensaje para ${l.atendido.para}`;
		if (l.corrio) return `${l.corrio}${l.estado ? ' (' + logChange(l) + ')' : ''}`;
		const chg = logChange(l);
		if (chg) return chg;
	}
	if (t.cierre?.resumen) return t.cierre.resumen.split(/\r?\n/)[0].trim();
	if (t.candado?.titulo) return `candado: ${t.candado.titulo}`;
	if (t.candado) return `candado tomado por ${t.candado.agente}`;
	if (t.entregada?.agente) return `entregada a ${t.entregada.agente}`;
	return t.titulo || '-';
}

export function taskWaitingOn(t, board) {
	const unread = unreadFor('dueno', board);
	if (unread.some((m) => m.tarea === t.id)) return 'respuesta del dueño';

	if (t.estado === 'en revision') {
		const rounds = reviewRounds(t.id, board);
		const last = rounds.at(-1);
		if (last) {
			const v = reviewVerdict(last);
			if (v === 'aprobado') return 'unión (merge) por coordinador';
			if (v === 'cambios') return 'corrección de cambios por autor';
			if (v === 'bloqueado') return 'desbloqueo de revisión';
			if (last.estado === 'en curso')
				return `revisión por ${last.candado?.agente || last.agente}`;
			if (last.estado === 'pendiente') return `arranque de revisión por ${last.agente}`;
		}
		return 'revisión cruzada';
	}
	if (t.estado === 'en curso') {
		return isReview(t) ? 'veredicto de revisión' : 'cierre / PR';
	}
	if (t.estado === 'hecha') {
		return t.pr ? 'unión (merge) por coordinador' : 'verificación / archivo';
	}
	if (t.estado === 'pendiente') {
		return t.entregada
			? `que ${t.entregada.agente || t.agente} tome el encargo`
			: 'turno en cola';
	}
	if (t.estado === 'bloqueada') {
		return 'desbloqueo de requisitos';
	}
	return '-';
}

export function taskSha(t, prs = []) {
	const livePr = prs.find((p) => `#${p.number}` === normalizePr(t.pr || t.cierre?.pr));
	const raw =
		t.cierre?.resultado?.sha ||
		t.cierre?.sha ||
		t.cierre?.commit ||
		t.revisionSha ||
		t.commit ||
		livePr?.headRefOid;
	return raw ? String(raw).slice(0, 7) : '-';
}

export function taskPr(t, prs = []) {
	const livePr = prs.find((p) => p.headRefName === t.rama);
	const raw = t.pr || t.cierre?.pr || (livePr ? `#${livePr.number}` : null);
	return raw ? normalizePr(raw) : '-';
}

export function agentSummaryRows(board, log = [], { agente, prs = [] } = {}) {
	const agents = agente ? [agente] : SUMMARY_AGENTS;
	const rows = [];

	for (const a of agents) {
		const agentTasks = (board.tareas ?? [])
			.filter(
				(t) =>
					!t.archivada &&
					t.estado !== 'unida' &&
					t.estado !== 'cancelada' &&
					(t.candado?.agente === a ||
						(t.agente === a &&
							['en curso', 'en revision', 'hecha'].includes(t.estado)) ||
						(t.entregada?.agente === a && t.estado === 'pendiente')) &&
					!(isReview(t) && t.estado === 'hecha'),
			)
			.sort((t1, t2) => (t1.num ?? 0) - (t2.num ?? 0));

		for (const t of agentTasks) {
			rows.push({
				agente: a,
				id: t.id,
				num: t.num ?? null,
				tarea: `${t.num ? `T${t.num} ` : ''}${t.id}`,
				estado: t.estado,
				pr: taskPr(t, prs),
				sha: taskSha(t, prs),
				novedad: taskNovelty(t, log),
				espera: taskWaitingOn(t, board),
			});
		}
	}
	return rows;
}

export function formatSummaryTable(rows, { agente } = {}) {
	const agents = agente ? [agente] : SUMMARY_AGENTS;
	const out = [];

	for (const a of agents) {
		const name = AGENT_REGISTRY[a]?.nombre ?? a;
		out.push(`Agente: ${name}`);
		const agentRows = rows.filter((r) => r.agente === a);
		if (!agentRows.length) {
			out.push('  (sin tareas activas)\n');
			continue;
		}

		const headers = ['Tarea', 'Estado', 'PR', 'SHA', 'Última novedad', 'Qué espera'];
		const formattedRows = agentRows.map((r) => [
			r.tarea,
			r.estado,
			r.pr,
			r.sha,
			r.novedad.length > 50 ? `${r.novedad.slice(0, 47)}...` : r.novedad,
			r.espera,
		]);

		const colWidths = headers.map((h, colIdx) => {
			const maxContent = Math.max(
				h.length,
				...formattedRows.map((row) => row[colIdx].length),
			);
			return Math.min(Math.max(maxContent, 6), 55);
		});

		const headerLine = `  ${headers.map((h, i) => h.padEnd(colWidths[i])).join('  ')}`;
		const separator = `  ${colWidths.map((w) => '-'.repeat(w)).join('  ')}`;
		out.push(headerLine);
		out.push(separator);

		for (const row of formattedRows) {
			const line = `  ${row.map((val, i) => String(val ?? '').padEnd(colWidths[i])).join('  ')}`;
			out.push(line);
		}
		out.push('');
	}

	return out.join('\n').trimEnd();
}

export function resumenCommands() {
	return {
		async resumen({ flags }, dir, out) {
			const board = loadBoard(dir);
			const log = readLog(dir);
			const vivo = await readLive(dir);
			const agente =
				typeof flags.agente === 'string' ? flags.agente.toLowerCase() : undefined;
			const rows = agentSummaryRows(board, log, { agente, prs: vivo.prs ?? [] });

			say(flags, out, rows, formatSummaryTable(rows, { agente }));
		},
	};
}
