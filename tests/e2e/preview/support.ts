import { expect, type APIResponse, type Page } from '@playwright/test';
import type {
	AuthenticatedPreviewEnvironment,
	PlaywrightRuntimeEnvironment,
} from '../../../scripts/playwright/preview-environment';
import {
	executePreviewMutation,
	executePreviewRead,
} from '../../../scripts/playwright/preview-environment';

export interface SessionIdentity {
	userId: string;
	email: string;
	role: string;
}

export interface InvitationSummary {
	id: string;
	kind: 'demo' | 'client';
	slug: string | null;
	title: string;
	eventType: string;
	clientName: string;
	clientEmail: string;
	clientWhatsapp: string;
	createdBy: string | null;
	hasRequest: boolean;
	hasSubmission: boolean;
	published: boolean;
}

export interface EditorContext {
	invitation: InvitationSummary & {
		status: string;
		updatedAt: string;
	};
	content: Record<string, unknown>;
	draftUpdatedAt: string | null;
	draftStatus: 'draft' | 'reviewed' | 'approved' | null;
	publication: {
		hasPublishedContent: boolean;
		version: number | null;
		hasUnpublishedChanges: boolean;
	};
}

export interface PublicationPreflight {
	changedPaths: string[];
	draftRevision: string;
	publishedVersion: number | null;
	publicMetadataHash: string;
	projectionHash: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Access headers per bypassed page, so helpers that only receive a Page can sign their
// direct page.request calls without threading the runtime through every signature.
const pageAccessHeaders = new WeakMap<Page, Record<string, string>>();

function accessHeadersFor(page: Page): Record<string, string> {
	const headers = pageAccessHeaders.get(page);
	if (!headers) {
		throw new Error('Call establishDeploymentProtectionBypass before Preview API requests.');
	}
	return headers;
}

export async function establishDeploymentProtectionBypass(
	page: Page,
	runtime: PlaywrightRuntimeEnvironment,
): Promise<void> {
	const headers = runtime.protectionHeaders;
	if (!headers) {
		throw new Error('Cloudflare Access service token headers were not resolved.');
	}

	// Strict service token authentication returns no CF_Authorization cookie, so every request
	// to the Preview origin must carry the token. Route only same-origin browser requests: a
	// global extraHTTPHeaders setting would also send the token to third-party assets. Direct
	// page.request calls bypass routes and pass previewAccessHeaders() themselves.
	const origin = new URL(runtime.baseURL).origin;
	pageAccessHeaders.set(page, headers);
	await page.route(
		(url) => url.origin === origin,
		(route) => route.continue({ headers: { ...route.request().headers(), ...headers } }),
	);

	const response = await page.request.get(`${runtime.baseURL}/api/health`, {
		headers,
		maxRedirects: 0,
	});
	if (response.status() !== 200) {
		throw new Error(`Cloudflare Access bootstrap failed with HTTP ${response.status()}.`);
	}
}

/** Cloudflare Access headers for direct page.request calls to the Preview origin. */
export function previewAccessHeaders(
	runtime: PlaywrightRuntimeEnvironment,
): Record<string, string> {
	if (!runtime.protectionHeaders) {
		throw new Error('Cloudflare Access service token headers were not resolved.');
	}
	return runtime.protectionHeaders;
}

async function parseSuccessfulJson<T>(response: APIResponse, operation: string): Promise<T> {
	try {
		return (await response.json()) as T;
	} catch {
		throw new Error(`${operation} failed with HTTP ${response.status()}; retries=0.`);
	}
}

export async function loginAsPreviewAdmin(
	page: Page,
	preview: AuthenticatedPreviewEnvironment,
): Promise<void> {
	await page.goto('/login');
	await expect(page.locator('#login-submit')).toBeVisible();

	const loginResponsePromise = page.waitForResponse(
		(response) =>
			new URL(response.url()).pathname === '/api/auth/login-host' &&
			response.request().method() === 'POST',
	);
	await page.locator('#login-email').fill(preview.hostLogin);
	await page.locator('#login-password').fill(preview.hostPassword);
	await page.locator('#login-submit').click();
	const loginResponse = await loginResponsePromise;
	expect(loginResponse.status()).toBe(200);

	await expect(page).toHaveURL(/\/dashboard\/invitados$/);
	await expect(page.locator('.dashboard-sidebar')).toBeVisible();
	await expect(page.locator('.dashboard-env-banner--preview')).toContainText('ENTORNO PREVIEW');
}

export async function readSessionIdentity(page: Page): Promise<SessionIdentity> {
	const payload = await getJson<unknown>(page, '/api/auth/session', 'Session identity check');
	if (
		!isRecord(payload) ||
		typeof payload.userId !== 'string' ||
		typeof payload.email !== 'string' ||
		typeof payload.role !== 'string'
	) {
		throw new Error('Session identity response did not match the expected contract.');
	}
	return { userId: payload.userId, email: payload.email, role: payload.role };
}

async function readCsrfToken(page: Page): Promise<string> {
	const token = await page.locator('meta[name="csrf-token"]').getAttribute('content');
	if (!token) throw new Error('Authenticated dashboard did not provide a CSRF token.');
	return token;
}

export async function getJson<T>(page: Page, path: string, operation: string): Promise<T> {
	const response = await executePreviewRead(operation, () =>
		page.request.get(path, { headers: accessHeadersFor(page) }),
	);
	return parseSuccessfulJson<T>(response, operation);
}

export async function mutateJson<T>(
	page: Page,
	path: string,
	method: 'POST' | 'PATCH',
	body: Record<string, unknown>,
	operation: string,
): Promise<T> {
	const csrfToken = await readCsrfToken(page);
	const response = await executePreviewMutation(operation, () =>
		page.request.fetch(path, {
			method,
			headers: { ...accessHeadersFor(page), 'X-CSRF-Token': csrfToken },
			data: body,
		}),
	);
	return parseSuccessfulJson<T>(response, operation);
}

export async function readInvitationList(page: Page): Promise<InvitationSummary[]> {
	const payload = await getJson<{ items: InvitationSummary[] }>(
		page,
		'/api/dashboard/intake?includeArchived=true',
		'Invitation inventory check',
	);
	return payload.items;
}

export async function readEditorContext(page: Page, invitationId: string): Promise<EditorContext> {
	return getJson<EditorContext>(
		page,
		`/api/dashboard/intake/${encodeURIComponent(invitationId)}/editor`,
		'Invitation editor context check',
	);
}

export async function readPublicationPreflight(
	page: Page,
	invitationId: string,
): Promise<PublicationPreflight> {
	return getJson<PublicationPreflight>(
		page,
		`/api/dashboard/intake/${encodeURIComponent(invitationId)}/editor/preflight`,
		'Publication preflight',
	);
}
