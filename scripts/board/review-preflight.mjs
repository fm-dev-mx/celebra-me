/** Read-only merge and CI evidence for a review, pinned to GitHub's current base and head. */
import { execFileSync, spawnSync } from 'node:child_process';
import { UsageError } from './cli.mjs';
import { ciOf } from './live.mjs';

/** The names of the checks that failed in a `statusCheckRollup`, for the refusal text. */
const failedChecks = (rollup) =>
	(Array.isArray(rollup) ? rollup : [])
		.filter((c) => ciOf([c]) === 'rojo')
		.map((c) => c.name || c.context || '?');

/**
 * One `gh pr view` of PR `task.pr` with every field `review` reads (CI and merge evidence); refuses unless the PR
 * is OPEN at head `sha`.
 */
export function viewPr(task, sha) {
	let pr;
	try {
		pr = JSON.parse(
			execFileSync(
				'gh',
				[
					'pr',
					'view',
					String(task.pr).replace(/^#/, ''),
					'--json',
					'state,headRefOid,baseRefOid,mergeable,files,changedFiles,statusCheckRollup',
				],
				{
					encoding: 'utf8',
					timeout: 20000,
					windowsHide: true,
					stdio: ['ignore', 'pipe', 'pipe'],
				},
			),
		);
	} catch {
		throw new UsageError('UNVERIFIED: no se pudo leer el PR en GitHub; vuelva a intentar.');
	}
	if (pr?.state !== 'OPEN' || pr.headRefOid !== sha)
		throw new UsageError(
			'el PR debe estar OPEN y su cabeza debe coincidir con --sha; actualice la evidencia.',
		);
	return pr;
}

/**
 * d288: null when the CI of `task`'s head `sha` (read in `pr`) is green; `{espera}` (the reason) while it still runs or has not
 * started. A red CI refuses the round, naming the failed checks. `sinCi` (--sin-ci) lets a PR whose rollup GitHub
 * lists empty through at once, and is refused while any check exists.
 */
export function ciGate(task, sha, pr = viewPr(task, sha), { sinCi = false } = {}) {
	const ci = ciOf(pr.statusCheckRollup);
	const fallidos = failedChecks(pr.statusCheckRollup);
	const at = `${task.pr}@${sha.slice(0, 7)}`;
	if (ci === 'rojo')
		throw new UsageError(
			`el CI de ${at} falló (${fallidos.join(', ')}): corrija, haga push y pida la revisión del nuevo SHA.`,
		);
	if (sinCi) {
		// Only an explicit empty list counts as "no checks": a missing rollup is unknown evidence.
		if (Array.isArray(pr.statusCheckRollup) && pr.statusCheckRollup.length === 0) return null;
		throw new UsageError(
			`--sin-ci solo vale cuando GitHub no lista ningún check; el CI de ${at} está ${ci ?? 'sin leer'}: quite --sin-ci.`,
		);
	}
	if (ci === 'verde') return null;
	return {
		espera: `el CI de ${at} ${ci === 'pendiente' ? 'sigue corriendo' : 'aún no empieza'}`,
	};
}

/** --sin-ci (no value): the `{corrio, salio}` of the round's bitácora row, or null without the flag. */
export function sinCiTrace(flags, task, sha) {
	if (flags['sin-ci'] === undefined) return null;
	if (flags['sin-ci'] !== true) throw new UsageError('--sin-ci no lleva valor');
	return {
		corrio: 'pnpm board review --sin-ci',
		salio: `GitHub no lista ningún check en ${task.pr}@${sha.slice(0, 7)}`,
	};
}

/** How long `review` waits for a green CI: --espera-min=<n> (0 = do not wait), 30 minutes by default. */
export const DEFAULT_WAIT_MIN = 30;
const pollMs = () => Number(process.env.CELEBRA_BOARD_CI_POLL_MS) || 30_000;

/**
 * Run `attempt` (one locked try) until it stops answering `{espera}` or the wait runs out. The wait sleeps with
 * the board unlocked, so other commands keep working; a run out of time refuses with the reason.
 */
export async function untilGreen(flags, out, attempt) {
	const raw = flags['espera-min'];
	const minutes =
		raw === undefined
			? DEFAULT_WAIT_MIN
			: typeof raw === 'string' && raw.trim()
				? Number(raw)
				: NaN;
	if (!Number.isFinite(minutes) || minutes < 0)
		throw new UsageError('--espera-min debe ser un número de minutos desde 0');
	const until = Date.now() + minutes * 60_000;
	for (;;) {
		const r = attempt();
		if (!r?.espera) return r;
		if (Date.now() >= until)
			throw new UsageError(
				`${r.espera}: la vuelta queda en espera. Vuelva a correr este mismo pnpm board review cuando el CI esté verde${minutes ? ` (esperé ${minutes} min)` : ''}${minutes && r.espera.endsWith('aún no empieza') ? '; si el PR no tiene ningún check, agregue --sin-ci' : ''}.`,
			);
		if (!flags.json) out(`${r.espera}; la vuelta se crea cuando esté verde…`);
		await new Promise((done) => setTimeout(done, Math.min(pollMs(), until - Date.now())));
	}
}

/** The merge evidence of `task`'s head `sha`, read in `pr`: `{files, conflicts}` (null when mergeable). */
export function reviewPreflight(task, sha, pr = viewPr(task, sha)) {
	if (!['MERGEABLE', 'CONFLICTING'].includes(pr.mergeable))
		throw new UsageError('UNVERIFIED: GitHub aún no confirma mergeable; vuelva a intentar.');
	// GitHub caps the files connection; incomplete evidence must never classify as docs-only.
	const files =
		Array.isArray(pr.files) &&
		pr.files.every((f) => typeof f?.path === 'string') &&
		pr.files.length === pr.changedFiles
			? pr.files.map((f) => f.path)
			: undefined;
	if (pr.mergeable === 'MERGEABLE') return { files, conflicts: null };
	let conflicts = [];
	if (/^[a-f0-9]{40}$/.test(pr.baseRefOid)) {
		const merge = spawnSync(
			'git',
			['merge-tree', '--write-tree', '--name-only', '-z', pr.baseRefOid, sha],
			{ encoding: 'utf8', timeout: 20000, windowsHide: true },
		);
		if (merge.status === 1) {
			const paths = String(merge.stdout).split('\0\0')[0].split('\0');
			if (/^[a-f0-9]{40}$/.test(paths[0])) conflicts = paths.slice(1).filter(Boolean);
		}
	}
	return { files, conflicts };
}
