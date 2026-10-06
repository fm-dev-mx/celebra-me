/**
 * Owner-run Production canary for one event memory space: one synthetic guest
 * session, one tiny non-PII PNG, one accepted catalog record, one private
 * preview, one logical DELETE. Refuses CI, non-interactive terminals, unknown
 * arguments and every destination except the canonical `www` route.
 */

import path from 'node:path';
import type { Page, Request, Response, Route } from '@playwright/test';
import { MEMORIES_UUID_PATTERN } from '../../src/lib/memories/contract/catalog';
import {
	buildMemoriesGuestApiPath,
	buildMemoriesPublicPath,
	isMemoriesPublicSlug,
} from '../../src/lib/memories/contract/private-request';
import { memoriesCaptureCopy } from '../../src/lib/memories/copy';

/** Canonical app origin allowed by the Sign Worker in Production. */
export const MEMORIES_CANONICAL_APP_ORIGIN = 'https://www.celebra-me.com' as const;
export const MEMORIES_PRODUCTION_CONFIRMATION =
	'I_AUTHORIZE_ONE_MEMORIES_PRODUCTION_CANARY' as const;

const MAX_COMPLETION_ATTEMPTS = 3;
const SESSION_DISPLAY_NAME = 'Canario sintético';
const REQUEST_TIMEOUT_MS = 30_000;
const CAPTURE_SELECTOR = '[data-capture="memories"]';
const CI_ENV_KEYS = [
	'CI',
	'GITHUB_ACTIONS',
	'GITLAB_CI',
	'BUILDKITE',
	'CIRCLECI',
	'TF_BUILD',
	'JENKINS_URL',
	'TEAMCITY_VERSION',
] as const;

const TINY_NON_PII_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
	'base64',
);

export type CanaryStage =
	| 'preflight'
	| 'route'
	| 'hydration'
	| 'session'
	| 'reservation'
	| 'upload'
	| 'completion'
	| 'catalog'
	| 'preview'
	| 'deletion'
	| 'absence'
	| 'cleanup'
	| 'result';

export type CanarySeverity = 'INFO' | 'PASS' | 'CRITICAL';

export type CanaryEvent = {
	timestamp: string;
	stage: CanaryStage;
	status: string | number;
	severity: CanarySeverity;
};

export type CanaryInvocation = {
	slug: string;
	destination: string;
	sessionPath: string;
	itemsPath: string;
};

type TerminalState = { stdin: boolean; stdout: boolean };
type RequestObservation = { method: string; url: string; body: string | null };
type LifecycleCounts = {
	sessionCreations: number;
	reservations: number;
	puts: number;
	completions: number;
	deletes: number;
};
type CatalogItem = { id: string; status: string };

export class CanaryFailure extends Error {
	readonly stage: CanaryStage;
	readonly code: string;

	constructor(stage: CanaryStage, code: string) {
		super(code);
		this.name = 'CanaryFailure';
		this.stage = stage;
		this.code = code;
	}
}

function fail(stage: CanaryStage, code: string): never {
	throw new CanaryFailure(stage, code);
}

function hasCiMarker(env: NodeJS.ProcessEnv): boolean {
	return CI_ENV_KEYS.some((key) => typeof env[key] === 'string' && env[key]!.length > 0);
}

export function buildCanaryDestination(slug: string): string {
	return new URL(buildMemoriesPublicPath(slug), MEMORIES_CANONICAL_APP_ORIGIN).href;
}

