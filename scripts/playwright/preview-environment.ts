import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

const E2E_ENV_FILE = '.env.e2e.local';
const DEFAULT_PLAYWRIGHT_WEB_SERVER_URL = 'http://127.0.0.1:4321';
export const PREVIEW_OUTPUT_ROOT = 'output/playwright';
export const PREVIEW_SUPABASE_PROJECT_REF = 'iwipdvisoyerfdytuhwi';
export const PRODUCTION_SUPABASE_PROJECT_REF = 'ineitkdkyrxqyressllp';
export const PREVIEW_DRAFT_RATE_LIMIT_MAX_REQUESTS = 9;
export const PREVIEW_DRAFT_RATE_LIMIT_WINDOW_MS = 60_000;
/** Deterministic Preview synthetic fixture. Re-provision after `db:preview:sync-invitations` (events CASCADE reset). */
export const PREVIEW_FIXTURE_SLUG = 'e2e-preview-publication';
export const PREVIEW_FIXTURE_TITLE = 'Fixture E2E de publicación Preview';
export const PREVIEW_FIXTURE_DEMO_ID = 'demo-xv-jewelry-box';
export const PREVIEW_FIXTURE_EVENT_TYPE = 'xv';
export const EXPECTED_PREVIEW_ACCOUNT_EMAIL = 'preview@preview.com';
export const EXPECTED_PREVIEW_ACCOUNT_ROLE = 'super_admin';

const APPROVED_PREVIEW_ALIASES = new Set([
	'celebra-me.vercel.app',
	'celebra-me-fm-dev-mx-francisco-mendoza-s-projects.vercel.app',
]);
const PRODUCTION_DOMAINS = new Set(['celebra-me.com', 'www.celebra-me.com']);
const IMMUTABLE_PREVIEW_HOST_PATTERN =
	/^celebra-[a-z0-9]+-francisco-mendoza-s-projects\.vercel\.app$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface PreviewFixtureIdentity {
	id?: string;
	kind: string;
	slug: string | null;
	title: string;
	eventType: string;
	baseDemoId: string;
	clientName: string;
	clientEmail: string;
	clientWhatsapp: string;
	createdBy: string | null;
	hasRequest?: boolean;
	hasSubmission?: boolean;
}

export interface PlaywrightRuntimeEnvironment {
	baseURL: string;
	webServerURL: string;
	isExternal: boolean;
	isVercelPreview: boolean;
	targetEnvironment: 'local' | 'preview' | 'external';
	previewSupabaseProjectRef?: string;
	protectionHeaders?: Record<string, string>;
}

export type PreviewExecutionMode = 'read-only' | 'provision' | 'publication';

interface LoadEnvironmentOptions {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
}

function parseUrl(value: string, variableName: string): URL {
	try {
		return new URL(value);
	} catch {
		throw new Error(`${variableName} must be an absolute HTTP(S) URL.`);
	}
}

function isHttpUrl(url: URL): boolean {
	return url.protocol === 'http:' || url.protocol === 'https:';
}

function requireExplicitBoolean(env: NodeJS.ProcessEnv, name: string): boolean {
	const value = env[name];
	if (value !== 'true' && value !== 'false') {
		throw new Error(`${name} must be explicitly set to true or false.`);
	}
	return value === 'true';
}

function assertApprovedPreviewHost(url: URL, env: NodeJS.ProcessEnv): void {
	const hostname = url.hostname.toLowerCase();
	if (url.protocol !== 'https:') {
		throw new Error('PLAYWRIGHT_BASE_URL must use HTTPS for external Preview execution.');
	}
	if (PRODUCTION_DOMAINS.has(hostname)) {
		throw new Error('PLAYWRIGHT_BASE_URL must not target a Production domain.');
	}
	if (
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		(url.pathname && url.pathname !== '/')
	) {
		throw new Error('PLAYWRIGHT_BASE_URL must contain only the approved Preview origin.');
	}
	if (APPROVED_PREVIEW_ALIASES.has(hostname)) return;

	const explicitlyApprovedHost =
		env.PLAYWRIGHT_APPROVED_PREVIEW_DEPLOYMENT_HOST?.trim().toLowerCase();
	if (explicitlyApprovedHost === hostname && IMMUTABLE_PREVIEW_HOST_PATTERN.test(hostname)) {
		return;
	}

	throw new Error(
		'PLAYWRIGHT_BASE_URL must match an approved Preview alias or the explicitly approved immutable deployment host.',
	);
}

