import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { basename } from 'node:path';
import {
	OPERATIONAL_EVIDENCE_SCHEMA_VERSION,
	assertOperationalEvidenceSafe,
	serializeOperationalEvidenceEvent,
	type OperationalAggregatePayload,
	type OperationalAggregatePayloadValue,
	type OperationalEvidenceV1,
} from '../../src/lib/operations/operational-evidence.ts';
import { listPublishedInvitationDefinitions } from '../provision/invitations/registry.ts';
import { discoverDemoCases, visualPageRoute } from '../screenshot/visual-coverage-contract.ts';

export type PostDeployEnvironment = 'preview' | 'production';

export type PostDeployProbeId =
	| 'homepage'
	| 'login'
	| 'invitation'
	| 'demo'
	| 'auth_boundary'
	| 'runtime_health'
	| 'header_policy'
	| 'asset';
/** Page probes target `{eventType}:{slug}`; evidence tokens cannot carry a path. */
export type PostDeployProbeTarget =
	| 'root'
	| 'login'
	| 'auth_session'
	| 'health'
	| 'root_headers'
	| 'astro_asset'
	| `${string}:${string}`;

/** A public invitation or demo page the smoke opens. */
export interface SmokePageRoute {
	kind: 'invitation' | 'demo';
	eventType: string;
	slug: string;
}
export type PostDeployProbeFailureClass =
	'none' | 'network_error' | 'http_status' | 'json_invalid' | 'contract_mismatch';

export interface PostDeployProbeResult extends Record<string, OperationalAggregatePayloadValue> {
	probe: PostDeployProbeId;
	target: PostDeployProbeTarget;
	status_code: number | null;
	failure_class: PostDeployProbeFailureClass;
	retry_count: number;
	duration_ms: number;
}

export interface PostDeployPayload extends OperationalAggregatePayload {
	probe_count: number;
	failed_probe_count: number;
	network_retry_count: number;
	runtime_health_verified: boolean | null;
	asset_verified: boolean | null;
	auth_boundary_verified: boolean | null;
	header_policy_verified: boolean | null;
	probe_results: PostDeployProbeResult[];
}

export type PostDeployEvidence = OperationalEvidenceV1<'post_deploy_smoke', PostDeployPayload>;

