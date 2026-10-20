/**
 * Smoke of one Cloudflare application Worker URL for one exact SHA: on Preview the stable host or
 * a version URL, on Production a version URL only (that Worker has no `workers.dev` host and no
 * traffic before the cutover). Runs the public probes shared with `post-deploy-smoke.ts check`, then verifies
 * the serving build identity (`/api/health`: commit SHA and deploy environment). On Production it
 * also proves the version URL is closed without the Cloudflare Access service token and that
 * `/api/whatsapp` redirects to a real contact number (the CONTACT_WHATSAPP Worker secret). The token
 * travels only to that origin. Read-only: it never deploys anything.
 *
 * Usage: tsx scripts/ops/cloudflare-worker-smoke.ts [--env preview|production] --url <https://...workers.dev> --sha <sha> [--version-id <id>]
 * Reads CLOUDFLARE_ACCESS_CLIENT_ID and CLOUDFLARE_ACCESS_CLIENT_SECRET from the environment.
 */
import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { basename } from 'node:path';
import {
	OPERATIONAL_EVIDENCE_SCHEMA_VERSION,
	assertOperationalEvidenceSafe,
	sanitizeOperationalCorrelationId,
	serializeOperationalEvidenceEvent,
} from '../../src/lib/operations/operational-evidence.ts';
import {
	CLOUDFLARE_PREVIEW_HOST_PATTERN,
	CLOUDFLARE_PRODUCTION_VERSION_HOST_PATTERN,
	buildCloudflareAccessHeaders,
} from '../playwright/preview-environment.ts';
import {
	formatEvidenceSummary,
	runDeploymentSmoke,
	toPostDeployPayload,
	type PostDeployEnvironment,
	type PostDeployEvidence,
	type ProductionSmokeResult,
} from './post-deploy-smoke.ts';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const SHA_PATTERN = /^[0-9a-f]{40}$/i;

const HOST_PATTERNS: Readonly<Record<PostDeployEnvironment, RegExp>> = {
	preview: CLOUDFLARE_PREVIEW_HOST_PATTERN,
	production: CLOUDFLARE_PRODUCTION_VERSION_HOST_PATTERN,
};

export interface CloudflareWorkerSmokeResult {
	probes: ProductionSmokeResult;
	identity: {
		commitSha: string | null;
		environment: string | null;
		verified: boolean;
	};
	/** Production only: the version URL refused a request without the service token. */
	accessEnforced: boolean | null;
	/** Production only: `/api/whatsapp` redirects to wa.me with a real, non-placeholder number. */
	contactWhatsAppConfigured: boolean | null;
	passed: boolean;
	failureCodes: string[];
}

/** Accepts only an HTTPS origin on the environment's Worker hosts; anything else is refused. */
export function parseCloudflareWorkerOrigin(
	rawUrl: string,
	environment: PostDeployEnvironment = 'preview',
): URL {
	let url: URL;
	try {
		url = new URL(rawUrl.trim());
	} catch {
		throw new Error('Worker URL must be an absolute URL.');
	}
	if (
		url.protocol !== 'https:' ||
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		(url.pathname !== '/' && url.pathname !== '')
	) {
		throw new Error('Worker URL must contain only an HTTPS origin.');
	}
	if (!HOST_PATTERNS[environment].test(url.hostname.toLowerCase())) {
		throw new Error(
			environment === 'preview'
				? 'Worker URL must be the Preview Worker host or one of its version URLs.'
				: 'Worker URL must be a Production Worker version URL.',
		);
	}
	return url;
}

/** True when the origin answers `/api/health` without credentials with anything but a 200. */
async function isAccessEnforced(origin: URL, fetchImpl: FetchLike): Promise<boolean> {
	try {
		const response = await fetchImpl(`${origin.origin}/api/health`, {
			method: 'GET',
			redirect: 'manual',
			signal: AbortSignal.timeout(10_000),
			headers: { 'User-Agent': 'celebra-me-post-deploy-smoke/1' },
		});
		return response.status !== 200;
	} catch {
		return false;
	}
}