export function parseCanaryInvocation(
	argv: readonly string[],
	env: NodeJS.ProcessEnv,
	terminal: TerminalState,
): CanaryInvocation {
	if (hasCiMarker(env)) fail('preflight', 'CI_EXECUTION_REJECTED');
	if (!terminal.stdin || !terminal.stdout) fail('preflight', 'INTERACTIVE_TERMINAL_REQUIRED');

	const values = new Map<string, string>();
	const normalizedArgv = argv[0] === '--' ? argv.slice(1) : argv;
	for (const argument of normalizedArgv) {
		const match = /^--([a-z-]+)=(.+)$/.exec(argument);
		if (!match) fail('preflight', 'INVALID_ARGUMENT');
		const [, key, value] = match;
		if (key !== 'slug' && key !== 'destination' && key !== 'confirm-production')
			fail('preflight', 'UNKNOWN_ARGUMENT');
		if (values.has(key)) fail('preflight', 'DUPLICATE_ARGUMENT');
		values.set(key, value);
	}

	if (values.size !== 3) fail('preflight', 'REQUIRED_ARGUMENT_MISSING');
	if (values.get('confirm-production') !== MEMORIES_PRODUCTION_CONFIRMATION)
		fail('preflight', 'PRODUCTION_CONFIRMATION_REJECTED');
	const slug = values.get('slug') ?? '';
	if (!isMemoriesPublicSlug(slug)) fail('preflight', 'INVALID_SLUG');

	const canonical = buildCanaryDestination(slug);
	const destination = values.get('destination');
	try {
		if (!destination || new URL(destination).href !== canonical) {
			fail('preflight', 'NONCANONICAL_DESTINATION_REJECTED');
		}
	} catch (error) {
		if (error instanceof CanaryFailure) throw error;
		fail('preflight', 'NONCANONICAL_DESTINATION_REJECTED');
	}

	const apiBase = buildMemoriesGuestApiPath(slug);
	return {
		slug,
		destination: canonical,
		sessionPath: `${apiBase}/session`,
		itemsPath: `${apiBase}/items`,
	};
}

export function formatCanaryEvent(event: CanaryEvent): string {
	return JSON.stringify(event);
}

export function createTinyNonPiiPng(): Buffer {
	return Buffer.from(TINY_NON_PII_PNG);
}

function readAction(body: string | null): string | null {
	if (!body) return null;
	try {
		const parsed: unknown = JSON.parse(body);
		if (!parsed || typeof parsed !== 'object' || !('action' in parsed)) return null;
		return typeof parsed.action === 'string' ? parsed.action : null;
	} catch {
		return null;
	}
}

export class CanaryLifecycleGuard {
	private readonly productionOrigin = MEMORIES_CANONICAL_APP_ORIGIN;
	private readonly state: LifecycleCounts = {
		sessionCreations: 0,
		reservations: 0,
		puts: 0,
		completions: 0,
		deletes: 0,
	};
	private lifecycleItemPath: string | null = null;

	constructor(private readonly invocation: Pick<CanaryInvocation, 'sessionPath' | 'itemsPath'>) {}

	private itemPathFromUrl(url: URL): string | null {
		if (!url.pathname.startsWith(`${this.invocation.itemsPath}/`)) return null;
		const suffix = url.pathname.slice(this.invocation.itemsPath.length + 1);
		return suffix && !suffix.includes('/') ? url.pathname : null;
	}

	observe(observation: RequestObservation): void {
		const method = observation.method.toUpperCase();
		const url = new URL(observation.url);
		if (method === 'PUT') {
			this.observePut(url);
			return;
		}
		if (url.origin !== this.productionOrigin) return;
		if (method === 'POST' && url.pathname === this.invocation.sessionPath) {
			this.observeSessionCreation(observation.body);
			return;
		}
		if (method === 'POST' && url.pathname === this.invocation.itemsPath) {
			this.observeReservation(observation.body);
			return;
		}
		const itemPath = this.itemPathFromUrl(url);
		if (!itemPath) return;
		this.observeItemMutation(method, itemPath, observation.body);
	}

	private observePut(url: URL): void {
		this.state.puts += 1;
		if (
			this.state.puts > 1 ||
			url.protocol !== 'https:' ||
			url.origin === this.productionOrigin
		) {
			fail('upload', 'PUT_BOUNDARY_VIOLATION');
		}
	}