function validatePreviewSupabaseUrl(env: NodeJS.ProcessEnv): string {
	const rawUrl = env.PLAYWRIGHT_PREVIEW_SUPABASE_URL?.trim();
	if (!rawUrl) {
		throw new Error('Preview execution requires PLAYWRIGHT_PREVIEW_SUPABASE_URL.');
	}
	const url = parseUrl(rawUrl, 'PLAYWRIGHT_PREVIEW_SUPABASE_URL');
	const hostname = url.hostname.toLowerCase();
	if (url.protocol !== 'https:') {
		throw new Error('PLAYWRIGHT_PREVIEW_SUPABASE_URL must use HTTPS.');
	}
	if (
		url.username ||
		url.password ||
		url.search ||
		url.hash ||
		(url.pathname && url.pathname !== '/')
	) {
		throw new Error(
			'PLAYWRIGHT_PREVIEW_SUPABASE_URL must contain only the Preview project origin.',
		);
	}
	if (
		hostname === `${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co` ||
		hostname === `${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.com`
	) {
		throw new Error('Preview execution rejected the Production Supabase project.');
	}
	if (
		hostname !== `${PREVIEW_SUPABASE_PROJECT_REF}.supabase.co` &&
		hostname !== `${PREVIEW_SUPABASE_PROJECT_REF}.supabase.com`
	) {
		throw new Error(
			`PLAYWRIGHT_PREVIEW_SUPABASE_URL must target Preview project ${PREVIEW_SUPABASE_PROJECT_REF}.`,
		);
	}
	return PREVIEW_SUPABASE_PROJECT_REF;
}

function sameConfiguredServer(left: URL, right: URL): boolean {
	if (left.origin === right.origin) return true;
	const loopbackHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
	return (
		loopbackHosts.has(left.hostname) &&
		loopbackHosts.has(right.hostname) &&
		left.protocol === right.protocol &&
		left.port === right.port
	);
}

export function loadPlaywrightEnvironment(options: LoadEnvironmentOptions = {}): string[] {
	const cwd = options.cwd ?? process.cwd();
	const env = options.env ?? process.env;
	const path = resolve(cwd, E2E_ENV_FILE);
	if (!existsSync(path)) return [];

	const parsed = parseEnv(readFileSync(path, 'utf8'));
	const loaded: string[] = [];
	for (const [key, value] of Object.entries(parsed)) {
		if (env[key] !== undefined) continue;
		env[key] = value;
		loaded.push(key);
	}
	return loaded;
}

export function buildVercelProtectionHeaders(
	env: NodeJS.ProcessEnv,
): Record<string, string> | undefined {
	const bypassSecret = env.VERCEL_AUTOMATION_BYPASS_SECRET;
	if (!bypassSecret) return undefined;
	return {
		'x-vercel-protection-bypass': bypassSecret,
		'x-vercel-set-bypass-cookie': 'true',
	};
}

export function resolvePlaywrightRuntimeEnvironment(
	env: NodeJS.ProcessEnv = process.env,
): PlaywrightRuntimeEnvironment {
	const webServerURL = env.PLAYWRIGHT_WEB_SERVER_URL ?? DEFAULT_PLAYWRIGHT_WEB_SERVER_URL;
	const baseURL = env.PLAYWRIGHT_BASE_URL ?? webServerURL;
	const webServer = parseUrl(webServerURL, 'PLAYWRIGHT_WEB_SERVER_URL');
	const base = parseUrl(baseURL, 'PLAYWRIGHT_BASE_URL');
	if (!isHttpUrl(webServer) || !isHttpUrl(base)) {
		throw new Error('Playwright URLs must use HTTP or HTTPS.');
	}

	const isExternal = !sameConfiguredServer(base, webServer);
	const isVercelPreview =
		isExternal &&
		base.protocol === 'https:' &&
		(APPROVED_PREVIEW_ALIASES.has(base.hostname.toLowerCase()) ||
			IMMUTABLE_PREVIEW_HOST_PATTERN.test(base.hostname.toLowerCase()));
	const protectionHeaders = isVercelPreview ? buildVercelProtectionHeaders(env) : undefined;

	return {
		baseURL: base.toString().replace(/\/$/, ''),
		webServerURL: webServer.toString().replace(/\/$/, ''),
		isExternal,
		isVercelPreview,
		targetEnvironment: isVercelPreview ? 'preview' : isExternal ? 'external' : 'local',
		protectionHeaders,
	};
}

