import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { basename } from 'node:path';
import {
	OPERATIONAL_EVIDENCE_SCHEMA_VERSION,
	assertOperationalEvidenceSafe,
	serializeOperationalEvidenceEvent,
	sanitizeOperationalCorrelationId,
	type OperationalAggregatePayload,
	type OperationalAggregatePayloadValue,
	type OperationalEvidenceV1,
} from '../../src/lib/operations/operational-evidence.ts';
import {
	PREVIEW_SUPABASE_PROJECT_REF,
	validateReadOnlyPreviewEnvironment,
} from '../playwright/preview-environment.ts';

export type PostDeployEnvironment = 'preview' | 'production';

export interface VercelDispatchInput {
	event: string;
	environment: string;
	projectId: string;
	expectedProjectId: string;
	deploymentId: string;
	url: string;
	commitSha: string;
	gitRef: string;
}

export interface ValidatedVercelDispatch {
	event: 'vercel.deployment.ready' | 'vercel.deployment.promoted';
	environment: PostDeployEnvironment;
	projectId: string;
	deploymentId: string;
	baseUrl: string;
	commitSha: string;
	gitRef: string;
	hostname: string;
}

export type PostDeployProbeId =
	'homepage' | 'login' | 'demo' | 'auth_boundary' | 'runtime_health' | 'header_policy' | 'asset';
export type PostDeployProbeTarget =
	'root' | 'login' | 'demo' | 'auth_session' | 'health' | 'root_headers' | 'astro_asset';
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
const VERCEL_ID_PATTERN = /^(?:dpl_|prj_)[A-Za-z0-9_-]+$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/i;

function requireValue(value: string, name: string): string {
	const trimmed = value.trim();
	if (!trimmed) throw new Error(`${name} is required.`);
	return trimmed;
}

function validateDispatchTransition(event: string, environment: string): PostDeployEnvironment {
	if (event === 'vercel.deployment.ready' && environment === 'preview') return 'preview';
	if (event === 'vercel.deployment.promoted' && environment === 'production') {
		return 'production';
	}
	throw new Error('Dispatch event does not match the approved environment transition.');
}

function validateDispatchProject(projectId: string, expectedProjectId: string): string {
	if (projectId !== expectedProjectId || !VERCEL_ID_PATTERN.test(projectId)) {
		throw new Error('Dispatch rejected a different or invalid Vercel project id.');
	}
	return projectId;
}

function parseDeploymentOrigin(rawUrl: string, environment: PostDeployEnvironment): URL {
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
	const hostname = url.hostname.toLowerCase();
	if (
		environment === 'production' &&
		!PRODUCTION_HOSTS.has(hostname) &&
		!hostname.endsWith('.vercel.app')
	) {
		throw new Error('Production smoke rejected an unapproved host.');
	}
	return url;
}

export function validateVercelDispatch(input: VercelDispatchInput): ValidatedVercelDispatch {
	const event = requireValue(input.event, 'Dispatch event');
	const environment = validateDispatchTransition(
		event,
		requireValue(input.environment, 'Deployment environment'),
	);
	const expectedProjectId = requireValue(input.expectedProjectId, 'Expected Vercel project id');
	const projectId = validateDispatchProject(
		requireValue(input.projectId, 'Vercel project id'),
		expectedProjectId,
	);
	const deploymentId = requireValue(input.deploymentId, 'Vercel deployment id');
	if (!VERCEL_ID_PATTERN.test(deploymentId)) {
		throw new Error('Dispatch deployment id is invalid.');
	}
	const commitSha = requireValue(input.commitSha, 'Deployment commit SHA');
	if (!SHA_PATTERN.test(commitSha)) throw new Error('Deployment commit SHA must be exact.');
	const gitRef = requireValue(input.gitRef, 'Deployment git ref');
	if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(gitRef)) {
		throw new Error('Deployment git ref is invalid.');
	}
	const url = parseDeploymentOrigin(input.url, environment);
	const hostname = url.hostname.toLowerCase();
	return {
		event: event as ValidatedVercelDispatch['event'],
		environment,
		projectId,
		deploymentId,
		baseUrl: url.origin,
		commitSha: commitSha.toLowerCase(),
		gitRef,
		hostname,
	};
}