export interface ProductionSmokeResult {
	probeCount: number;
	failedProbeCount: number;
	networkRetryCount: number;
	runtimeHealthVerified: boolean;
	assetVerified: boolean;
	authBoundaryVerified: boolean;
	headerPolicyVerified: boolean;
	failureCodes: string[];
	probeResults: PostDeployProbeResult[];
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const TRANSIENT_STATUSES = new Set([502, 503, 504]);
const PRODUCTION_HOSTS = new Set(['celebra-me.com', 'www.celebra-me.com']);

/**
 * Pages come from the repository catalog: published, non-expired invitation definitions and
 * every demo under `src/invitations/demos`. Nothing is listed by hand.
 */
export function listSmokePageRoutes(now = new Date()): SmokePageRoute[] {
	return [
		...listPublishedInvitationDefinitions(now).map((definition) => ({
			kind: 'invitation' as const,
			eventType: definition.eventType,
			slug: definition.slug,
		})),
		...discoverDemoCases().map((demo) => ({
			kind: 'demo' as const,
			eventType: demo.eventType,
			slug: demo.slug,
		})),
	];
}

const PAGE_TITLE_PATTERN = /<title>[^<]+<\/title>/i;

/**
 * A rendered page is 200 with a non-empty title. An invitation may also answer 403: that is
 * the neutral page for an invitation the administrator disabled (for example /xv/mia-pintor),
 * a database state the catalog cannot know.
 */
function isExpectedPageResponse(route: SmokePageRoute, status: number, html: string): boolean {
	if (status === 200) return PAGE_TITLE_PATTERN.test(html);
	return route.kind === 'invitation' && status === 403;
}

function requireValue(value: string, name: string): string {
	const trimmed = value.trim();
	if (!trimmed) throw new Error(`${name} is required.`);
	return trimmed;
}

/**
 * Hosts a URL smoke may target: the Production domain and its subdomains, and Cloudflare
 * Workers hosts.
 */
function isApprovedSmokeHost(hostname: string): boolean {
	return (
		PRODUCTION_HOSTS.has(hostname) ||
		hostname.endsWith('.celebra-me.com') ||
		hostname.endsWith('.workers.dev')
	);
}

function parseDeploymentOrigin(rawUrl: string): URL {
	let url: URL;
	try {
		url = new URL(requireValue(rawUrl, 'Deployment URL'));
	} catch {
		throw new Error('Deployment URL must be an absolute URL.');
	}
	if (
		url.protocol !== 'https:' ||
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		(url.pathname !== '/' && url.pathname !== '')
	) {
		throw new Error('Deployment URL must contain only an HTTPS origin.');
	}
	if (!isApprovedSmokeHost(url.hostname.toLowerCase())) {
		throw new Error('URL smoke rejected an unapproved host.');
	}
	return url;
}

function appendSummary(markdown: string): void {
	const path = process.env.GITHUB_STEP_SUMMARY;
	if (path) appendFileSync(path, markdown, 'utf8');
}

function createPostDeployEvidence(input: {
	environment: PostDeployEnvironment;
	source?: string;
	failureOwnerAction: string;
	runId: string;
	startedAt: string;
	completedAt: string | null;
	status: 'VERIFIED' | 'FAILED' | 'UNVERIFIED';
	reasonCode: string;
	payload: PostDeployPayload;
}): PostDeployEvidence {
	const observedAt = input.completedAt ?? input.startedAt;
	const evidence: PostDeployEvidence = {
		schemaVersion: OPERATIONAL_EVIDENCE_SCHEMA_VERSION,
		check: 'post_deploy_smoke',
		environment: input.environment,
		runId: input.runId,
		startedAt: input.startedAt,
		completedAt: input.completedAt,
		observedAt,
		status: input.status,
		reasonCode: input.reasonCode,
		source: input.source ?? 'github_actions',
		ownerAction:
			input.status === 'VERIFIED'
				? 'No se requiere acción; conserve el Job Summary como evidencia.'
				: input.failureOwnerAction,
		payload: input.payload,
	};
	assertOperationalEvidenceSafe(evidence);
	return evidence;
}

async function fetchWithOneRetry(
	fetchImpl: FetchLike,
	url: string,
): Promise<{ response: Response; retryCount: number }> {
	let lastError: unknown = null;
	let retryCount = 0;
	for (let attempt = 0; attempt < 2; attempt += 1) {
		try {
			const response = await fetchImpl(url, {
				method: 'GET',
				redirect: 'manual',
				signal: AbortSignal.timeout(10_000),
				headers: { 'User-Agent': 'celebra-me-post-deploy-smoke/1' },
			});
			if (attempt === 0 && TRANSIENT_STATUSES.has(response.status)) {
				retryCount += 1;
				continue;
			}
			return { response, retryCount };
		} catch (error: unknown) {
			lastError = error;
			if (attempt === 0) {
				retryCount += 1;
				continue;
			}
		}
	}
	throw lastError instanceof Error ? lastError : new Error('Network request failed.');
}

function hasExpectedSecurityHeaders(headers: Headers): boolean {
	return (
		headers.get('x-content-type-options')?.toLowerCase() === 'nosniff' &&
		headers.get('x-frame-options')?.toLowerCase() === 'deny' &&
		headers.get('referrer-policy')?.toLowerCase() === 'strict-origin-when-cross-origin' &&
		(headers.get('permissions-policy')?.includes('camera=()') ?? false) &&
		(headers.get('strict-transport-security')?.includes('max-age=') ?? false)
	);
}

export async function runProductionSmoke(
	baseUrl: string,
	fetchImpl: FetchLike = fetch,
	access: { pages?: readonly SmokePageRoute[] } = {},
): Promise<ProductionSmokeResult> {
	const origin = parseDeploymentOrigin(baseUrl);
	// No credentials: the application session probe must remain anonymous.
	return runDeploymentSmoke(origin, fetchImpl, {}, access.pages);
}

/**
 * Public probes of one deployment origin. `accessHeaders` (for example a Cloudflare Access
 * service token) travel only to that origin; redirects are never followed.
 */
export async function runDeploymentSmoke(
	origin: URL,
	fetchImpl: FetchLike,
	accessHeaders: Record<string, string>,
	pages: readonly SmokePageRoute[] = listSmokePageRoutes(),
): Promise<ProductionSmokeResult> {
	const baseUrl = origin.origin;
	const request: FetchLike = (url, init) => {
		if (new URL(url).origin !== origin.origin)
			throw new Error('Smoke request rejected a different origin.');
		const headers = new Headers(init?.headers);
		for (const [name, value] of Object.entries(accessHeaders)) headers.set(name, value);
		return fetchImpl(url, { ...init, headers, redirect: 'manual' });
	};
	const failures: string[] = [];
	let retries = 0;
	let runtimeHealthVerified = false;
	let assetVerified = false;
	let authBoundaryVerified = false;
	let headerPolicyVerified = false;
	let rootHtml: string | null = null;
	let rootHeaders: Headers | null = null;
	let rootStatusCode: number | null = null;
	const probeResults: PostDeployProbeResult[] = [];

	async function probe(
		code: string,
		probeId: PostDeployProbeId,
		target: PostDeployProbeTarget,
		action: () => Promise<{
			passed: boolean;
			statusCode: number | null;
			failureClass: PostDeployProbeFailureClass;
			retryCount: number;
		}>,
	): Promise<void> {
		const startedAt = performance.now();
		try {
			const result = await action();
			probeResults.push({
				probe: probeId,
				target,
				status_code: result.statusCode,
				failure_class: result.passed ? 'none' : result.failureClass,
				retry_count: result.retryCount,
				duration_ms: Math.round(performance.now() - startedAt),
			});
			retries += result.retryCount;
			if (!result.passed) failures.push(code);
		} catch {
			probeResults.push({
				probe: probeId,
				target,
				status_code: null,
				failure_class: 'network_error',
				retry_count: 1,
				duration_ms: Math.round(performance.now() - startedAt),
			});
			retries += 1;
			failures.push(code);
		}
	}

	await probe('homepage_failed', 'homepage', 'root', async () => {
		const { response, retryCount } = await fetchWithOneRetry(request, `${baseUrl}/`);
		rootHeaders = response.headers;
		rootStatusCode = response.status;
		rootHtml = await response.text();
		return {
			passed: response.status === 200,
			statusCode: response.status,
			failureClass: 'http_status',
			retryCount,
		};
	});
	await probe('login_failed', 'login', 'login', async () => {
		const { response, retryCount } = await fetchWithOneRetry(request, `${baseUrl}/login`);
		return {
			passed: response.status === 200,
			statusCode: response.status,
			failureClass: 'http_status',
			retryCount,
		};
	});
	for (const route of pages) {
		const target = `${route.eventType}:${route.slug}` as const;
		await probe(`${route.kind}_failed:${target}`, route.kind, target, async () => {
			const { response, retryCount } = await fetchWithOneRetry(
				request,
				`${baseUrl}${visualPageRoute(route)}`,
			);
			const html = await response.text();
			return {
				passed: isExpectedPageResponse(route, response.status, html),
				statusCode: response.status,
				failureClass: response.status === 200 ? 'contract_mismatch' : 'http_status',
				retryCount,
			};
		});
	}
	await probe('auth_boundary_failed', 'auth_boundary', 'auth_session', async () => {
		const { response, retryCount } = await fetchWithOneRetry(
			request,
			`${baseUrl}/api/auth/session`,
		);
		authBoundaryVerified =
			response.status === 401 &&
			(response.headers.get('cache-control')?.includes('no-store') ?? false) &&
			!response.headers.has('set-cookie');
		return {
			passed: authBoundaryVerified,
			statusCode: response.status,
			failureClass: response.status !== 401 ? 'http_status' : 'contract_mismatch',
			retryCount,
		};
	});
	await probe('runtime_health_failed', 'runtime_health', 'health', async () => {
		const { response, retryCount } = await fetchWithOneRetry(request, `${baseUrl}/api/health`);
		if (response.status !== 200)
			return {
				passed: false,
				statusCode: response.status,
				failureClass: 'http_status',
				retryCount,
			};
		let payload: {
			status?: unknown;
			checks?: { runtime?: { status?: unknown } };
		};
		try {
			payload = (await response.json()) as typeof payload;
		} catch {
			return {
				passed: false,
				statusCode: response.status,
				failureClass: 'json_invalid',
				retryCount,
			};
		}
		runtimeHealthVerified =
			payload?.status === 'healthy' && payload?.checks?.runtime?.status === 'ok';
		return {
			passed: runtimeHealthVerified,
			statusCode: response.status,
			failureClass: 'contract_mismatch',
			retryCount,
		};
	});
	await probe('header_policy_failed', 'header_policy', 'root_headers', async () => {
		headerPolicyVerified = rootHeaders !== null && hasExpectedSecurityHeaders(rootHeaders);
		return {
			passed: headerPolicyVerified,
			statusCode: rootStatusCode,
			failureClass: 'contract_mismatch',
			retryCount: 0,
		};
	});
	await probe('asset_failed', 'asset', 'astro_asset', async () => {
		const match = rootHtml?.match(/(?:src|href)=["']([^"']*\/_astro\/[^"']+)["']/i);
		if (!match?.[1])
			return {
				passed: false,
				statusCode: null,
				failureClass: 'contract_mismatch',
				retryCount: 0,
			};
		const assetUrl = new URL(match[1], baseUrl);
		if (assetUrl.origin !== new URL(baseUrl).origin)
			return {
				passed: false,
				statusCode: null,
				failureClass: 'contract_mismatch',
				retryCount: 0,
			};
		const { response, retryCount } = await fetchWithOneRetry(request, assetUrl.toString());
		assetVerified =
			response.status === 200 &&
			(response.headers.get('cache-control')?.includes('immutable') ?? false);
		return {
			passed: assetVerified,
			statusCode: response.status,
			failureClass: response.status !== 200 ? 'http_status' : 'contract_mismatch',
			retryCount,
		};
	});

	return {
		probeCount: probeResults.length,
		failedProbeCount: failures.length,
		networkRetryCount: retries,
		runtimeHealthVerified,
		assetVerified,
		authBoundaryVerified,
		headerPolicyVerified,
		failureCodes: failures,
		probeResults,
	};
}

export function toPostDeployPayload(result: ProductionSmokeResult): PostDeployPayload {
	return {
		probe_count: result.probeCount,
		failed_probe_count: result.failedProbeCount,
		network_retry_count: result.networkRetryCount,
		runtime_health_verified: result.runtimeHealthVerified,
		asset_verified: result.assetVerified,
		auth_boundary_verified: result.authBoundaryVerified,
		header_policy_verified: result.headerPolicyVerified,
		probe_results: result.probeResults,
	};
}

function emitEvidence(evidence: PostDeployEvidence, phase: 'started' | 'completed'): void {
	const serialized = serializeOperationalEvidenceEvent(
		'post_deploy_smoke_summary',
		phase,
		evidence,
	);
	if (evidence.status === 'FAILED') console.error(serialized);
	else console.info(serialized);
}

export function formatEvidenceSummary(evidence: PostDeployEvidence): string {
	const tableRows =
		evidence.payload.probe_results.length > 0
			? [
					'| Probe | Target | Status | Class | Retries | Duration ms |',
					'| --- | --- | ---: | --- | ---: | ---: |',
					...evidence.payload.probe_results.map(
						(result) =>
							`| ${result.probe} | ${result.target} | ${result.status_code ?? 'UNVERIFIED'} | ${result.failure_class} | ${result.retry_count} | ${result.duration_ms} |`,
					),
					'',
				]
			: [];
	return [
		`## Post-deploy smoke — ${evidence.environment}`,
		'',
		`- Status: \`${evidence.status}\``,
		`- Reason: \`${evidence.reasonCode}\``,
		`- Run: \`${evidence.runId}\``,
		`- Observed at: \`${evidence.observedAt}\``,
		`- Owner action: ${evidence.ownerAction}`,
		'',
		...tableRows,
	].join('\n');
}

function writeEvidenceSummary(evidence: PostDeployEvidence): void {
	appendSummary(formatEvidenceSummary(evidence));
}

export const DEFAULT_SMOKE_BASE_URL = 'https://www.celebra-me.com';

/**
 * Base URL of a URL smoke: `--base-url=<origin>`, else `SMOKE_BASE_URL`, else Production.
 * Example: `check --base-url=https://celebra-me.example.workers.dev` for a Cloudflare Worker.
 */
export function resolveSmokeBaseUrl(
	args: readonly string[],
	env: NodeJS.ProcessEnv = process.env,
): string {
	const flag = args.find((arg) => arg.startsWith('--base-url='));
	const raw =
		flag?.slice('--base-url='.length) || env.SMOKE_BASE_URL?.trim() || DEFAULT_SMOKE_BASE_URL;
	return parseDeploymentOrigin(raw).origin;
}

/** Read-only smoke against an approved host. */
async function checkCommand(args: readonly string[]): Promise<void> {
	const baseUrl = resolveSmokeBaseUrl(args);
	const hostname = new URL(baseUrl).hostname;
	const startedAt = new Date().toISOString();
	const result = await runProductionSmoke(baseUrl, fetch);
	const passed = result.failedProbeCount === 0;
	const evidence = createPostDeployEvidence({
		environment: 'production',
		source: process.env.GITHUB_ACTIONS === 'true' ? 'github_actions' : 'operator_cli',
		failureOwnerAction:
			'Revise el Job Summary y abra la página que falló en el host revisado; no ejecute rollback automático.',
		runId: randomUUID(),
		startedAt,
		completedAt: new Date().toISOString(),
		status: passed ? 'VERIFIED' : 'FAILED',
		reasonCode: passed ? 'url_smoke_passed' : 'url_smoke_failed',
		payload: toPostDeployPayload(result),
	});
	emitEvidence(evidence, 'completed');
	writeEvidenceSummary(evidence);
	appendSummary(`\nChecked host: \`${hostname}\`\n`);
	if (!passed) {
		console.error(`POST_DEPLOY_FAILURE_CODES=${result.failureCodes.join(',')}`);
		process.exitCode = 1;
	}
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (args[0] === '--') args.shift();
	if (args[0] === 'check' && args.slice(1).every((arg) => arg.startsWith('--base-url='))) {
		return checkCommand(args.slice(1));
	}
	throw new Error('Usage: post-deploy-smoke.ts check [--base-url=<origin>]');
}

if (process.argv[1] && /^post-deploy-smoke\.(?:ts|js)$/.test(basename(process.argv[1]))) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : 'Post-deploy smoke failed.');
		process.exitCode = 1;
	});
}