function validateReadOnlyPreviewTarget(env: NodeJS.ProcessEnv): PlaywrightRuntimeEnvironment {
	const baseUrl = env.PLAYWRIGHT_BASE_URL?.trim();
	if (!baseUrl) throw new Error('Preview execution requires PLAYWRIGHT_BASE_URL.');
	const parsedBaseUrl = parseUrl(baseUrl, 'PLAYWRIGHT_BASE_URL');
	assertApprovedPreviewHost(parsedBaseUrl, env);
	const runtime = resolvePlaywrightRuntimeEnvironment(env);
	if (!runtime.isVercelPreview) {
		throw new Error('PLAYWRIGHT_BASE_URL did not resolve to an approved Preview target.');
	}
	requireVariable(env, 'VERCEL_AUTOMATION_BYPASS_SECRET');
	return { ...runtime, previewSupabaseProjectRef: validatePreviewSupabaseUrl(env) };
}

export function validateReadOnlyPreviewEnvironment(
	env: NodeJS.ProcessEnv = process.env,
): PlaywrightRuntimeEnvironment {
	const runtime = validateReadOnlyPreviewTarget(env);
	validateExecutionGuards(env, 'read-only');
	return runtime;
}

export interface AuthenticatedPreviewEnvironment {
	runtime: PlaywrightRuntimeEnvironment;
	hostLogin: string;
	hostPassword: string;
	fixtureId: string;
	allowPublication: boolean;
	allowFixtureProvisioning: boolean;
	executionMode: PreviewExecutionMode;
}

interface PreviewValidationOptions {
	executionMode?: PreviewExecutionMode;
}

function validateExecutionGuards(
	env: NodeJS.ProcessEnv,
	executionMode: PreviewExecutionMode,
): {
	allowFixtureProvisioning: boolean;
	allowPublication: boolean;
} {
	const allowFixtureProvisioning = requireExplicitBoolean(
		env,
		'PLAYWRIGHT_ALLOW_PREVIEW_FIXTURE_PROVISIONING',
	);
	const allowPublication = requireExplicitBoolean(env, 'PLAYWRIGHT_ALLOW_PREVIEW_PUBLICATION');
	if (requireExplicitBoolean(env, 'PLAYWRIGHT_PREVIEW_DEBUG_ARTIFACTS')) {
		throw new Error('Preview execution requires debug artifacts to be false.');
	}
	if (executionMode === 'read-only' && (allowFixtureProvisioning || allowPublication)) {
		throw new Error('Read-only Preview execution requires both mutation guards to be false.');
	}
	if (executionMode === 'provision' && (!allowFixtureProvisioning || allowPublication)) {
		throw new Error('Fixture provisioning requires provisioning=true and publication=false.');
	}
	if (executionMode === 'publication' && (allowFixtureProvisioning || !allowPublication)) {
		throw new Error('Publication requires provisioning=false and publication=true.');
	}
	return { allowFixtureProvisioning, allowPublication };
}

function requireVariable(env: NodeJS.ProcessEnv, name: string): string {
	const value = env[name]?.trim();
	if (!value) throw new Error(`Authenticated Preview E2E requires ${name}.`);
	return value;
}

export function assertExpectedPreviewAccountEmail(email: string): void {
	if (email.trim().toLowerCase() !== EXPECTED_PREVIEW_ACCOUNT_EMAIL) {
		throw new Error(
			`Preview E2E account must be exactly ${EXPECTED_PREVIEW_ACCOUNT_EMAIL}; received a different identity.`,
		);
	}
}

