import path from 'node:path';
import type { Page, Request, Response, Route } from '@playwright/test';
import {
	VALENTINA_MEMORIES_ROUTE_PATH,
	valentinaMemoriesCaptureCopy,
} from '../../src/data/valentina-memories.data';
import { getValentinaMemoriesBrowserOrigins } from '../../src/data/valentina-memories-upload.contract';

const ITEMS_PATH = '/api/memories/valentina/items';
const SESSION_PATH = '/api/memories/valentina/session';
const MAX_COMPLETION_ATTEMPTS = 3;
const SESSION_DISPLAY_NAME = 'Canario Valentina';
const REQUEST_TIMEOUT_MS = 30_000;
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

export const VALENTINA_MEMORIES_PRODUCTION_CONFIRMATION =
	'I_AUTHORIZE_ONE_VALENTINA_MEMORIES_PRODUCTION_CANARY' as const;

const productionOrigins = getValentinaMemoriesBrowserOrigins('production');
if (productionOrigins.length !== 1) {
	throw new Error('Valentina Memories must have exactly one canonical Production origin.');
}

export const VALENTINA_MEMORIES_PRODUCTION_CANARY_DESTINATION = new URL(
	VALENTINA_MEMORIES_ROUTE_PATH,
	productionOrigins[0],
).href;

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
	destination: typeof VALENTINA_MEMORIES_PRODUCTION_CANARY_DESTINATION;
};

type TerminalState = {
	stdin: boolean;
	stdout: boolean;
};

type RequestObservation = {
	method: string;
	url: string;
	body: string | null;
};

type LifecycleCounts = {
	sessionCreations: number;
	reservations: number;
	puts: number;
	completions: number;
	deletes: number;
};

type CatalogItem = {
	id: string;
	status: string;
};

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
		if (key !== 'destination' && key !== 'confirm-production')
			fail('preflight', 'UNKNOWN_ARGUMENT');
		if (values.has(key)) fail('preflight', 'DUPLICATE_ARGUMENT');
		values.set(key, value);
	}

	if (values.size !== 2) fail('preflight', 'REQUIRED_ARGUMENT_MISSING');
	if (values.get('confirm-production') !== VALENTINA_MEMORIES_PRODUCTION_CONFIRMATION)
		fail('preflight', 'PRODUCTION_CONFIRMATION_REJECTED');

	const destination = values.get('destination');
	try {
		if (
			!destination ||
			new URL(destination).href !== VALENTINA_MEMORIES_PRODUCTION_CANARY_DESTINATION
		) {
			fail('preflight', 'NONCANONICAL_DESTINATION_REJECTED');
		}
	} catch (error) {
		if (error instanceof CanaryFailure) throw error;
		fail('preflight', 'NONCANONICAL_DESTINATION_REJECTED');
	}

	return { destination: VALENTINA_MEMORIES_PRODUCTION_CANARY_DESTINATION };
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

function itemPathFromUrl(url: URL): string | null {
	if (!url.pathname.startsWith(`${ITEMS_PATH}/`)) return null;
	const suffix = url.pathname.slice(ITEMS_PATH.length + 1);
	return suffix && !suffix.includes('/') ? url.pathname : null;
}

export class CanaryLifecycleGuard {
	private readonly productionOrigin = new URL(VALENTINA_MEMORIES_PRODUCTION_CANARY_DESTINATION)
		.origin;
	private readonly state: LifecycleCounts = {
		sessionCreations: 0,
		reservations: 0,
		puts: 0,
		completions: 0,
		deletes: 0,
	};
	private lifecycleItemPath: string | null = null;

	observe(observation: RequestObservation): void {
		const method = observation.method.toUpperCase();
		const url = new URL(observation.url);

		if (method === 'PUT') {
			this.observePut(url);
			return;
		}

		if (url.origin !== this.productionOrigin) return;

		if (method === 'POST' && url.pathname === SESSION_PATH) {
			this.observeSessionCreation(observation.body);
			return;
		}

		if (method === 'POST' && url.pathname === ITEMS_PATH) {
			this.observeReservation(observation.body);
			return;
		}

		const itemPath = itemPathFromUrl(url);
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
		if (
			!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
				mediaId,
			)
		) {
			fail('reservation', 'INVALID_MEDIA_ID');
		}
		const expectedPath = `${ITEMS_PATH}/${encodeURIComponent(mediaId)}`;
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
	return {
		method: request.method(),
		url: request.url(),
		body: request.postData(),
	};
}

function isResponseFor(response: Response, method: string, pathname: string): boolean {
	const request = response.request();
	return request.method() === method && new URL(response.url()).pathname === pathname;
}

async function readJson(response: Response, stage: CanaryStage): Promise<Record<string, unknown>> {
	const payload: unknown = await response.json().catch(() => null);
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		fail(stage, 'INVALID_JSON_RESPONSE');
	}
	return payload as Record<string, unknown>;
}