	private observeSessionCreation(body: string | null): void {
		this.state.sessionCreations += 1;
		if (this.state.sessionCreations > 1 || readAction(body) !== 'create') {
			fail('session', 'SESSION_BOUNDARY_VIOLATION');
		}
	}

	private observeReservation(body: string | null): void {
		this.state.reservations += 1;
		if (this.state.reservations > 1 || readAction(body) !== 'reserve') {
			fail('reservation', 'RESERVATION_BOUNDARY_VIOLATION');
		}
	}

	private observeItemMutation(method: string, itemPath: string, body: string | null): void {
		if (this.lifecycleItemPath && this.lifecycleItemPath !== itemPath) {
			fail('cleanup', 'MULTIPLE_MEDIA_LIFECYCLES_REJECTED');
		}
		this.lifecycleItemPath ??= itemPath;
		if (method === 'POST') {
			this.state.completions += 1;
			if (
				this.state.completions > MAX_COMPLETION_ATTEMPTS ||
				readAction(body) !== 'complete'
			) {
				fail('completion', 'COMPLETION_BOUNDARY_VIOLATION');
			}
			return;
		}
		if (method === 'DELETE') {
			this.state.deletes += 1;
			if (this.state.deletes > 1) fail('deletion', 'DELETE_BOUNDARY_VIOLATION');
		}
	}

	registerMediaId(mediaId: string): void {
		if (!MEMORIES_UUID_PATTERN.test(mediaId)) fail('reservation', 'INVALID_MEDIA_ID');
		const expectedPath = `${this.invocation.itemsPath}/${encodeURIComponent(mediaId)}`;
		if (this.lifecycleItemPath && this.lifecycleItemPath !== expectedPath) {
			fail('reservation', 'MEDIA_ID_MISMATCH');
		}
		this.lifecycleItemPath = expectedPath;
	}

	get deleteAttempted(): boolean {
		return this.state.deletes > 0;
	}

	get reservationAttempted(): boolean {
		return this.state.reservations > 0;
	}

	counts(): Readonly<LifecycleCounts> {
		return { ...this.state };
	}

	assertSuccessfulLifecycle(): void {
		if (
			this.state.sessionCreations !== 1 ||
			this.state.reservations !== 1 ||
			this.state.puts !== 1 ||
			this.state.completions < 1 ||
			this.state.completions > MAX_COMPLETION_ATTEMPTS ||
			this.state.deletes !== 1
		) {
			fail('result', 'LIFECYCLE_COUNT_MISMATCH');
		}
	}
}

function emit(
	stage: CanaryStage,
	status: string | number,
	severity: CanarySeverity,
	write: (line: string) => void,
): void {
	write(formatCanaryEvent({ timestamp: new Date().toISOString(), stage, status, severity }));
}

function requestObservation(request: Request): RequestObservation {
	return { method: request.method(), url: request.url(), body: request.postData() };
}

function isResponseFor(response: Response, method: string, pathname: string): boolean {
	const request = response.request();
	return request.method() === method && new URL(response.url()).pathname === pathname;
}

async function readJson(response: Response, stage: CanaryStage): Promise<Record<string, unknown>> {
	const payload: unknown = await response.json().catch(() => null);
	if (!payload || typeof payload !== 'object' || Array.isArray(payload))
		fail(stage, 'INVALID_JSON_RESPONSE');
	return payload as Record<string, unknown>;
}

function readItemField(
	payload: Record<string, unknown>,
	field: 'id' | 'status',
	stage: CanaryStage,
): string {
	if (!payload.item || typeof payload.item !== 'object' || Array.isArray(payload.item)) {
		fail(stage, `${stage.toUpperCase()}_RESPONSE_REJECTED`);
	}
	const value = (payload.item as Record<string, unknown>)[field];
	if (typeof value !== 'string') fail(stage, `${stage.toUpperCase()}_RESPONSE_REJECTED`);
	return value;
}

