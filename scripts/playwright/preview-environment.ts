import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

const E2E_ENV_FILE = '.env.e2e.local';
const DEFAULT_PLAYWRIGHT_WEB_SERVER_URL = 'http://127.0.0.1:4321';
export const PREVIEW_FIXTURE_SLUG = 'e2e-preview-publication';
export const PREVIEW_FIXTURE_TITLE = 'Fixture E2E de publicación Preview';
export const PREVIEW_FIXTURE_DEMO_ID = 'demo-xv-jewelry-box';
export const PREVIEW_FIXTURE_EVENT_TYPE = 'xv';
export const EXPECTED_PREVIEW_ACCOUNT_EMAIL = 'preview@preview.com';
export const EXPECTED_PREVIEW_ACCOUNT_ROLE = 'super_admin';

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
	protectionHeaders?: Record<string, string>;
}

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
		isExternal && base.protocol === 'https:' && base.hostname.endsWith('.vercel.app');
	const protectionHeaders = isVercelPreview ? buildVercelProtectionHeaders(env) : undefined;

	return {
		baseURL: base.toString().replace(/\/$/, ''),
		webServerURL: webServer.toString().replace(/\/$/, ''),
		isExternal,
		isVercelPreview,
		protectionHeaders,
	};
}

export interface AuthenticatedPreviewEnvironment {
	runtime: PlaywrightRuntimeEnvironment;
	hostLogin: string;
	hostPassword: string;
	fixtureId: string;
	allowPublication: boolean;
	allowFixtureProvisioning: boolean;
	debugArtifacts: boolean;
}

interface PreviewValidationOptions {
	requireFixtureId?: boolean;
	requireProvisioningAuthorization?: boolean;
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
	const runtime = resolvePlaywrightRuntimeEnvironment(env);
	if (!env.PLAYWRIGHT_BASE_URL?.trim()) {
		throw new Error('Authenticated Preview E2E requires PLAYWRIGHT_BASE_URL.');
	}
	if (!runtime.isVercelPreview) {
		throw new Error(
			'Authenticated Preview E2E requires an HTTPS *.vercel.app PLAYWRIGHT_BASE_URL.',
		);
	}

	const hostLogin = requireVariable(env, 'PLAYWRIGHT_HOST_LOGIN');
	assertExpectedPreviewAccountEmail(hostLogin);
	const hostPassword = requireVariable(env, 'PLAYWRIGHT_HOST_PASSWORD');
	requireVariable(env, 'VERCEL_AUTOMATION_BYPASS_SECRET');

	const requireFixtureId = options.requireFixtureId ?? true;
	const fixtureId = requireFixtureId
		? requireVariable(env, 'PLAYWRIGHT_PREVIEW_INVITATION_ID')
		: (env.PLAYWRIGHT_PREVIEW_INVITATION_ID?.trim() ?? '');
	if (
		fixtureId &&
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
			fixtureId,
		)
	) {
		throw new Error('PLAYWRIGHT_PREVIEW_INVITATION_ID must be a UUID.');
	}

	const allowFixtureProvisioning = env.PLAYWRIGHT_ALLOW_PREVIEW_FIXTURE_PROVISIONING === 'true';
	if (options.requireProvisioningAuthorization && !allowFixtureProvisioning) {
		throw new Error(
			'Preview fixture provisioning requires PLAYWRIGHT_ALLOW_PREVIEW_FIXTURE_PROVISIONING=true.',
		);
	}

	return {
		runtime,
		hostLogin,
		hostPassword,
		fixtureId,
		allowPublication: env.PLAYWRIGHT_ALLOW_PREVIEW_PUBLICATION === 'true',
		allowFixtureProvisioning,
		debugArtifacts: env.PLAYWRIGHT_PREVIEW_DEBUG_ARTIFACTS === 'true',
	};
}
