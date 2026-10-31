/**
 * `pnpm board` commands of T126: messages between agents (`msg`, `inbox`, d291 `atendido`), what is next
 * (`sigue`), the lane table read from Git (`carriles`) and the heartbeat every command gives its caller's locks.
 */
import { randomBytes } from 'node:crypto';
import { UsageError, say } from './cli.mjs';
import { readLive } from './live.mjs';
import {
	ATENDIBLES,
	blockedText,
	buildMessageRow,
	canFinish,
	DESTINOS,
	isFinished,
	logRowError,
	nextFor,
	promptWithLane,
	QUIEN,
	quienOf,
	sessionOf,
	stage,
	taskTag,
} from './model.mjs';
import { mergeSignal, messageExtras, ownerMessageIssues } from './owner-text.mjs';
import { laneRows, messageLine, nextSections, sectionLines, unreadFor } from './next.mjs';
import { appendLog, loadBoard, readCollection, readDoc, withLock, writeDoc } from './store.mjs';

/** Read marks kept per reader; older ids fall off (their messages stay in the bitácora). */
const MAX_READ = 2000;
const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
const need = (v, msg) => {
	if (!v || v === true) throw new UsageError(msg);
	return v;
};

/**
 * The caller's locks get `candado.latido` = now; neither rev nor `actualizado` moves, so nobody has to read the
 * task again. A busy store lock skips it: a heartbeat never fails a command.
 */
function heartbeat(dir, agente, sesion) {
	if (!agente || !sesion) return [];
	try {
		return withLock(
			dir,
			() => {
				const en = nowIso();
				const own = readCollection(dir, 'tareas').filter(
					(t) => t.candado?.agente === agente && t.candado.sesion === sesion,
				);
				for (const { id, ...doc } of own)
					writeDoc(
						dir,
						'tareas',
						id,
						{ ...doc, candado: { ...doc.candado, latido: en } },
						{ backup: false },
					);
				return own.map((t) => t.id);
			},
			{ waitMs: 1000 },
		);
	} catch {
		return [];
	}
}

/** T322: a message's technical detail under its line, indented, for `inbox`. */
const detailLines = (r) =>
	r.mensaje.detalle
		? [
				'',
				'  Detalle técnico:',
				...r.mensaje.detalle.split(/\r?\n|\\n/).map((l) => '    ' + l),
			].join('\n')
		: '';

/** Commands whose --agente names another agent (or nobody), not the caller: no heartbeat for them. */
const NO_HEARTBEAT = new Set(['move', 'review', 'view', 'verify']);

/** Every command that succeeds renews the heartbeat of the locks its caller (--agente, or --de) holds. */
export function beatCaller(dir, cmd, flags) {
	const agente = NO_HEARTBEAT.has(cmd) ? undefined : (flags.agente ?? flags.de);
	if (typeof agente === 'string')
		heartbeat(dir, agente, sessionOf(agente, flags.sesion, process.env));
}

/** Blocked tasks for an agent with their reasons (d177/T476 case). */
export function blockedFor(agente, board, now = Date.now()) {
	return (board.tareas ?? [])
		.filter((t) => {
			if (isFinished(t)) return false;
			if (t.candado) return false;
			if (t.actor === 'coordinador' || t.actor === 'dueno') return false;
			if (stage(t, board, now) !== 'bloqueada') return false;
			const isMine = t.agente === agente || !t.agente || t.agente === 'cualquiera';
			return isMine && canFinish(t, agente, board);
		})
		.map((t) => ({
			id: t.id,
			num: t.num,
			titulo: t.titulo,
			motivo:
				blockedText(t, board) ||
				(t.estado === 'bloqueada' ? 'marcada como bloqueada' : 'bloqueada'),
		}))
		.sort((a, b) => (a.num ?? 9999) - (b.num ?? 9999));
}

