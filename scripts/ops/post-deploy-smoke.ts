import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { basename } from 'node:path';
import {
	OPERATIONAL_EVIDENCE_SCHEMA_VERSION,
	assertOperationalEvidenceSafe,
	serializeOperationalEvidenceEvent,
	sanitizeOperationalCorrelationId,
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
	event: 'vercel.deployment.success' | 'vercel.deployment.promoted';
	environment: PostDeployEnvironment;
	projectId: string;
	deploymentId: string;
	baseUrl: string;
	commitSha: string;
	gitRef: string;
	hostname: string;
}

interface PostDeployPayload extends Record<string, string | number | boolean | null> {
	probe_count: number;
	failed_probe_count: number;
	network_retry_count: number;
	runtime_health_verified: boolean | null;
	asset_verified: boolean | null;
	auth_boundary_verified: boolean | null;
	header_policy_verified: boolean | null;
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
	if (event === 'vercel.deployment.success' && environment === 'preview') return 'preview';
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
	};
}

async function fetchWithOneRetry(
	fetchImpl: FetchLike,
	url: string,
	onRetry: () => void,
): Promise<Response> {
	let lastError: unknown = null;
	for (let attempt = 0; attempt < 2; attempt += 1) {
		try {
			const response = await fetchImpl(url, {
				method: 'GET',
				redirect: 'manual',
				signal: AbortSignal.timeout(10_000),
				headers: { 'User-Agent': 'celebra-me-post-deploy-smoke/1' },
			});
			if (attempt === 0 && TRANSIENT_STATUSES.has(response.status)) {
				onRetry();
				continue;
			}
			return response;
		} catch (error: unknown) {
			lastError = error;
			if (attempt === 0) {
				onRetry();
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

	async function probe(code: string, action: () => Promise<boolean>): Promise<void> {
		try {
			if (!(await action())) failures.push(code);
		} catch {
			failures.push(code);
		}
	}

	await probe('homepage_failed', async () => {
		const response = await fetchWithOneRetry(fetchImpl, `${baseUrl}/`, () => {
			retries += 1;
		});
		rootHeaders = response.headers;
		rootHtml = await response.text();
		return response.status === 200;
	});
	await probe('login_failed', async () => {
		const response = await fetchWithOneRetry(fetchImpl, `${baseUrl}/login`, () => {
			retries += 1;
		});
		return response.status === 200;
	});
	await probe('demo_failed', async () => {
		const response = await fetchWithOneRetry(
			fetchImpl,
			`${baseUrl}/xv/demo-xv-editorial`,
			() => {
				retries += 1;
			},
		);
		return response.status === 200;
	});
	await probe('auth_boundary_failed', async () => {
		const response = await fetchWithOneRetry(fetchImpl, `${baseUrl}/api/auth/session`, () => {
			retries += 1;
		});
		authBoundaryVerified =
			response.status === 401 &&
			(response.headers.get('cache-control')?.includes('no-store') ?? false) &&
			!response.headers.has('set-cookie');
		return authBoundaryVerified;
	});
	await probe('runtime_health_failed', async () => {
		const response = await fetchWithOneRetry(fetchImpl, `${baseUrl}/api/health`, () => {
			retries += 1;
		});
		if (response.status !== 200) return false;
		const payload = (await response.json()) as {
			status?: unknown;
			checks?: { runtime?: { status?: unknown } };
		};
		runtimeHealthVerified =
			payload.status === 'healthy' && payload.checks?.runtime?.status === 'ok';
		return runtimeHealthVerified;
	});
	await probe('header_policy_failed', async () => {
		headerPolicyVerified = rootHeaders !== null && hasExpectedSecurityHeaders(rootHeaders);
		return headerPolicyVerified;
	});
	await probe('asset_failed', async () => {
		const match = rootHtml?.match(/(?:src|href)=["']([^"']*\/_astro\/[^"']+)["']/i);
		if (!match?.[1]) return false;
		const assetUrl = new URL(match[1], baseUrl);
		if (assetUrl.origin !== new URL(baseUrl).origin) return false;
		const response = await fetchWithOneRetry(fetchImpl, assetUrl.toString(), () => {
			retries += 1;
		});
		assetVerified =
			response.status === 200 &&
			(response.headers.get('cache-control')?.includes('immutable') ?? false);
		return assetVerified;
	});

	return {
		probeCount: 7,
		failedProbeCount: failures.length,
		networkRetryCount: retries,
		runtimeHealthVerified,
		assetVerified,
		authBoundaryVerified,
		headerPolicyVerified,
		failureCodes: failures,
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

function writeEvidenceSummary(evidence: PostDeployEvidence): void {
	appendSummary(
		[
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
		].join('\n'),
	);
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
	const command = process.argv[2];
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
