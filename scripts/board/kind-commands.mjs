/**
 * T130 `pnpm board` side of task kinds: `prompt <id>` prints (or with --guardar saves) the prompt generated from a
 * task's `tipo`, and `add`, `set` and `plan` regenerate it when what it is built from changes. A task without
 * `tipo` keeps its hand-written prompt; a review round made by `review` keeps the prompt `review` wrote.
 */
import { UsageError, say } from './cli.mjs';
import { KindPromptError, kindPrompt, promptDiff } from './kind-prompt.mjs';
import { destinoIssue, kindKey, loadKinds } from './kinds.mjs';
import { KIND_LISTS, promptWithLane } from './model.mjs';
import { OWNER_FIELDS } from './owner-text.mjs';
import { loadBoard, withLock } from './store.mjs';

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

/** Fields a generated prompt is built from: changing one regenerates it. */
const SOURCES = [
	'tipo',
	'destino',
	'busca',
	'corto',
	'titulo',
	'agente',
	'rama',
	'pr',
	'origen',
	'requisitos',
	'carrilPlaneado',
	...KIND_LISTS,
	...OWNER_FIELDS,
];

/** Whether `t`'s prompt comes from its kind: typed, and not a round whose prompt `review` writes. */
export const generatesPrompt = (t) => Boolean(t?.tipo) && !t.revisionSha;

let cache;
const kinds = () => (cache ??= loadKinds());

/** The kind of `t`, or a refusal naming the kind file's problems. */
function kindOf(t) {
	const { kinds: all, issues } = kinds();
	const key = kindKey(t);
	if (all[key]) return all[key];
	const why = issues.filter((x) => x.id === `kinds/${key}`).map((x) => x.msg);
	throw new UsageError(`.agent/kinds/${key}.yaml no sirve: ${why.join('; ') || 'falta'}`);
}

/**
 * The prompt `t` gets from its kind at board revision `rev`, or undefined while it cannot have one yet (no
 * lane, or no busca: `taskIssues` names the missing busca).
 */
export function generatedPrompt(t, board, { num, rev, generado = nowIso() } = {}) {
	if (!generatesPrompt(t) || !String(t.busca ?? '').trim()) return undefined;
	try {
		return kindPrompt(t, board, kindOf(t), { num, rev, generado }) ?? undefined;
	} catch (e) {
		if (e instanceof KindPromptError) throw new UsageError(`${t.id}: ${e.message}`);
		throw e;
	}
}

/**
 * `after` with its generated prompt when a source field changed since `before` (always on add), or `after`
 * itself; refuses a hand-written prompt on a typed task.
 */
export function withKindPrompt(before, after, dir, { num, pairs = {} } = {}) {
	const destino = destinoIssue(after);
	if (destino) throw new UsageError(`no se escribió ${after.id}: ${destino}`);
	if (!generatesPrompt(after)) return after;
	if (Object.hasOwn(pairs, 'prompt'))
		throw new UsageError(
			`${after.id} tiene tipo ${after.tipo}: su prompt se genera; cambie busca=… u otro campo, o vea pnpm board prompt ${after.id}`,
		);
	const changed =
		!before || SOURCES.some((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
	if (!changed) return after;
	const prompt = generatedPrompt(after, loadBoard(dir), {
		num: num ?? after.num,
		rev: (before?.rev ?? 0) + 1,
	});
	const out = { ...after };
	if (prompt) out.prompt = prompt;
	else delete out.prompt;
	return out;
}

export function kindCommands({ getTask, saveTask, checkRev, assertOwner, noteOverride }) {
	return {
		/** `prompt <id> [--guardar --rev=<n>] [--json]`: the generated prompt and how the saved one differs. */
		prompt({ pos, flags }, dir, out) {
			const id = pos[0];
			if (!id) throw new UsageError('falta <id>');
			const run = () => {
				const t = getTask(dir, id);
				if (!generatesPrompt(t) && !flags.guardar && t.prompt) {
					const prompt = promptWithLane(t, loadBoard(dir));
					return say(flags, out, { id: t.id, prompt, difiere: [] }, prompt);
				}
				if (!generatesPrompt(t))
					throw new UsageError(
						t.revisionSha
							? `${t.id} es una vuelta de revisión: su prompt lo escribe pnpm board review`
							: `${t.id} no tiene tipo: su prompt se escribe a mano (pnpm board show ${t.id})`,
					);
				const board = loadBoard(dir);
				const save = flags.guardar === true;
				let override = null;
				if (save) {
					checkRev(t, flags);
					override = assertOwner(t, flags);
				}
				const prompt = generatedPrompt(t, board, { rev: save ? t.rev + 1 : t.rev });
				if (!prompt)
					throw new UsageError(
						String(t.busca ?? '').trim()
							? `${t.id} no tiene carril: pnpm board plan ${t.id} --rev=${t.rev} --carril=<carril> --coordinador`
							: `${t.id} no tiene busca=… (su QUÉ SE BUSCA)`,
					);
				const difiere = t.prompt ? promptDiff(t.prompt, prompt) : ['sin prompt'];
				if (!save) {
					const delivered = promptWithLane({ ...t, prompt }, board);
					return say(flags, out, { id: t.id, prompt: delivered, difiere }, delivered);
				}
				if (!difiere.length)
					return say(
						flags,
						out,
						{ id: t.id, rev: t.rev, difiere },
						`${t.id} ya tiene ese prompt`,
					);
				const saved = saveTask(dir, t, { ...t, prompt }, flags);
				noteOverride(dir, t, override, 'pnpm board prompt --guardar');
				say(
					flags,
					out,
					{ id: saved.id, rev: saved.rev, difiere },
					`${saved.id} rev ${saved.rev}: prompt regenerado (${difiere.join(', ')})`,
				);
			};
			return flags.guardar === true ? withLock(dir, run) : run();
		},
	};
}