function readCatalogItems(payload: Record<string, unknown>): CatalogItem[] {
	if (!Array.isArray(payload.items)) fail('catalog', 'CATALOG_RESPONSE_REJECTED');
	const items: CatalogItem[] = [];
	for (const candidate of payload.items) {
		if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
			fail('catalog', 'CATALOG_RESPONSE_REJECTED');
		}
		const item = candidate as Record<string, unknown>;
		if (typeof item.id !== 'string' || typeof item.status !== 'string') {
			fail('catalog', 'CATALOG_RESPONSE_REJECTED');
		}
		items.push({ id: item.id, status: item.status });
	}
	return items;
}

async function waitForHydration(page: Page): Promise<void> {
	await page.waitForFunction(
		(selector) => {
			const capture = document.querySelector(selector);
			const island = capture?.closest('astro-island');
			return Boolean(island && !island.hasAttribute('ssr'));
		},
		CAPTURE_SELECTOR,
		{ timeout: REQUEST_TIMEOUT_MS },
	);
}

async function authenticatedDelete(page: Page, mediaPath: string): Promise<number> {
	return page.evaluate(async (pathname) => {
		const response = await fetch(pathname, { method: 'DELETE' });
		return response.status;
	}, mediaPath);
}

async function confirmCatalogAbsence(
	page: Page,
	itemsPath: string,
	mediaId: string,
): Promise<boolean> {
	return page.evaluate(
		async ({ endpoint, targetId }) => {
			const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
			if (!response.ok) return false;
			const payload: unknown = await response.json().catch(() => null);
			if (!payload || typeof payload !== 'object' || !('items' in payload)) return false;
			const items = (payload as { items?: unknown }).items;
			return Array.isArray(items)
				? !items.some(
						(item) =>
							Boolean(item) &&
							typeof item === 'object' &&
							'id' in item &&
							(item as { id?: unknown }).id === targetId,
					)
				: false;
		},
		{ endpoint: itemsPath, targetId: mediaId },
	);
}

function normalizeFailure(error: unknown, stage: CanaryStage): CanaryFailure {
	return error instanceof CanaryFailure
		? error
		: new CanaryFailure(stage, `${stage.toUpperCase()}_FAILED`);
}

type StageRef = { current: CanaryStage };

async function installLifecycleGuard(
	page: Page,
	guard: CanaryLifecycleGuard,
	stage: StageRef,
): Promise<() => CanaryFailure | null> {
	let interceptedFailure: CanaryFailure | null = null;
	await page.route('**/*', async (route: Route) => {
		try {
			guard.observe(requestObservation(route.request()));
			await route.continue();
		} catch (error) {
			interceptedFailure ??= normalizeFailure(error, stage.current);
			await route.abort('blockedbyclient');
		}
	});
	return () => interceptedFailure;
}

async function openFreshGuestSession(
	page: Page,
	invocation: CanaryInvocation,
	stage: StageRef,
	write: (line: string) => void,
): Promise<void> {
	const initialSessionResponse = page.waitForResponse((response) =>
		isResponseFor(response, 'GET', invocation.sessionPath),
	);
	stage.current = 'route';
	const routeResponse = await page.goto(invocation.destination, {
		waitUntil: 'domcontentloaded',
		timeout: REQUEST_TIMEOUT_MS,
	});
	if (routeResponse?.status() !== 200) fail('route', 'ROUTE_STATUS_REJECTED');
	if (page.url() !== invocation.destination) fail('route', 'ROUTE_REDIRECT_REJECTED');
	emit('route', 200, 'INFO', write);

	stage.current = 'hydration';
	await waitForHydration(page);
	const initialSession = await initialSessionResponse;
	if (initialSession.status() !== 200) fail('session', 'INITIAL_SESSION_STATUS_REJECTED');
	const initialPayload = await readJson(initialSession, 'session');
	if (initialPayload.profile !== null) fail('session', 'FRESH_SESSION_REQUIRED');
	emit('hydration', 'READY', 'INFO', write);

	stage.current = 'session';
	const sessionResponsePromise = page.waitForResponse((response) =>
		isResponseFor(response, 'POST', invocation.sessionPath),
	);
	const emptyCatalogResponsePromise = page.waitForResponse((response) =>
		isResponseFor(response, 'GET', invocation.itemsPath),
	);
	await page.getByLabel(memoriesCaptureCopy.displayNameLabel).fill(SESSION_DISPLAY_NAME);
	await page.getByRole('button', { name: memoriesCaptureCopy.continueLabel }).click();
	const sessionResponse = await sessionResponsePromise;
	if (sessionResponse.status() !== 201) fail('session', 'SESSION_STATUS_REJECTED');
	const emptyCatalogResponse = await emptyCatalogResponsePromise;
	if (emptyCatalogResponse.status() !== 200) fail('session', 'INITIAL_CATALOG_STATUS_REJECTED');
	if (readCatalogItems(await readJson(emptyCatalogResponse, 'catalog')).length !== 0) {
		fail('session', 'FRESH_SESSION_CATALOG_NOT_EMPTY');
	}
	emit('session', 201, 'INFO', write);
}