export function assertExpectedPreviewAccountRole(role: string): void {
	if (role !== EXPECTED_PREVIEW_ACCOUNT_ROLE) {
		throw new Error(
			`Preview E2E account role must be ${EXPECTED_PREVIEW_ACCOUNT_ROLE}; received "${role || '(missing)'}". ` +
				'Repair Preview-only app_user_roles / auth app_metadata before continuing.',
		);
	}
}

export function isCanonicalPreviewFixture(
	fixture: PreviewFixtureIdentity,
	expectedOwnerId: string,
): boolean {
	return (
		fixture.kind === 'client' &&
		fixture.slug === PREVIEW_FIXTURE_SLUG &&
		fixture.title === PREVIEW_FIXTURE_TITLE &&
		fixture.eventType === PREVIEW_FIXTURE_EVENT_TYPE &&
		fixture.baseDemoId === PREVIEW_FIXTURE_DEMO_ID &&
		fixture.clientName === '' &&
		fixture.clientEmail === '' &&
		fixture.clientWhatsapp === '' &&
		fixture.createdBy === expectedOwnerId &&
		(fixture.hasRequest === undefined || fixture.hasRequest === false) &&
		(fixture.hasSubmission === undefined || fixture.hasSubmission === false)
	);
}

export function assertCanonicalPreviewFixture(
	fixture: PreviewFixtureIdentity,
	expectedOwnerId: string,
): void {
	if (!isCanonicalPreviewFixture(fixture, expectedOwnerId)) {
		throw new Error(
			`Invitation is not the canonical Preview fixture ${PREVIEW_FIXTURE_SLUG} owned by the dedicated Preview account.`,
		);
	}
}

/**
 * Publication smoke targeting is hard-locked to the dedicated synthetic fixture.
 * Any other invitation id/slug is rejected before a publish request is issued.
 */
export function assertPreviewPublicationTarget(options: {
	configuredFixtureId: string;
	targetInvitationId: string;
	targetSlug: string | null | undefined;
	targetOwnerEmail: string;
	targetEnvironment: string;
}): void {
	const configured = options.configuredFixtureId.trim();
	const targetId = options.targetInvitationId.trim();
	if (!configured) {
		throw new Error('Publication targeting requires PLAYWRIGHT_PREVIEW_INVITATION_ID.');
	}
	if (targetId !== configured) {
		throw new Error(
			'Publication targeting rejected: invitation id does not match the dedicated Preview fixture.',
		);
	}
	if (options.targetSlug !== PREVIEW_FIXTURE_SLUG) {
		throw new Error(
			`Publication targeting rejected: slug must be exactly ${PREVIEW_FIXTURE_SLUG}.`,
		);
	}
	assertExpectedPreviewAccountEmail(options.targetOwnerEmail);
	if (options.targetEnvironment !== 'preview') {
		throw new Error('Publication targeting requires the verified Preview environment.');
	}
}

export function selectCanonicalPreviewFixture(
	items: PreviewFixtureIdentity[],
): PreviewFixtureIdentity | undefined {
	const matches = items.filter((item) => item.slug === PREVIEW_FIXTURE_SLUG);
	if (matches.length > 1) {
		throw new Error(
			`Fixture provisioning aborted because slug ${PREVIEW_FIXTURE_SLUG} is not unique.`,
		);
	}
	const customerLike = matches.find(
		(item) =>
			item.clientName.trim() !== '' ||
			item.clientEmail.trim() !== '' ||
			item.clientWhatsapp.trim() !== '' ||
			item.hasRequest === true ||
			item.hasSubmission === true,
	);
	if (customerLike) {
		throw new Error(
			`Refusing to use ${PREVIEW_FIXTURE_SLUG}: record contains customer or intake-linked data.`,
		);
	}
	return matches[0];
}

