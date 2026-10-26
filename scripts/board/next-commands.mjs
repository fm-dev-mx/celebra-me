/**
 * `pnpm board` commands of T126: messages between agents (`msg`, `inbox`, d291 `atendido`), what is next
 * (`sigue`), the lane table read from Git (`carriles`) and the heartbeat every command gives its caller's locks.
 */
import { randomBytes } from 'node:crypto';
import { UsageError, say } from './cli.mjs';
import { readLive } from './live.mjs';
import {
	ATENDIBLES,
	buildMessageRow,
	DESTINOS,
	logRowError,
	QUIEN,
	quienOf,
	sessionOf,
	taskTag,
} from './model.mjs';
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

/** Commands whose --agente names another agent (or nobody), not the caller: no heartbeat for them. */
const NO_HEARTBEAT = new Set(['move', 'review', 'view', 'verify']);

/** Every command that succeeds renews the heartbeat of the locks its caller (--agente, or --de) holds. */
export function beatCaller(dir, cmd, flags) {
	const agente = NO_HEARTBEAT.has(cmd) ? undefined : (flags.agente ?? flags.de);
	if (typeof agente === 'string')
		heartbeat(dir, agente, sessionOf(agente, flags.sesion, process.env));
}

/** `getTask(dir, id)` comes from board.mjs, which resolves `T<n>` too. */
export function nextCommands({ getTask }) {
	return {
		/** A message about a task from one agent (or the owner, or the coordinator) to another. */
		msg({ pos, flags }, dir, out) {
			const de = need(flags.de, `falta --de=${QUIEN.join('|')}`);
			const para = need(flags.para, `falta --para=${DESTINOS.join('|')}`);
			const texto =
				pos.slice(1).join(' ').trim() ||
				(typeof flags.texto === 'string' ? flags.texto : '');
			return withLock(dir, () => {
				const t = getTask(dir, need(pos[0], 'falta <id>'));
				const en = nowIso();
				const id = `${en}-${randomBytes(3).toString('hex')}`;
				const row = buildMessageRow(t.id, { de, para, texto, id }, en);
				const why = logRowError(row);
				if (why) throw new UsageError(why);
				appendLog(dir, row);
				say(flags, out, row, `mensaje para ${para} sobre ${taskTag(t)} guardado`);
			});
		},
		/** The messages to a reader not read yet, oldest first, now marked read; --todos lists read ones too. */
		inbox({ flags }, dir, out) {
			const agente = need(flags.agente, `falta --agente=${DESTINOS.join('|')}`);
			if (!DESTINOS.includes(agente))
				throw new UsageError(`--agente debe ser ${DESTINOS.join('|')}`);
			return withLock(dir, () => {
				const board = loadBoard(dir);
				const unread = unreadFor(agente, board);
				const rows = flags.todos
					? board.bitacora.filter((r) => r.mensaje?.para === agente)
					: unread;
				if (unread.length) {
					const leidos = [
						...(readDoc(dir, 'bandejas', agente)?.leidos ?? []),
						...unread.map((r) => r.mensaje.id),
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
					? rows.map((r) => `${r.en}  ${messageLine(r, board)}`).join('\n')
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
			const vivo = await readLive(dir, board);
			const r = nextSections(board, { prs: vivo.prs ?? undefined });
			say(flags, out, r, sectionLines(r).join('\n'));
		},
		/** The lane table, read from git in each lane folder instead of written by hand. */
		async carriles({ flags }, dir, out) {
			const board = loadBoard(dir);
			const rows = laneRows(board, (await readLive(dir, board)).carriles);
			say(flags, out, rows, rows.map((l) => l.texto).join('\n'));
		},
	};
}