function readReservationMediaId(payload: Record<string, unknown>): string {
	if (!payload.item || typeof payload.item !== 'object' || Array.isArray(payload.item)) {
		fail('reservation', 'RESERVATION_RESPONSE_REJECTED');
	}
	const item = payload.item as Record<string, unknown>;
	if (typeof item.id !== 'string') fail('reservation', 'RESERVATION_RESPONSE_REJECTED');
	return item.id;
}

function readCompletionStatus(payload: Record<string, unknown>): string {
	if (!payload.item || typeof payload.item !== 'object' || Array.isArray(payload.item)) {
		fail('completion', 'COMPLETION_RESPONSE_REJECTED');
	}
	const item = payload.item as Record<string, unknown>;
	if (typeof item.status !== 'string') fail('completion', 'COMPLETION_RESPONSE_REJECTED');
	return item.status;
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
		() => {
			const capture = document.querySelector('[data-capture="valentina-memories"]');
			const island = capture?.closest('astro-island');
			return Boolean(island && !island.hasAttribute('ssr'));
		},
		undefined,
		{ timeout: REQUEST_TIMEOUT_MS },
	);
}

async function authenticatedDelete(page: Page, mediaPath: string): Promise<number> {
	return page.evaluate(async (pathname) => {
		const response = await fetch(pathname, { method: 'DELETE' });
		return response.status;
	}, mediaPath);
}

async function confirmCatalogAbsence(page: Page, mediaId: string): Promise<boolean> {
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
		{ endpoint: ITEMS_PATH, targetId: mediaId },
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
		isResponseFor(response, 'GET', SESSION_PATH),
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
		isResponseFor(response, 'POST', SESSION_PATH),
	);
	const emptyCatalogResponsePromise = page.waitForResponse((response) =>
		isResponseFor(response, 'GET', ITEMS_PATH),
	);
	await page.getByLabel('Nombre o apodo').fill(SESSION_DISPLAY_NAME);
	await page.getByRole('button', { name: 'Continuar' }).click();
	const sessionResponse = await sessionResponsePromise;
	if (sessionResponse.status() !== 201) fail('session', 'SESSION_STATUS_REJECTED');
	const emptyCatalogResponse = await emptyCatalogResponsePromise;
	if (emptyCatalogResponse.status() !== 200) fail('session', 'INITIAL_CATALOG_STATUS_REJECTED');
	if (readCatalogItems(await readJson(emptyCatalogResponse, 'catalog')).length !== 0) {
		fail('session', 'FRESH_SESSION_CATALOG_NOT_EMPTY');
	}
	emit('session', 201, 'INFO', write);
}

function isSuccessfulCompletionResponse(response: Response): boolean {
	const request = response.request();
	return (
		request.method() === 'POST' &&
		new URL(response.url()).pathname.startsWith(`${ITEMS_PATH}/`) &&
		response.ok()
	);
}

function isPrivatePreviewResponse(response: Response): boolean {
	return (
		response.request().method() === 'GET' &&
		itemPathFromUrl(new URL(response.url())) !== null &&
		response.ok()
	);
}

async function verifyPrivatePreview(
	page: Page,
	response: Response,
	mediaId: string,
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
	const mediaPath = `${ITEMS_PATH}/${encodeURIComponent(mediaId)}`;
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
	guard: CanaryLifecycleGuard,
	stage: StageRef,
	write: (line: string) => void,
): Promise<string> {
	const fileInput = page.locator('[data-capture="valentina-memories"] input[type="file"]');
	await fileInput.setInputFiles({
		name: 'valentina-canary.png',
		mimeType: 'image/png',
		buffer: createTinyNonPiiPng(),
	});

	const reservationResponsePromise = page.waitForResponse((response) =>
		isResponseFor(response, 'POST', ITEMS_PATH),
	);
	const putResponsePromise = page.waitForResponse(
		(response) => response.request().method() === 'PUT',
	);
	const completionResponsePromise = page.waitForResponse(isSuccessfulCompletionResponse);
	const catalogResponsePromise = page.waitForResponse((response) =>
		isResponseFor(response, 'GET', ITEMS_PATH),
	);
	const previewResponsePromise = page.waitForResponse(isPrivatePreviewResponse);

	stage.current = 'reservation';
	await page.getByRole('button', { name: valentinaMemoriesCaptureCopy.confirmUpload }).click();
	const reservationResponse = await reservationResponsePromise;
	if (reservationResponse.status() !== 201) fail('reservation', 'RESERVATION_STATUS_REJECTED');
	const mediaId = readReservationMediaId(await readJson(reservationResponse, 'reservation'));
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
	const completedStatus = readCompletionStatus(await readJson(completionResponse, 'completion'));
	if (completedStatus !== 'accepted') fail('completion', 'MEDIA_NOT_ACCEPTED');
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
	await verifyPrivatePreview(page, await previewResponsePromise, mediaId, write);
	return mediaId;
}

