/**
 * Worker-first gate for Production invitation content: the Worker serving Production must already
 * contain the commit that builds the content. Content written before that Worker is active cannot be
 * resolved by the old Worker, and every visit (and the invitations health check) fails until the
 * deploy catches up.
 *
 * Read-only: one bounded `/api/health` request to the public alias and one local `git merge-base`.
 */
import { OperatorError } from './operator-cli-ux.ts';
import { defaultGitRunner, type GitRunner } from '../ops/release-readiness.ts';
import { PRODUCTION_ALIAS_URL, probeHealth } from '../ops/release-status.ts';

type HealthFetch = Parameters<typeof probeHealth>[2];
type HealthEvidence = Awaited<ReturnType<typeof probeHealth>>;

const PRODUCTION_HEALTH_DEADLINE_MS = 10_000;

export interface ProductionWorkerGuardDeps {
	fetchImpl?: HealthFetch;
	git?: GitRunner;
	origin?: string;
	deadlineMs?: number;
}

const NO_WRITES = 'No se realizaron escrituras en Production.';
const RETRY_COMMAND = 'pnpm prod:apply';
const DEPLOY_FIRST = [
	'Despliegue primero el Worker de Production desde main, actívelo y verifíquelo ' +
		'(pnpm ops:release-status -- --sha <main-sha> --target production --wait).',
	'Después vuelva a ejecutar pnpm prod:apply desde ese mismo commit.',
];

function refuse(code: string, title: string, cause: string, remediation: string[]): never {
	throw new OperatorError({
		code,
		title,
		cause,
		remediation,
		retryCommand: RETRY_COMMAND,
		noChangesMessage: NO_WRITES,
	});
}

/** A hung connection must refuse the apply, not stall it: abort the request and stop waiting. */
async function probeWithDeadline(
	origin: string,
	releaseSha: string,
	fetchImpl: HealthFetch,
	deadlineMs: number,
): Promise<HealthEvidence | 'timeout'> {
	const controller = new AbortController();
	let timer: ReturnType<typeof setTimeout> | undefined;
	const deadline = new Promise<'timeout'>((resolve) => {
		timer = setTimeout(() => {
			controller.abort();
			resolve('timeout');
		}, deadlineMs);
	});
	const bounded: HealthFetch = (url, init) =>
		fetchImpl(url, { ...init, signal: controller.signal } as Parameters<HealthFetch>[1]);
	try {
		return await Promise.race([
			probeHealth(origin, releaseSha, bounded, undefined, 'production'),
			deadline,
		]);
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Tables the Worker never renders as invitation content. A patch whose every `@tables` entry is
 * listed here repairs data the serving Worker already handles, so it may land before the deploy
 * that ships it; data prerequisites of a release are repaired this way. Anything else stays gated.
 */
const WORKER_INDEPENDENT_PATCH_TABLES: ReadonlySet<string> = new Set([
	'auth.users',
	'public.tracking_events',
]);

/** Decided from the reviewed plan; the apply step refuses a patch whose file changed since. */
export function patchTablesAreWorkerIndependent(tables: readonly string[] | undefined): boolean {
	return (
		tables !== undefined &&
		tables.length > 0 &&
		tables.every((table) => WORKER_INDEPENDENT_PATCH_TABLES.has(table))
	);
}

/**
 * Content the serving Worker cannot resolve breaks every visit until the deploy catches up. Owner
 * patches are arbitrary SQL that may write invitation content, so they are gated too unless they
 * write only Worker-independent tables; schema migrations are expand-first and precede the Worker
 * that uses them.
 */
export async function assertServingWorkerFirst(
	mutations: readonly { domain: string; patchTables?: readonly string[] }[],
	releaseSha: string,
	assertWorkerServesRelease: (input: { releaseSha: string }) => Promise<unknown> = (input) =>
		assertProductionWorkerServesRelease(input),
): Promise<void> {
	const gated = mutations.some(
		(item) =>
			item.domain === 'invitation' ||
			(item.domain === 'patch' && !patchTablesAreWorkerIndependent(item.patchTables)),
	);
	if (gated) await assertWorkerServesRelease({ releaseSha });
}

/**
 * Refuses unless the serving Production Worker reports a build SHA that contains `releaseSha`
 * (equal to it or a descendant of it). Runs before any backup, owner prompt or write.
 */
export async function assertProductionWorkerServesRelease(
	input: { releaseSha: string },
	deps: ProductionWorkerGuardDeps = {},
): Promise<{ servingSha: string }> {
	const releaseSha = input.releaseSha.toLowerCase();
	const origin = deps.origin ?? PRODUCTION_ALIAS_URL;
	const deadlineMs = deps.deadlineMs ?? PRODUCTION_HEALTH_DEADLINE_MS;
	const probe = await probeWithDeadline(
		origin,
		releaseSha,
		deps.fetchImpl ?? (fetch as unknown as HealthFetch),
		deadlineMs,
	);
	const title = 'El Worker de Production todavía no puede mostrar este contenido';

	if (probe === 'timeout') {
		refuse(
			'PRODUCTION_WORKER_UNVERIFIED',
			title,
			`${origin} no respondió /api/health en ${Math.round(deadlineMs / 1000)} s.`,
			[
				'Confirme que Production responde sano y vuelva a intentarlo.',
				'Sin esa verificación no se publica contenido.',
			],
		);
	}

	if (probe.result === 'unreachable' || probe.result === 'protected') {
		refuse(
			'PRODUCTION_WORKER_UNVERIFIED',
			title,
			`No se pudo leer la versión del Worker en ${probe.url} (HTTP ${probe.status ?? 'sin respuesta'}).`,
			[
				'Confirme que Production responde sano y vuelva a intentarlo.',
				'Sin esa verificación no se publica contenido.',
			],
		);
	}
	if (probe.commitSha === null) {
		refuse(
			'PRODUCTION_WORKER_UNVERIFIED',
			title,
			`${probe.url} no informa el commit del Worker activo.`,
			DEPLOY_FIRST,
		);
	}
	if (probe.environment !== 'production') {
		refuse(
			'PRODUCTION_WORKER_UNVERIFIED',
			title,
			`${probe.url} informa el entorno «${probe.environment ?? 'desconocido'}», no «production».`,
			DEPLOY_FIRST,
		);
	}

	const servingSha = probe.commitSha.toLowerCase();
	if (servingSha === releaseSha) return { servingSha };

	const git = deps.git ?? defaultGitRunner;
	const contains = git(['merge-base', '--is-ancestor', releaseSha, servingSha]).status;
	if (contains === 0) return { servingSha };
	if (contains === 1) {
		refuse(
			'PRODUCTION_WORKER_BEHIND_CONTENT',
			title,
			`Production sirve el commit ${servingSha.slice(0, 12)}, que no incluye ${releaseSha.slice(0, 12)}, ` +
				'el commit desde el que se publicaría el contenido. El Worker anterior rechazaría este contenido.',
			DEPLOY_FIRST,
		);
	}
	refuse(
		'PRODUCTION_WORKER_UNVERIFIED',
		title,
		`git no pudo comparar el commit ${servingSha.slice(0, 12)} que sirve Production con ` +
			`${releaseSha.slice(0, 12)} (estado ${contains}).`,
		[
			'Si ese commit no está en este checkout, ejecute git fetch origin.',
			'Revise que git funcione en este checkout y vuelva a intentarlo.',
			...DEPLOY_FIRST,
		],
	);
}
