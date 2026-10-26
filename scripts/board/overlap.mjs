/**
 * d270 as d291 left it: at most two open PRs may change the board, and a PR waits for another board PR only when
 * `git merge-tree` shows a real conflict between both heads; sharing a file is not enough.
 * `pnpm board solape <id> [--sha=<head>]` checks a task's branch against the board PRs open on GitHub. Read-only:
 * it may fetch a missing PR head, never touches HEAD, the index or the working tree.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { UsageError, say } from './cli.mjs';
import { normalizePr, taskTag } from './model.mjs';

/** d270: the files that make a PR a board PR. */
export const isBoardFile = (p) =>
	/^scripts\/board\//.test(p) ||
	p === '.agent/rules/board.md' ||
	p === 'docs/core/coordinator-board.md';
/** d270: how many board PRs may be open at once. */
export const MAX_BOARD_PRS = 2;
const SHA = /^[a-f0-9]{40}$/;
const GIT = { encoding: 'utf8', timeout: 20000, windowsHide: true };

/**
 * `git merge-tree --write-tree` of commits `a` and `b` (their merge base is found by Git): `{estado: 'limpio'}`,
 * `{estado: 'conflicto', archivos}` or `{estado: 'sin-verificar'}` when Git could not merge them (missing objects).
 */
export function mergeConflicts(a, b, { cwd } = {}) {
	const r = spawnSync('git', ['merge-tree', '--write-tree', '--name-only', '-z', a, b], {
		...GIT,
		...(cwd ? { cwd } : {}),
	});
	if (r.status === 0) return { estado: 'limpio', archivos: [] };
	if (r.status === 1) {
		const paths = String(r.stdout).split('\0\0')[0].split('\0');
		if (SHA.test(paths[0]))
			return { estado: 'conflicto', archivos: paths.slice(1).filter(Boolean) };
	}
	return { estado: 'sin-verificar', archivos: [] };
}

/**
 * Whether a branch that changes `ownFiles` may open (or keep) its PR now, `{aplica, puede, lineas}`. `others` are
 * the other open board PRs `[{number, files, merge}]`, `merge` being mergeConflicts of both heads.
 */
export function overlapVerdict({ ownFiles, others }) {
	if (!ownFiles.some(isBoardFile))
		return { aplica: false, puede: true, lineas: ['no cambia el tablero: d270 no aplica'] };
	const lineas = others.map(({ number, files = [], merge }) => {
		const shared = files.filter((p) => ownFiles.includes(p));
		const comparten = shared.length
			? `comparten ${shared.join(', ')}`
			: 'no comparten archivos';
		if (merge.estado === 'conflicto')
			return `#${number}: conflicto real en ${merge.archivos.join(', ') || '¿?'}`;
		if (merge.estado === 'sin-verificar')
			return `#${number}: UNVERIFIED, git merge-tree no pudo unir las cabezas (${comparten})`;
		return `#${number}: sin conflicto (${comparten})`;
	});
	const full = others.length >= MAX_BOARD_PRS;
	const blocked = others.some(({ merge }) => merge.estado !== 'limpio');
	if (full)
		lineas.unshift(
			`ya hay ${others.length} PR del tablero abiertos (${others.map((o) => `#${o.number}`).join(', ')}): espere su turno`,
		);
	return { aplica: true, puede: !full && !blocked, lineas };
}

const git = (args, opts) =>
	execFileSync('git', args, { ...GIT, stdio: ['ignore', 'pipe', 'ignore'], ...opts }).trim();

/** Whether commit `sha` is in the local object store. */
const hasCommit = (sha) =>
	spawnSync('git', ['cat-file', '-e', `${sha}^{commit}`], GIT).status === 0;

/** Fetch `ref` from origin when `sha` is missing locally, so merge-tree can read it; never moves a local branch. */
function ensureCommit(sha, ref) {
	if (!hasCommit(sha)) spawnSync('git', ['fetch', '--no-tags', '--quiet', 'origin', ref], GIT);
}

/** Open PRs with their files, from one `gh pr list`. */
function openPrs() {
	try {
		return JSON.parse(
			execFileSync(
				'gh',
				[
					'pr',
					'list',
					'--state',
					'open',
					'--limit',
					'100',
					'--json',
					'number,headRefOid,headRefName,title,files',
				],
				{ ...GIT, stdio: ['ignore', 'pipe', 'pipe'] },
			),
		);
	} catch {
		throw new UsageError(
			'UNVERIFIED: no se pudo leer los PR abiertos en GitHub; vuelva a intentar.',
		);
	}
}

export function overlapCommands({ getTask }) {
	return {
		/** d270/d291: may this task's board PR open now? Exit code 1 while it must wait. */
		solape({ pos, flags }, dir, out) {
			if (!pos[0]) throw new UsageError('falta <id>');
			const t = getTask(dir, pos[0]);
			if (!t.rama) throw new UsageError(`${taskTag(t)} no tiene rama`);
			const prs = openPrs();
			const own = prs.find(
				(p) => normalizePr(t.pr) === `#${p.number}` || p.headRefName === t.rama,
			);
			const sha =
				typeof flags.sha === 'string'
					? flags.sha
					: (own?.headRefOid ??
						git(['ls-remote', 'origin', `refs/heads/${t.rama}`]).split(/\s/)[0]);
			if (!SHA.test(sha ?? ''))
				throw new UsageError(`falta la cabeza de ${t.rama} (push o --sha=<40 hex>)`);
			ensureCommit(sha, own ? `pull/${own.number}/head` : `refs/heads/${t.rama}`);
			const ownFiles =
				own && own.headRefOid === sha
					? own.files.map((f) => f.path)
					: git(['diff', '--name-only', `origin/develop...${sha}`])
							.split('\n')
							.filter(Boolean);
			// A branch that does not change the board skips the merges: d270 does not apply.
			const others = !ownFiles.some(isBoardFile)
				? []
				: prs
						.filter(
							(p) => p !== own && (p.files ?? []).some((f) => isBoardFile(f.path)),
						)
						.map((p) => {
							ensureCommit(p.headRefOid, `pull/${p.number}/head`);
							return {
								number: p.number,
								title: p.title,
								files: p.files.map((f) => f.path),
								merge: mergeConflicts(sha, p.headRefOid),
							};
						});
			const r = overlapVerdict({ ownFiles, others });
			const head = `${taskTag(t)} (${t.rama}@${sha.slice(0, 7)}): ${r.puede ? 'puede abrir su PR' : 'espera'}`;
			say(
				flags,
				out,
				{ tarea: t.id, sha, ...r, otros: others },
				[head, ...r.lineas.map((l) => `  - ${l}`)].join('\n'),
			);
			if (!r.puede) process.exitCode = 1;
		},
	};
}
