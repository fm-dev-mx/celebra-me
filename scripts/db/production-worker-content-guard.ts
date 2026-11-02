/**
 * Worker-first gate for Production invitation content: the Worker serving Production must already
 * contain the commit that builds the content. Content written before that Worker is active cannot be
 * resolved by the old Worker, and every visit (and the invitations health check) fails until the
 * deploy catches up.
 *
 * Read-only: one `/api/health` request to the public alias and one local `git merge-base`.
 */
import { OperatorError } from './operator-cli-ux.ts';
import { defaultGitRunner, type GitRunner } from '../ops/release-readiness.ts';
import { PRODUCTION_ALIAS_URL, probeHealth } from '../ops/release-status.ts';

type HealthFetch = Parameters<typeof probeHealth>[2];

export interface ProductionWorkerGuardDeps {
	fetchImpl?: HealthFetch;
	git?: GitRunner;
	origin?: string;
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

/**
 * Refuses unless the serving Production Worker reports a build SHA that contains `releaseSha`
 * (equal to it or a descendant of it). Runs before any backup, owner prompt or write.
 */
export async function assertProductionWorkerServesRelease(
	input: { releaseSha: string },
	deps: ProductionWorkerGuardDeps = {},
): Promise<{ servingSha: string }> {
	const releaseSha = input.releaseSha.toLowerCase();
	const probe = await probeHealth(
		deps.origin ?? PRODUCTION_ALIAS_URL,
		releaseSha,
		deps.fetchImpl ?? (fetch as unknown as HealthFetch),
		undefined,
		'production',
	);
	const title = 'El Worker de Production todavía no puede mostrar este contenido';

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
		`El commit ${servingSha.slice(0, 12)} que sirve Production no existe en este checkout.`,
		['Ejecute git fetch origin y vuelva a intentarlo.', ...DEPLOY_FIRST],
	);
}