export function validateAuthenticatedPreviewEnvironment(
	env: NodeJS.ProcessEnv = process.env,
	options: PreviewValidationOptions = {},
): AuthenticatedPreviewEnvironment {
	const executionMode = options.executionMode ?? 'read-only';
	const runtime = validateReadOnlyPreviewTarget(env);

	const hostLogin = requireVariable(env, 'PLAYWRIGHT_HOST_LOGIN');
	assertExpectedPreviewAccountEmail(hostLogin);
	const hostPassword = requireVariable(env, 'PLAYWRIGHT_HOST_PASSWORD');
	const requireFixtureId = executionMode !== 'provision';
	const fixtureId = requireFixtureId
		? requireVariable(env, 'PLAYWRIGHT_PREVIEW_INVITATION_ID')
		: (env.PLAYWRIGHT_PREVIEW_INVITATION_ID?.trim() ?? '');
	if (fixtureId && !UUID_PATTERN.test(fixtureId)) {
		throw new Error('PLAYWRIGHT_PREVIEW_INVITATION_ID must be a UUID.');
	}

	const { allowFixtureProvisioning, allowPublication } = validateExecutionGuards(
		env,
		executionMode,
	);

	return {
		runtime,
		hostLogin,
		hostPassword,
		fixtureId,
		allowPublication,
		allowFixtureProvisioning,
		executionMode,
	};
}

export interface PreviewHttpResponse {
	ok(): boolean;
	status(): number;
	headers(): Record<string, string>;
}

interface PreviewReadRetryOptions {
	maxAttempts?: number;
	fallbackDelayMs?: number;
	maxRetryAfterMs?: number;
	sleep?: (delayMs: number) => Promise<void>;
	now?: () => number;
}

function safeOperationName(operation: string): string {
	return /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$/.test(operation) ? operation : 'Preview request';
}

function readHeader(headers: Record<string, string>, name: string): string | undefined {
	const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
	return match?.[1];
}

function parseRetryAfterMs(
	rawValue: string,
	now: number,
	maxRetryAfterMs: number,
): number | undefined {
	const trimmed = rawValue.trim();
	const seconds = /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
	const delayMs = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(trimmed) - now;
	if (!Number.isFinite(delayMs) || delayMs < 0 || delayMs > maxRetryAfterMs) return undefined;
	return delayMs;
}

function resolveRetryDelay(options: {
	response: PreviewHttpResponse;
	operation: string;
	retryCount: number;
	fallbackDelayMs: number;
	maxRetryAfterMs: number;
	now: () => number;
}): number {
	const retryAfter = readHeader(options.response.headers(), 'retry-after');
	if (retryAfter === undefined) return options.fallbackDelayMs;
	const parsedDelay = parseRetryAfterMs(retryAfter, options.now(), options.maxRetryAfterMs);
	if (parsedDelay !== undefined) return parsedDelay;
	throw new Error(
		`${options.operation} failed with HTTP 429; retries=${options.retryCount}; retry-after=invalid.`,
	);
}

async function callPreviewRequest<T>(
	operation: string,
	retryCount: number,
	request: () => Promise<T>,
): Promise<T> {
	try {
		return await request();
	} catch {
		throw new Error(`${operation} failed with HTTP unavailable; retries=${retryCount}.`);
	}
}