async function verifyPrivatePreview(
	page: Page,
	response: Response,
	mediaPath: string,
	write: (line: string) => void,
): Promise<void> {
	if (response.status() !== 200) fail('preview', 'PREVIEW_STATUS_REJECTED');
	const headers = response.headers();
	const cacheControl = headers['cache-control']?.toLowerCase() ?? '';
	if (
		!cacheControl.includes('private') ||
		!cacheControl.includes('no-store') ||
		headers['x-content-type-options']?.toLowerCase() !== 'nosniff'
	) {
		fail('preview', 'PREVIEW_PRIVACY_HEADERS_REJECTED');
	}
	await page.waitForFunction(
		(pathname) => {
			const image = document.querySelector(`img[src="${pathname}"]`);
			return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
		},
		mediaPath,
		{ timeout: REQUEST_TIMEOUT_MS },
	);
	emit('preview', 200, 'INFO', write);
}

async function uploadAcceptedMedia(
	page: Page,
	invocation: CanaryInvocation,
	guard: CanaryLifecycleGuard,
	stage: StageRef,
	write: (line: string) => void,
): Promise<string> {
	await page.locator(`${CAPTURE_SELECTOR} input[type="file"]`).setInputFiles({
		name: 'canary.png',
		mimeType: 'image/png',
		buffer: createTinyNonPiiPng(),
	});
	const itemPrefix = `${invocation.itemsPath}/`;
	const reservationResponsePromise = page.waitForResponse((response) =>
		isResponseFor(response, 'POST', invocation.itemsPath),
	);
	const putResponsePromise = page.waitForResponse(
		(response) => response.request().method() === 'PUT',
	);
	const completionResponsePromise = page.waitForResponse(
		(response) =>
			response.request().method() === 'POST' &&
			new URL(response.url()).pathname.startsWith(itemPrefix) &&
			response.ok(),
	);
	const catalogResponsePromise = page.waitForResponse((response) =>
		isResponseFor(response, 'GET', invocation.itemsPath),
	);
	const previewResponsePromise = page.waitForResponse(
		(response) =>
			response.request().method() === 'GET' &&
			new URL(response.url()).pathname.startsWith(itemPrefix) &&
			response.ok(),
	);

	stage.current = 'reservation';
	await page.getByRole('button', { name: memoriesCaptureCopy.confirmUploadCount(1) }).click();
	const reservationResponse = await reservationResponsePromise;
	if (reservationResponse.status() !== 201) fail('reservation', 'RESERVATION_STATUS_REJECTED');
	const mediaId = readItemField(
		await readJson(reservationResponse, 'reservation'),
		'id',
		'reservation',
	);
	guard.registerMediaId(mediaId);
	emit('reservation', 201, 'INFO', write);

	stage.current = 'upload';
	const putResponse = await putResponsePromise;
	if (putResponse.status() < 200 || putResponse.status() >= 300)
		fail('upload', 'PUT_STATUS_REJECTED');
	emit('upload', putResponse.status(), 'INFO', write);

	stage.current = 'completion';
	const completionResponse = await completionResponsePromise;
	if (completionResponse.status() !== 200) fail('completion', 'COMPLETION_STATUS_REJECTED');
	if (
		readItemField(await readJson(completionResponse, 'completion'), 'status', 'completion') !==
		'accepted'
	) {
		fail('completion', 'MEDIA_NOT_ACCEPTED');
	}
	emit('completion', 200, 'INFO', write);

	stage.current = 'catalog';
	const catalogResponse = await catalogResponsePromise;
	if (catalogResponse.status() !== 200) fail('catalog', 'CATALOG_STATUS_REJECTED');
	const catalogItems = readCatalogItems(await readJson(catalogResponse, 'catalog'));
	if (!catalogItems.some((item) => item.id === mediaId && item.status === 'accepted')) {
		fail('catalog', 'ACCEPTED_MEDIA_NOT_VISIBLE');
	}
	emit('catalog', 200, 'INFO', write);

	stage.current = 'preview';
	await verifyPrivatePreview(
		page,
		await previewResponsePromise,
		`${itemPrefix}${encodeURIComponent(mediaId)}`,
		write,
	);
	return mediaId;
}