async function readBuildIdentity(
	origin: URL,
	fetchImpl: FetchLike,
	accessHeaders: Record<string, string>,
): Promise<{ commitSha: string | null; environment: string | null }> {
	try {
		const response = await fetchImpl(`${origin.origin}/api/health`, {
			method: 'GET',
			redirect: 'manual',
			signal: AbortSignal.timeout(10_000),
			headers: { 'User-Agent': 'celebra-me-post-deploy-smoke/1', ...accessHeaders },
		});
		if (response.status !== 200) return { commitSha: null, environment: null };
		const body = (await response.json()) as { build?: Record<string, unknown> };
		const read = (key: string) =>
			typeof body.build?.[key] === 'string' ? (body.build[key] as string) : null;
		return { commitSha: read('commitSha'), environment: read('environment') };
	} catch {
		return { commitSha: null, environment: null };
	}
}

export async function runCloudflareWorkerSmoke(
	input: { url: string; sha: string; environment?: PostDeployEnvironment },
	fetchImpl: FetchLike,
	accessHeaders: Record<string, string> | undefined,
): Promise<CloudflareWorkerSmokeResult> {
	const environment = input.environment ?? 'preview';
	const origin = parseCloudflareWorkerOrigin(input.url, environment);
	const sha = input.sha.trim().toLowerCase();
	if (!SHA_PATTERN.test(sha)) throw new Error('An exact 40-character commit SHA is required.');
	if (!accessHeaders)
		throw new Error(
			'CLOUDFLARE_ACCESS_CLIENT_ID and CLOUDFLARE_ACCESS_CLIENT_SECRET are required for the protected Worker.',
		);
	const probes = await runDeploymentSmoke(origin, fetchImpl, accessHeaders);
	const identity = await readBuildIdentity(origin, fetchImpl, accessHeaders);
	const verified =
		identity.commitSha?.toLowerCase() === sha && identity.environment === environment;
	const accessEnforced =
		environment === 'production' ? await isAccessEnforced(origin, fetchImpl) : null;
	const contactWhatsAppConfigured =
		environment === 'production'
			? await isContactWhatsAppConfigured(origin, fetchImpl, accessHeaders)
			: null;
	const failureCodes = [
		...probes.failureCodes,
		...(verified ? [] : ['build_identity_failed']),
		...(accessEnforced === false ? ['access_not_enforced'] : []),
		...(contactWhatsAppConfigured === false ? ['contact_whatsapp_missing'] : []),
	];
	return {
		probes,
		identity: { ...identity, verified },
		accessEnforced,
		contactWhatsAppConfigured,
		passed: failureCodes.length === 0,
		failureCodes,
	};
}

/** wa.me digits the Worker would ship when CONTACT_WHATSAPP is missing. */
const PLACEHOLDER_CONTACT_PHONE = '521000000000';

/** True when `/api/whatsapp` answers 302 to wa.me with a real number; never follows the redirect. */
async function isContactWhatsAppConfigured(
	origin: URL,
	fetchImpl: FetchLike,
	accessHeaders: Record<string, string>,
): Promise<boolean> {
	try {
		const response = await fetchImpl(`${origin.origin}/api/whatsapp`, {
			method: 'GET',
			redirect: 'manual',
			signal: AbortSignal.timeout(10_000),
			headers: { ...accessHeaders, 'User-Agent': 'celebra-me-post-deploy-smoke/1' },
		});
		const phone = response.headers
			.get('location')
			?.match(/^https:\/\/wa\.me\/(\d{10,15})(?:\?|$)/u)?.[1];
		return (
			response.status === 302 && phone !== undefined && phone !== PLACEHOLDER_CONTACT_PHONE
		);
	} catch {
		return false;
	}
}