async function deleteAndConfirmAbsence(
	page: Page,
	mediaId: string,
	stage: StageRef,
	write: (line: string) => void,
): Promise<void> {
	const mediaPath = `${ITEMS_PATH}/${encodeURIComponent(mediaId)}`;
	stage.current = 'deletion';
	const deletionResponsePromise = page.waitForResponse(
		(response) =>
			response.request().method() === 'DELETE' &&
			new URL(response.url()).pathname === mediaPath,
	);
	const absenceResponsePromise = page.waitForResponse((response) =>
		isResponseFor(response, 'GET', ITEMS_PATH),
	);
	page.once('dialog', (dialog) => void dialog.accept());
	await page
		.locator(`img[src="${mediaPath}"]`)
		.locator('xpath=ancestor::article')
		.getByRole('button', { name: valentinaMemoriesCaptureCopy.deleteMemory })
		.click();
	const deletionResponse = await deletionResponsePromise;
	if (deletionResponse.status() !== 200) fail('deletion', 'DELETE_STATUS_REJECTED');
	emit('deletion', 200, 'INFO', write);

	stage.current = 'absence';
	const absenceResponse = await absenceResponsePromise;
	if (absenceResponse.status() !== 200) fail('absence', 'ABSENCE_STATUS_REJECTED');
	const itemsAfterDelete = readCatalogItems(await readJson(absenceResponse, 'catalog'));
	if (itemsAfterDelete.some((item) => item.id === mediaId)) {
		fail('absence', 'DELETED_MEDIA_STILL_VISIBLE');
	}
	await page.locator(`img[src="${mediaPath}"]`).waitFor({ state: 'detached' });
	emit('absence', 200, 'INFO', write);
}

async function cleanupFailedLifecycle(
	page: Page | null,
	mediaId: string | null,
	deletionConfirmed: boolean,
	guard: CanaryLifecycleGuard,
	write: (line: string) => void,
): Promise<{ deletionConfirmed: boolean; failure: CanaryFailure | null }> {
	if (!page || deletionConfirmed) return { deletionConfirmed, failure: null };
	if (mediaId && !guard.deleteAttempted) {
		try {
			const mediaPath = `${ITEMS_PATH}/${encodeURIComponent(mediaId)}`;
			const cleanupStatus = await authenticatedDelete(page, mediaPath);
			const absent = cleanupStatus === 200 && (await confirmCatalogAbsence(page, mediaId));
			if (absent) {
				emit('cleanup', 200, 'INFO', write);
				return { deletionConfirmed: true, failure: null };
			}
		} catch {
			// Sanitized failure is returned below.
		}
		return {
			deletionConfirmed: false,
			failure: new CanaryFailure('cleanup', 'CLEANUP_UNCONFIRMED'),
		};
	}
	if (mediaId && guard.deleteAttempted) {
		try {
			if (await confirmCatalogAbsence(page, mediaId)) {
				emit('cleanup', 'CONFIRMED', 'INFO', write);
				return { deletionConfirmed: true, failure: null };
			}
		} catch {
			// Keep the failure sanitized below. A second DELETE is intentionally forbidden.
		}
		return {
			deletionConfirmed: false,
			failure: new CanaryFailure('cleanup', 'CLEANUP_UNCONFIRMED'),
		};
	}
	if (guard.reservationAttempted) {
		return {
			deletionConfirmed: false,
			failure: new CanaryFailure('cleanup', 'CLEANUP_UNCONFIRMED'),
		};
	}
	return { deletionConfirmed: false, failure: null };
}

export async function runProductionCanary(
	invocation: CanaryInvocation,
	write: (line: string) => void = console.log,
): Promise<void> {
	const { chromium } = await import('@playwright/test');
	const guard = new CanaryLifecycleGuard();
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
		mediaId = await uploadAcceptedMedia(page, guard, stage, write);
		await deleteAndConfirmAbsence(page, mediaId, stage, write);
		deletionConfirmed = true;
		const interceptedFailure = readInterceptedFailure();
		if (interceptedFailure) throw interceptedFailure;
		guard.assertSuccessfulLifecycle();
	} catch (error) {
		primaryFailure = readInterceptedFailure() ?? normalizeFailure(error, stage.current);
	} finally {
		const cleanup = await cleanupFailedLifecycle(
			page,
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
const isDirectRun =
	entryArg.endsWith(`${path.sep}valentina-memories-production-canary.ts`) ||
	entryArg.endsWith(`${path.sep}valentina-memories-production-canary.js`);

if (isDirectRun) {
	void main();
}