async function deleteAndConfirmAbsence(
	page: Page,
	invocation: CanaryInvocation,
	mediaId: string,
	stage: StageRef,
	write: (line: string) => void,
): Promise<void> {
	const mediaPath = `${invocation.itemsPath}/${encodeURIComponent(mediaId)}`;
	stage.current = 'deletion';
	const deletionResponsePromise = page.waitForResponse(
		(response) =>
			response.request().method() === 'DELETE' &&
			new URL(response.url()).pathname === mediaPath,
	);
	const absenceResponsePromise = page.waitForResponse((response) =>
		isResponseFor(response, 'GET', invocation.itemsPath),
	);
	await page
		.locator(`#mis-recuerdos img[src="${mediaPath}"]`)
		.first()
		.locator('xpath=ancestor::button')
		.click();
	const sheet = page.getByRole('dialog');
	// The first button asks for confirmation; the second deletes.
	await sheet.getByRole('button', { name: memoriesCaptureCopy.deleteMemory }).click();
	await sheet.getByRole('button', { name: memoriesCaptureCopy.deleteMemory }).click();
	const deletionResponse = await deletionResponsePromise;
	if (deletionResponse.status() !== 200) fail('deletion', 'DELETE_STATUS_REJECTED');
	emit('deletion', 200, 'INFO', write);

	stage.current = 'absence';
	const absenceResponse = await absenceResponsePromise;
	if (absenceResponse.status() !== 200) fail('absence', 'ABSENCE_STATUS_REJECTED');
	if (
		readCatalogItems(await readJson(absenceResponse, 'catalog')).some(
			(item) => item.id === mediaId,
		)
	) {
		fail('absence', 'DELETED_MEDIA_STILL_VISIBLE');
	}
	await page.locator(`img[src="${mediaPath}"]`).waitFor({ state: 'detached' });
	emit('absence', 200, 'INFO', write);
}