function dispatchFromEnvironment(): ValidatedVercelDispatch {
	const dispatch = validateVercelDispatch({
		event: process.env.VERCEL_DISPATCH_EVENT ?? '',
		environment: process.env.VERCEL_DISPATCH_ENVIRONMENT ?? '',
		projectId: process.env.VERCEL_DISPATCH_PROJECT_ID ?? '',
		expectedProjectId: process.env.VERCEL_DISPATCH_EXPECTED_PROJECT_ID ?? '',
		deploymentId: process.env.VERCEL_DISPATCH_DEPLOYMENT_ID ?? '',
		url: process.env.VERCEL_DISPATCH_URL ?? '',
		commitSha: process.env.VERCEL_DISPATCH_COMMIT_SHA ?? '',
		gitRef: process.env.VERCEL_DISPATCH_GIT_REF ?? '',
	});
	if (dispatch.environment === 'preview') {
		validateReadOnlyPreviewEnvironment({
			...process.env,
			PLAYWRIGHT_BASE_URL: dispatch.baseUrl,
			PLAYWRIGHT_APPROVED_PREVIEW_DEPLOYMENT_HOST: dispatch.hostname,
			PLAYWRIGHT_ALLOW_PREVIEW_FIXTURE_PROVISIONING: 'false',
			PLAYWRIGHT_ALLOW_PREVIEW_PUBLICATION: 'false',
			PLAYWRIGHT_PREVIEW_DEBUG_ARTIFACTS: 'false',
			PLAYWRIGHT_PREVIEW_SUPABASE_URL: `https://${PREVIEW_SUPABASE_PROJECT_REF}.supabase.co`,
			VERCEL_AUTOMATION_BYPASS_SECRET: 'dispatch-preflight',
		});
	}
	return dispatch;
}

function appendEnvironment(name: string, value: string): void {
	const path = process.env.GITHUB_ENV;
	if (!path) return;
	if (!/^[A-Z][A-Z0-9_]{0,79}$/.test(name) || /[\r\n]/.test(value)) {
		throw new Error('GitHub environment output is invalid.');
	}
	appendFileSync(path, `${name}=${value}\n`, 'utf8');
}

function appendSummary(markdown: string): void {
	const path = process.env.GITHUB_STEP_SUMMARY;
	if (path) appendFileSync(path, markdown, 'utf8');
}

function createPostDeployEvidence(input: {
	dispatch: ValidatedVercelDispatch;
	runId: string;
	startedAt: string;
	completedAt: string | null;
	status: 'VERIFIED' | 'FAILED' | 'UNVERIFIED';
	reasonCode: string;
	payload: PostDeployPayload;
}): PostDeployEvidence {
	const observedAt = input.completedAt ?? input.startedAt;
	const deploymentId = sanitizeOperationalCorrelationId(input.dispatch.deploymentId);
	if (!deploymentId) throw new Error('Deployment correlation id is invalid.');
	const evidence: PostDeployEvidence = {
		schemaVersion: OPERATIONAL_EVIDENCE_SCHEMA_VERSION,
		check: 'post_deploy_smoke',
		environment: input.dispatch.environment,
		runId: input.runId,
		startedAt: input.startedAt,
		completedAt: input.completedAt,
		observedAt,
		status: input.status,
		reasonCode: input.reasonCode,
		source: 'github_actions',
		ownerAction:
			input.status === 'VERIFIED'
				? 'No se requiere acción; conserve el Job Summary como evidencia.'
				: input.dispatch.environment === 'preview'
					? 'Revise el Job Summary y corrija el SHA exacto antes de la promoción humana.'
					: 'Abra el deployment exacto en Vercel y revise el Job Summary; no ejecute rollback automático.',
		commitSha: input.dispatch.commitSha,
		deploymentId,
		payload: input.payload,
	};
	assertOperationalEvidenceSafe(evidence);
	return evidence;
}