function createEvidence(input: {
	environment: PostDeployEnvironment;
	sha: string;
	versionId: string | null;
	runId: string;
	startedAt: string;
	completedAt: string | null;
	result: CloudflareWorkerSmokeResult | null;
}): PostDeployEvidence {
	const status =
		input.result === null ? 'UNVERIFIED' : input.result.passed ? 'VERIFIED' : 'FAILED';
	const payload = input.result
		? {
				...toPostDeployPayload(input.result.probes),
				build_identity_verified: input.result.identity.verified,
			}
		: {
				probe_count: 0,
				failed_probe_count: 0,
				network_retry_count: 0,
				runtime_health_verified: null,
				asset_verified: null,
				auth_boundary_verified: null,
				header_policy_verified: null,
				build_identity_verified: null,
				probe_results: [],
			};
	const evidence: PostDeployEvidence = {
		schemaVersion: OPERATIONAL_EVIDENCE_SCHEMA_VERSION,
		check: 'post_deploy_smoke',
		environment: input.environment,
		runId: input.runId,
		startedAt: input.startedAt,
		completedAt: input.completedAt,
		observedAt: input.completedAt ?? input.startedAt,
		status,
		reasonCode:
			status === 'UNVERIFIED'
				? 'post_deploy_smoke_started'
				: status === 'VERIFIED'
					? 'post_deploy_smoke_passed'
					: 'post_deploy_smoke_failed',
		source: 'github_actions',
		ownerAction:
			status === 'VERIFIED'
				? 'No se requiere acción; conserve el Job Summary como evidencia.'
				: 'Revise el Job Summary; la versión no se promueve hasta que el smoke pase.',
		commitSha: input.sha,
		deploymentId: sanitizeOperationalCorrelationId(input.versionId) ?? undefined,
		payload,
	};
	assertOperationalEvidenceSafe(evidence);
	return evidence;
}

function emit(evidence: PostDeployEvidence, phase: 'started' | 'completed'): void {
	const serialized = serializeOperationalEvidenceEvent(
		'post_deploy_smoke_summary',
		phase,
		evidence,
	);
	if (evidence.status === 'FAILED') console.error(serialized);
	else console.info(serialized);
}

function parseArgs(argv: string[]): {
	environment: PostDeployEnvironment;
	url: string;
	sha: string;
	versionId: string | null;
} {
	const value = (name: string) => {
		const inline = argv.find((arg) => arg.startsWith(`${name}=`));
		if (inline) return inline.slice(name.length + 1);
		const index = argv.indexOf(name);
		return index >= 0 ? argv[index + 1] : undefined;
	};
	const environment = value('--env') ?? 'preview';
	const url = value('--url');
	const sha = value('--sha');
	if ((environment !== 'preview' && environment !== 'production') || !url || !sha)
		throw new Error(
			'Usage: cloudflare-worker-smoke.ts [--env preview|production] --url <origin> --sha <sha> [--version-id <id>]',
		);
	return { environment, url, sha, versionId: value('--version-id') ?? null };
}

async function main(): Promise<void> {
	const options = parseArgs(process.argv.slice(2).filter((arg) => arg !== '--'));
	const runId = randomUUID();
	const startedAt = new Date().toISOString();
	const sha = options.sha.trim().toLowerCase();
	emit(
		createEvidence({
			environment: options.environment,
			sha,
			versionId: options.versionId,
			runId,
			startedAt,
			completedAt: null,
			result: null,
		}),
		'started',
	);
	const result = await runCloudflareWorkerSmoke(
		{ url: options.url, sha, environment: options.environment },
		fetch,
		buildCloudflareAccessHeaders(process.env),
	);
	const evidence = createEvidence({
		environment: options.environment,
		sha,
		versionId: options.versionId,
		runId,
		startedAt,
		completedAt: new Date().toISOString(),
		result,
	});
	emit(evidence, 'completed');
	const summaryPath = process.env.GITHUB_STEP_SUMMARY;
	if (summaryPath) appendFileSync(summaryPath, formatEvidenceSummary(evidence), 'utf8');
	if (!result.passed) {
		console.error(`POST_DEPLOY_FAILURE_CODES=${result.failureCodes.join(',')}`);
		process.exitCode = 1;
	}
}

if (process.argv[1] && /^cloudflare-worker-smoke\.(?:ts|js)$/.test(basename(process.argv[1]))) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : 'Cloudflare Worker smoke failed.');
		process.exitCode = 1;
	});
}