async function cleanupFailedLifecycle(
	page: Page | null,
	invocation: CanaryInvocation,
	mediaId: string | null,
	deletionConfirmed: boolean,
	guard: CanaryLifecycleGuard,
	write: (line: string) => void,
): Promise<{ deletionConfirmed: boolean; failure: CanaryFailure | null }> {
	if (!page || deletionConfirmed) return { deletionConfirmed, failure: null };
	const unconfirmed = {
		deletionConfirmed: false,
		failure: new CanaryFailure('cleanup', 'CLEANUP_UNCONFIRMED'),
	};
	if (mediaId && !guard.deleteAttempted) {
		try {
			const mediaPath = `${invocation.itemsPath}/${encodeURIComponent(mediaId)}`;
			const cleanupStatus = await authenticatedDelete(page, mediaPath);
			if (
				cleanupStatus === 200 &&
				(await confirmCatalogAbsence(page, invocation.itemsPath, mediaId))
			) {
				emit('cleanup', 200, 'INFO', write);
				return { deletionConfirmed: true, failure: null };
			}
		} catch {
			// Sanitized failure is returned below.
		}
		return unconfirmed;
	}
	if (mediaId && guard.deleteAttempted) {
		try {
			if (await confirmCatalogAbsence(page, invocation.itemsPath, mediaId)) {
				emit('cleanup', 'CONFIRMED', 'INFO', write);
				return { deletionConfirmed: true, failure: null };
			}
		} catch {
			// A second DELETE is intentionally forbidden.
		}
		return unconfirmed;
	}
	if (guard.reservationAttempted) return unconfirmed;
	return { deletionConfirmed: false, failure: null };
}

export async function runProductionCanary(
	invocation: CanaryInvocation,
	write: (line: string) => void = console.log,
): Promise<void> {
	const { chromium } = await import('@playwright/test');
	const guard = new CanaryLifecycleGuard(invocation);
	let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
	let page: Page | null = null;
	let mediaId: string | null = null;
	let deletionConfirmed = false;
	const stage: StageRef = { current: 'preflight' };
	let primaryFailure: CanaryFailure | null = null;
	let readInterceptedFailure: () => CanaryFailure | null = () => null;

	emit('preflight', 'READY', 'INFO', write);
	try {
		browser = await chromium.launch({ headless: true });
		const context = await browser.newContext({
			acceptDownloads: false,
			serviceWorkers: 'block',
		});
		page = await context.newPage();
		page.setDefaultTimeout(REQUEST_TIMEOUT_MS);
		readInterceptedFailure = await installLifecycleGuard(page, guard, stage);
		await openFreshGuestSession(page, invocation, stage, write);
		mediaId = await uploadAcceptedMedia(page, invocation, guard, stage, write);
		await deleteAndConfirmAbsence(page, invocation, mediaId, stage, write);
		deletionConfirmed = true;
		const interceptedFailure = readInterceptedFailure();
		if (interceptedFailure) throw interceptedFailure;
		guard.assertSuccessfulLifecycle();
	} catch (error) {
		primaryFailure = readInterceptedFailure() ?? normalizeFailure(error, stage.current);
	} finally {
		const cleanup = await cleanupFailedLifecycle(
			page,
			invocation,
			mediaId,
			deletionConfirmed,
			guard,
			write,
		);
		deletionConfirmed = cleanup.deletionConfirmed;
		primaryFailure = cleanup.failure ?? primaryFailure;
		await browser?.close().catch(() => undefined);
	}

	if (primaryFailure) throw primaryFailure;
	if (!deletionConfirmed) fail('cleanup', 'CLEANUP_UNCONFIRMED');
	emit('result', 'PASS', 'PASS', write);
}

export async function main(
	argv: readonly string[] = process.argv.slice(2),
	env: NodeJS.ProcessEnv = process.env,
	terminal: TerminalState = {
		stdin: process.stdin.isTTY === true,
		stdout: process.stdout.isTTY === true,
	},
): Promise<void> {
	try {
		const invocation = parseCanaryInvocation(argv, env, terminal);
		await runProductionCanary(invocation);
	} catch (error) {
		const failure = normalizeFailure(error, 'result');
		emit(failure.stage, failure.code, 'CRITICAL', console.error);
		emit('result', 'BLOCKED / FAILED', 'CRITICAL', console.error);
		process.exitCode = 1;
	}
}

const entryArg = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (
	entryArg.endsWith(`${path.sep}memories-production-canary.ts`) ||
	entryArg.endsWith(`${path.sep}memories-production-canary.js`)
) {
	void main();
}