/** `getTask(dir, id)` comes from board.mjs, which resolves `T<n>` too. */
export function nextCommands({ getTask }) {
	return {
		/** Return the next eligible task, or blocked tasks with reasons when none is eligible. */
		next({ flags }, dir, out) {
			const agente = need(flags.agente, 'falta --agente=claude|codex|gemini');
			const board = loadBoard(dir);
			const t = nextFor(agente, board);
			const bloqueadas = blockedFor(agente, board);
			if (flags.json) {
				if (t) return out(JSON.stringify(t, null, 2));
				if (!bloqueadas.length) return out(JSON.stringify(null, null, 2));
				return out(JSON.stringify({ tarea: null, bloqueadas }, null, 2));
			}
			if (!t) {
				if (!bloqueadas.length) return out(`Nada listo para ${agente}.`);
				return out(
					[
						`Nada listo para ${agente}.`,
						``,
						`Tareas bloqueadas (${bloqueadas.length}):`,
						...bloqueadas.map(
							(b) => `  ${b.num ? `T${b.num} ` : ''}${b.id}: ${b.motivo}`,
						),
					].join('\n'),
				);
			}
			out(
				`${t.id} (rev ${t.rev}) — ${t.num ? `T${t.num} ` : ''}${t.titulo}\n\n${promptWithLane(t, board) ?? ''}`,
			);
		},
		/**
		 * A message about a task from one agent (or the owner, or the coordinator) to another. T322: to the owner it
		 * is a one-line question, a decision adds `--opcion` (the recommended one first) and `--detalle` holds the
		 * technical part.
		 */
		msg({ pos, flags, lists = {} }, dir, out) {
			const de = need(flags.de, `falta --de=${QUIEN.join('|')}`);
			const para = need(flags.para, `falta --para=${DESTINOS.join('|')}`);
			const texto =
				pos.slice(1).join(' ').trim() ||
				(typeof flags.texto === 'string' ? flags.texto : '');
			const opciones = (lists.opcion ?? []).map((o) =>
				typeof o === 'string' ? o.trim() : '',
			);
			const detalle = typeof flags.detalle === 'string' ? flags.detalle.trim() : undefined;
			if (opciones.some((o) => !o)) throw new UsageError('--opcion necesita texto');
			if (opciones.length && para !== 'dueno')
				throw new UsageError('--opcion solo va en mensajes --para=dueno');
			const issues = para === 'dueno' ? ownerMessageIssues({ texto, opciones }) : [];
			if (issues.length)
				throw new UsageError(`mensaje para el dueño no guardado: ${issues.join('; ')}`);
			return withLock(dir, () => {
				const t = getTask(dir, need(pos[0], 'falta <id>'));
				const en = nowIso();
				const id = `${en}-${randomBytes(3).toString('hex')}`;
				const row = buildMessageRow(t.id, { de, para, texto, id }, en);
				Object.assign(row.mensaje, messageExtras({ opciones, detalle }));
				if (para === 'dueno') row.mensaje.rev = t.rev;
				const why = logRowError(row);
				if (why) throw new UsageError(why);
				appendLog(dir, row);
				say(flags, out, row, `mensaje para ${para} sobre ${taskTag(t)} guardado`);
			});
		},
		/**
		 * The messages to a reader not read yet, oldest first, now marked read; --todos lists read ones too. The owner's
		 * (`--agente=dueno`) stay unread unless the owner passes --leido, so an agent can look without hiding them.
		 */
		inbox({ flags }, dir, out) {
			const agente = need(flags.agente, `falta --agente=${DESTINOS.join('|')}`);
			if (!DESTINOS.includes(agente))
				throw new UsageError(`--agente debe ser ${DESTINOS.join('|')}`);
			return withLock(dir, () => {
				const board = loadBoard(dir);
				// d265: the inbox keeps messages of archived tasks too; only the queues and alerts drop them (T521).
				const unread = unreadFor(agente, board, { archived: true });
				const rows = flags.todos
					? board.bitacora.filter((r) => r.mensaje?.para === agente)
					: unread;
				// An agent reading the owner's inbox must not take the owner's questions out of «Le toca a usted»:
				// the owner's own read mark needs --leido.
				if (unread.length && (agente !== 'dueno' || flags.leido === true)) {
					const leidos = [
						...(readDoc(dir, 'bandejas', agente)?.leidos ?? []),
						...unread.filter((r) => !mergeSignal(r)).map((r) => r.mensaje.id),
					];
					writeDoc(
						dir,
						'bandejas',
						agente,
						{ leidos: leidos.slice(-MAX_READ) },
						{ backup: false },
					);
				}
				const text = rows.length
					? rows
							.map((r) => `${r.en}  ${messageLine(r, board)}${detailLines(r)}`)
							.join('\n')
					: `Sin mensajes nuevos para ${agente}.`;
				say(flags, out, rows, text);
			});
		},
		/**
		 * d291: the owner's (or the coordinator's) messages about a task were answered, so they leave «Le toca a
		 * usted» («Le toca al coordinador»). One bitácora row `atendido {para, mensajes}` is the mark; --mensaje=<id>
		 * handles one message only. `inbox --todos` still lists them.
		 */
		atendido({ pos, flags }, dir, out) {
			const para = need(flags.para, `falta --para=${ATENDIBLES.join('|')}`);
			if (!ATENDIBLES.includes(para))
				throw new UsageError(
					`--para debe ser ${ATENDIBLES.join('|')}; un agente lee los suyos con pnpm board inbox`,
				);
			return withLock(dir, () => {
				const t = getTask(dir, need(pos[0], 'falta <id>'));
				const open = unreadFor(para, loadBoard(dir)).filter((r) => r.tarea === t.id);
				const one = typeof flags.mensaje === 'string' ? flags.mensaje : undefined;
				const rows = one ? open.filter((r) => r.mensaje.id === one) : open;
				if (rows.some(mergeSignal))
					throw new UsageError(
						'siguiente: unir se atiende solo con pnpm board merged tras verificar GitHub',
					);
				if (!rows.length)
					throw new UsageError(
						open.length
							? `${one} no es un mensaje sin atender para ${para} sobre ${taskTag(t)}; los hay: ${open.map((r) => r.mensaje.id).join(', ')}`
							: `no hay mensajes sin atender para ${para} sobre ${taskTag(t)}`,
					);
				const nota = typeof flags.nota === 'string' && flags.nota.trim();
				const row = {
					tarea: t.id,
					en: nowIso(),
					quien: quienOf(flags),
					atendido: {
						para,
						mensajes: rows.map((r) => r.mensaje.id),
						...(nota ? { nota } : {}),
					},
				};
				const why = logRowError(row);
				if (why) throw new UsageError(why);
				appendLog(dir, row);
				const n = rows.length;
				say(
					flags,
					out,
					row,
					`${n} ${n > 1 ? 'mensajes' : 'mensaje'} para ${para} sobre ${taskTag(t)} ${n > 1 ? 'atendidos' : 'atendido'}: ${row.atendido.mensajes.join(', ')}`,
				);
			});
		},
		/** What is next for the owner and the coordinator, and what is stalled, with GitHub's open PRs. */
		async sigue({ flags }, dir, out) {
			const board = loadBoard(dir);
			const vivo = await readLive(dir);
			const r = nextSections(board, { prs: vivo.prs ?? undefined });
			say(flags, out, r, sectionLines(r).join('\n'));
		},
		/** The lane table, read from git in each lane folder instead of written by hand. */
		async carriles({ flags }, dir, out) {
			const board = loadBoard(dir);
			const rows = laneRows(board, (await readLive(dir)).carriles);
			say(flags, out, rows, rows.map((l) => l.texto).join('\n'));
		},
	};
}