export async function executePreviewRead<T extends PreviewHttpResponse>(
	operation: string,
	request: () => Promise<T>,
	options: PreviewReadRetryOptions = {},
): Promise<T> {
	const maxAttempts = options.maxAttempts ?? 3;
	const fallbackDelayMs = options.fallbackDelayMs ?? PREVIEW_DRAFT_RATE_LIMIT_WINDOW_MS;
	const maxRetryAfterMs = options.maxRetryAfterMs ?? PREVIEW_DRAFT_RATE_LIMIT_WINDOW_MS;
	if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) {
		throw new Error('Preview read retry attempts must be between 1 and 3.');
	}
	if (
		!Number.isFinite(fallbackDelayMs) ||
		fallbackDelayMs < 0 ||
		fallbackDelayMs > PREVIEW_DRAFT_RATE_LIMIT_WINDOW_MS ||
		!Number.isFinite(maxRetryAfterMs) ||
		maxRetryAfterMs < 0 ||
		maxRetryAfterMs > PREVIEW_DRAFT_RATE_LIMIT_WINDOW_MS
	) {
		throw new Error(
			'Preview read retry delays must stay within the 60-second rate-limit window.',
		);
	}
	const sleep =
		options.sleep ??
		((delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs)));
	const now = options.now ?? Date.now;
	const safeOperation = safeOperationName(operation);

	let attempt = 1;
	while (true) {
		const response = await callPreviewRequest(safeOperation, attempt - 1, request);
		if (response.ok()) return response;
		const status = response.status();
		const retryCount = attempt - 1;
		if (status !== 429) {
			throw new Error(`${safeOperation} failed with HTTP ${status}; retries=${retryCount}.`);
		}
		if (attempt === maxAttempts) {
			throw new Error(
				`${safeOperation} failed with HTTP 429; retries=${retryCount}; retry-after=exhausted.`,
			);
		}

		const delayMs = resolveRetryDelay({
			response,
			operation: safeOperation,
			retryCount,
			fallbackDelayMs,
			maxRetryAfterMs,
			now,
		});
		await sleep(delayMs);
		attempt += 1;
	}
}

export async function executePreviewMutation<T extends PreviewHttpResponse>(
	operation: string,
	request: () => Promise<T>,
): Promise<T> {
	const safeOperation = safeOperationName(operation);
	const response = await callPreviewRequest(safeOperation, 0, request);
	if (response.ok()) return response;
	const status = response.status();
	const metadata = status === 429 ? '; retry-after=not-retried' : '';
	throw new Error(`${safeOperation} failed with HTTP ${status}; retries=0${metadata}.`);
}

interface PreviewRequestWindowLimiterOptions {
	maxRequests?: number;
	windowMs?: number;
	now?: () => number;
	sleep?: (delayMs: number) => Promise<void>;
}

export class PreviewRequestWindowLimiter {
	private readonly requestTimes: number[] = [];
	private readonly maxRequests: number;
	private readonly windowMs: number;
	private readonly now: () => number;
	private readonly sleep: (delayMs: number) => Promise<void>;

	constructor(options: PreviewRequestWindowLimiterOptions = {}) {
		this.maxRequests = options.maxRequests ?? PREVIEW_DRAFT_RATE_LIMIT_MAX_REQUESTS;
		this.windowMs = options.windowMs ?? PREVIEW_DRAFT_RATE_LIMIT_WINDOW_MS;
		this.now = options.now ?? Date.now;
		this.sleep =
			options.sleep ??
			((delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs)));
	}

	async beforeRequest(): Promise<void> {
		let current = this.now();
		while (this.requestTimes.length > 0 && current - this.requestTimes[0] >= this.windowMs) {
			this.requestTimes.shift();
		}
		if (this.requestTimes.length >= this.maxRequests) {
			const delayMs = Math.max(0, this.requestTimes[0] + this.windowMs - current);
			await this.sleep(delayMs);
			current = this.now();
			while (
				this.requestTimes.length > 0 &&
				current - this.requestTimes[0] >= this.windowMs
			) {
				this.requestTimes.shift();
			}
		}
		this.requestTimes.push(current);
	}
}

const SAFE_DIAGNOSTIC_KEYS = new Set([
	'login',
	'adminDashboard',
	'editor',
	'preflightChangedPathCount',
	'hasPublishedContent',
	'publicStatus',
	'publicationOptIn',
	'idempotent',
	'publishedVersion',
	'postPublicationChangedPathCount',
]);

export function serializeSafePreviewDiagnostics(
	diagnostics: Record<string, number | boolean>,
): string {
	for (const [key, value] of Object.entries(diagnostics)) {
		if (!SAFE_DIAGNOSTIC_KEYS.has(key)) {
			throw new Error('Preview diagnostics contain an unsupported field.');
		}
		if (typeof value !== 'boolean' && (typeof value !== 'number' || !Number.isFinite(value))) {
			throw new Error('Preview diagnostics may contain only finite numbers and booleans.');
		}
	}
	return JSON.stringify(diagnostics, null, 2);
}