function emptyPostDeployPayload(): PostDeployPayload {
	return {
		probe_count: 0,
		failed_probe_count: 0,
		network_retry_count: 0,
		runtime_health_verified: null,
		asset_verified: null,
		auth_boundary_verified: null,
		header_policy_verified: null,
		probe_results: [],
	};
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
): Promise<ProductionSmokeResult> {
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
		const { response, retryCount } = await fetchWithOneRetry(fetchImpl, `${baseUrl}/`);
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
		const { response, retryCount } = await fetchWithOneRetry(fetchImpl, `${baseUrl}/login`);
		return {
			passed: response.status === 200,
			statusCode: response.status,
			failureClass: 'http_status',
			retryCount,
		};
	});
	await probe('demo_failed', 'demo', 'demo', async () => {
		const { response, retryCount } = await fetchWithOneRetry(
			fetchImpl,
			`${baseUrl}/xv/demo-xv-editorial`,
		);
		return {
			passed: response.status === 200,
			statusCode: response.status,
			failureClass: 'http_status',
			retryCount,
		};
	});
	await probe('auth_boundary_failed', 'auth_boundary', 'auth_session', async () => {
		const { response, retryCount } = await fetchWithOneRetry(
			fetchImpl,
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
		const { response, retryCount } = await fetchWithOneRetry(
			fetchImpl,
			`${baseUrl}/api/health`,
		);
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
		const { response, retryCount } = await fetchWithOneRetry(fetchImpl, assetUrl.toString());
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

function resultPayload(result: ProductionSmokeResult): PostDeployPayload {
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
		`- Deployment: \`${evidence.deploymentId ?? 'UNVERIFIED'}\``,
		`- Commit: \`${evidence.commitSha ?? 'UNVERIFIED'}\``,
		`- Observed at: \`${evidence.observedAt}\``,
		`- Owner action: ${evidence.ownerAction}`,
		'',
		...tableRows,
	].join('\n');
}

function writeEvidenceSummary(evidence: PostDeployEvidence): void {
	appendSummary(formatEvidenceSummary(evidence));
}

async function validateCommand(): Promise<void> {
	const dispatch = dispatchFromEnvironment();
	appendEnvironment('POST_DEPLOY_ENVIRONMENT', dispatch.environment);
	appendEnvironment('POST_DEPLOY_BASE_URL', dispatch.baseUrl);
	appendEnvironment('POST_DEPLOY_COMMIT_SHA', dispatch.commitSha);
	appendEnvironment('POST_DEPLOY_DEPLOYMENT_ID', dispatch.deploymentId);
	appendEnvironment('POST_DEPLOY_APPROVED_HOST', dispatch.hostname);
	appendEnvironment('POST_DEPLOY_RUN_ID', randomUUID());
	appendEnvironment('POST_DEPLOY_STARTED_AT', new Date().toISOString());
	console.info(
		`Validated ${dispatch.environment} deployment ${dispatch.deploymentId} at ${dispatch.commitSha}.`,
	);
}

function dispatchFromValidatedEnvironment(): ValidatedVercelDispatch {
	return validateVercelDispatch({
		event: process.env.VERCEL_DISPATCH_EVENT ?? '',
		environment: process.env.POST_DEPLOY_ENVIRONMENT ?? '',
		projectId: process.env.VERCEL_DISPATCH_PROJECT_ID ?? '',
		expectedProjectId: process.env.VERCEL_DISPATCH_EXPECTED_PROJECT_ID ?? '',
		deploymentId: process.env.POST_DEPLOY_DEPLOYMENT_ID ?? '',
		url: process.env.POST_DEPLOY_BASE_URL ?? '',
		commitSha: process.env.POST_DEPLOY_COMMIT_SHA ?? '',
		gitRef: process.env.VERCEL_DISPATCH_GIT_REF ?? '',
	});
}

async function productionCommand(): Promise<void> {
	const dispatch = dispatchFromValidatedEnvironment();
	if (dispatch.environment !== 'production')
		throw new Error('Production smoke requires Production.');
	const runId = requireValue(process.env.POST_DEPLOY_RUN_ID ?? '', 'Post-deploy run id');
	const startedAt = requireValue(process.env.POST_DEPLOY_STARTED_AT ?? '', 'Post-deploy start');
	emitEvidence(
		createPostDeployEvidence({
			dispatch,
			runId,
			startedAt,
			completedAt: null,
			status: 'UNVERIFIED',
			reasonCode: 'post_deploy_smoke_started',
			payload: emptyPostDeployPayload(),
		}),
		'started',
	);
	const result = await runProductionSmoke(dispatch.baseUrl);
	const passed = result.failedProbeCount === 0;
	const evidence = createPostDeployEvidence({
		dispatch,
		runId,
		startedAt,
		completedAt: new Date().toISOString(),
		status: passed ? 'VERIFIED' : 'FAILED',
		reasonCode: passed ? 'post_deploy_smoke_passed' : 'post_deploy_smoke_failed',
		payload: resultPayload(result),
	});
	emitEvidence(evidence, 'completed');
	writeEvidenceSummary(evidence);
	if (!passed) {
		console.error(`POST_DEPLOY_FAILURE_CODES=${result.failureCodes.join(',')}`);
		process.exitCode = 1;
	}
}

function previewEvidenceCommand(): void {
	const dispatch = dispatchFromValidatedEnvironment();
	if (dispatch.environment !== 'preview') throw new Error('Preview evidence requires Preview.');
	const runId = requireValue(process.env.POST_DEPLOY_RUN_ID ?? '', 'Post-deploy run id');
	const startedAt = requireValue(process.env.POST_DEPLOY_STARTED_AT ?? '', 'Post-deploy start');
	const phase = process.env.POST_DEPLOY_PREVIEW_PHASE;
	const passed = process.env.POST_DEPLOY_PREVIEW_OUTCOME === 'success';
	const started = phase === 'started';
	const evidence = createPostDeployEvidence({
		dispatch,
		runId,
		startedAt,
		completedAt: started ? null : new Date().toISOString(),
		status: started ? 'UNVERIFIED' : passed ? 'VERIFIED' : 'FAILED',
		reasonCode: started
			? 'post_deploy_smoke_started'
			: passed
				? 'post_deploy_smoke_passed'
				: 'post_deploy_smoke_failed',
		payload: {
			...emptyPostDeployPayload(),
			probe_count: started ? 0 : 1,
			failed_probe_count: started || passed ? 0 : 1,
		},
	});
	emitEvidence(evidence, started ? 'started' : 'completed');
	if (!started) writeEvidenceSummary(evidence);
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	if (args[0] === '--') args.shift();
	const command = args.length === 1 ? args[0] : undefined;
	if (command === 'validate') return validateCommand();
	if (command === 'production') return productionCommand();
	if (command === 'preview-evidence') return previewEvidenceCommand();
	throw new Error('Usage: post-deploy-smoke.ts <validate|production|preview-evidence>');
}

if (process.argv[1] && /^post-deploy-smoke\.(?:ts|js)$/.test(basename(process.argv[1]))) {
	main().catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : 'Post-deploy smoke failed.');
		process.exitCode = 1;
	});
}
