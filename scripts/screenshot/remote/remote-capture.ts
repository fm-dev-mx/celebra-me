import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import sharp from 'sharp';
import { buildScreenshotUrl } from '../navigation.ts';
import { disableAnimations, scrollForLazyLoad, waitForImages } from '../page-preparation.ts';
import { normalizeInvitationRevealedForCapture } from '../reveal.ts';
import {
	imageIdentity,
	normalizeLocation,
	REMOTE_MANIFEST_FILE,
	REMOTE_MANIFEST_SCHEMA_VERSION,
	REMOTE_VIEWPORTS,
	routeFileStem,
	type RemoteCaptureManifest,
	type RemoteImageRegion,
	type RemoteRouteRecord,
	type RemoteViewport,
	type RemoteViewportCapture,
} from './remote-manifest.ts';
import { decideRemoteRequest, type RemoteTarget } from './remote-target.ts';
import {
	buildRouteCandidates,
	findVistaPreviaPaths,
	VISTA_PREVIA_CONTENT_TYPE,
	type RemoteRouteCandidate,
	type RouteSources,
} from './route-inventory.ts';

const NAVIGATION_TIMEOUT_MS = 60_000;
const NETWORK_IDLE_TIMEOUT_MS = 10_000;
const PROBE_TIMEOUT_MS = 30_000;
const DEFAULT_CONCURRENCY = 3;

export interface RemoteCaptureOptions {
	target: RemoteTarget;
	label: string;
	outputDir: string;
	sources: RouteSources;
	clock: string;
	concurrency?: number;
	/** Restricts the run to these paths (debugging); the manifest says so through its route list. */
	onlyPaths?: string[];
	log?: (line: string) => void;
}

interface ProbeResult {
	status: number;
	location?: string;
	contentType?: string;
	body?: Buffer;
	error?: string;
}

/** One GET without following redirects; Access headers only for the target origin. */
async function probe(target: RemoteTarget, path: string, readBody: boolean): Promise<ProbeResult> {
	try {
		const response = await fetch(new URL(path, target.origin), {
			method: 'GET',
			redirect: 'manual',
			headers: target.accessHeaders,
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
		});
		const rawLocation = response.headers.get('location') ?? undefined;
		const body = readBody ? Buffer.from(await response.arrayBuffer()) : undefined;
		if (!readBody) await response.body?.cancel();
		return {
			status: response.status,
			location: rawLocation ? normalizeLocation(rawLocation, target.origin) : undefined,
			contentType: response.headers.get('content-type')?.split(';')[0]?.trim() || undefined,
			body,
		};
	} catch (error) {
		return { status: 0, error: error instanceof Error ? error.name : 'FetchError' };
	}
}

/**
 * Full-page captures paint fixed overlays (header, cookie banner) wherever the last scroll left
 * them. Pin each one to its first-viewport position so every capture places it the same way.
 */
async function pinFixedElements(page: Page): Promise<void> {
	await page.evaluate(() => {
		window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
		const all = Array.from(document.querySelectorAll<HTMLElement>('body *')).filter(
			(element) => window.getComputedStyle(element).position === 'fixed',
		);
		// Nested fixed elements move with their pinned ancestor.
		const fixed = all.filter(
			(element) => !all.some((other) => other !== element && other.contains(element)),
		);
		const boxes = fixed.map((element) => element.getBoundingClientRect());
		fixed.forEach((element, index) => {
			const box = boxes[index];
			element.style.setProperty('position', 'absolute', 'important');
			element.style.setProperty('top', `${box.top}px`, 'important');
			element.style.setProperty('left', `${box.left}px`, 'important');
			element.style.setProperty('right', 'auto', 'important');
			element.style.setProperty('bottom', 'auto', 'important');
			element.style.setProperty('width', `${box.width}px`, 'important');
			element.style.setProperty('height', `${box.height}px`, 'important');
			element.style.setProperty('transform', 'none', 'important');
		});
	});
	await page.waitForTimeout(100);
}

async function collectImageRegions(page: Page): Promise<RemoteImageRegion[]> {
	const raw = await page.evaluate(() => {
		const regions: Array<{
			kind: 'img' | 'background' | 'embed';
			source: string;
			box: { x: number; y: number; width: number; height: number };
			loaded?: boolean;
		}> = [];
		const boxOf = (element: Element) => {
			const rect = element.getBoundingClientRect();
			return {
				x: Math.round(rect.left + window.scrollX),
				y: Math.round(rect.top + window.scrollY),
				width: Math.round(rect.width),
				height: Math.round(rect.height),
			};
		};
		const isVector = (source: string) =>
			/^data:image\/svg/i.test(source) || /\.svg(?:$|[?#])/i.test(source);
		const isShown = (element: Element) => {
			const style = window.getComputedStyle(element);
			return style.visibility !== 'hidden' && style.display !== 'none';
		};
		for (const element of Array.from(document.querySelectorAll('*'))) {
			if (!isShown(element)) continue;
			const box = boxOf(element);
			if (box.width < 2 || box.height < 2) continue;
			if (element instanceof HTMLImageElement) {
				const source = element.currentSrc || element.src;
				if (!source || isVector(source)) continue;
				regions.push({
					kind: 'img',
					source,
					box,
					loaded: element.complete && element.naturalWidth > 0,
				});
				continue;
			}
			if (element instanceof HTMLVideoElement || element instanceof HTMLIFrameElement) {
				regions.push({ kind: 'embed', source: element.src || element.tagName, box });
				continue;
			}
			if (box.width < 32 || box.height < 32) continue;
			const background = window.getComputedStyle(element).backgroundImage;
			for (const match of background.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
				if (isVector(match[1]) || match[1].startsWith('data:')) continue;
				regions.push({ kind: 'background', source: match[1], box });
				break;
			}
		}
		return regions;
	});
	return raw.map(({ source, ...region }) => ({ ...region, identity: imageIdentity(source) }));
}

async function captureViewport(
	browser: Browser,
	options: RemoteCaptureOptions,
	route: RemoteRouteCandidate,
	viewport: RemoteViewport,
	wantHtml: boolean,
): Promise<{ capture: RemoteViewportCapture; html?: string }> {
	const { target } = options;
	const file = `${routeFileStem(route.path)}.${viewport.name}.png`;
	const context = await browser.newContext({
		viewport: { width: viewport.width, height: viewport.height },
		deviceScaleFactor: 1,
		isMobile: viewport.isMobile,
		hasTouch: viewport.isMobile,
		reducedMotion: 'reduce',
		locale: 'es-MX',
		timezoneId: 'America/Mazatlan',
		serviceWorkers: 'block',
	});
	// tsx keeps function names through an `__name` helper that browser-side callbacks lack.
	await context.addInitScript({ content: 'globalThis.__name = (fn) => fn;' });
	const page = await context.newPage();
	try {
		await page.route('**/*', async (request) => {
			const decision = decideRemoteRequest(
				target,
				request.request().method(),
				request.request().url(),
			);
			if (decision === 'abort') return request.abort('blockedbyclient');
			if (decision === 'continue-with-access') {
				return request.continue({
					headers: { ...request.request().headers(), ...target.accessHeaders },
				});
			}
			return request.continue();
		});
		await page.clock.setFixedTime(new Date(options.clock));
		const response = await page.goto(
			buildScreenshotUrl(new URL(route.path, target.origin).toString(), 'open'),
			{ waitUntil: 'load', timeout: NAVIGATION_TIMEOUT_MS },
		);
		await page
			.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_TIMEOUT_MS })
			.catch(() => undefined);
		await normalizeInvitationRevealedForCapture(page).catch(() => undefined);
		await page.evaluate(() => {
			document.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => {
				img.loading = 'eager';
			});
		});
		// Smooth scrolling off first, so the return to the top is instant.
		await disableAnimations(page);
		await scrollForLazyLoad(page, { force: true });
		await waitForImages(page);
		await page.evaluate(() => document.fonts.ready).catch(() => undefined);
		await pinFixedElements(page);
		const images = await collectImageRegions(page);
		const png = await page.screenshot({
			fullPage: true,
			animations: 'disabled',
			caret: 'hide',
			timeout: NAVIGATION_TIMEOUT_MS,
		});
		writeFileSync(join(options.outputDir, file), png);
		const meta = await sharp(png).metadata();
		const finalUrl = new URL(page.url());
		return {
			capture: {
				file,
				width: meta.width ?? 0,
				height: meta.height ?? 0,
				status: response?.status() ?? 0,
				finalPath: finalUrl.origin === target.origin ? finalUrl.pathname : finalUrl.origin,
				images,
			},
			html: wantHtml ? await page.content() : undefined,
		};
	} catch (error) {
		return {
			capture: {
				file,
				width: 0,
				height: 0,
				status: 0,
				finalPath: route.path,
				images: [],
				error:
					error instanceof Error ? error.message.split('\n')[0].slice(0, 200) : 'error',
			},
		};
	} finally {
		await context.close();
	}
}

async function captureRoute(
	browser: Browser,
	options: RemoteCaptureOptions,
	route: RemoteRouteCandidate,
	onHtml: (html: string) => void,
): Promise<RemoteRouteRecord> {
	const isAsset = route.kind === 'asset';
	const result = await probe(options.target, route.path, isAsset);
	const record: RemoteRouteRecord = {
		...route,
		status: result.status,
		location: result.location,
		contentType: result.contentType,
		live: !(route.lifecycle === 'in_progress' && result.status === 404),
		captures: {},
		error: result.error,
	};
	if (isAsset && result.body) {
		const meta = await sharp(result.body)
			.metadata()
			.catch(() => undefined);
		record.asset = { bytes: result.body.byteLength, width: meta?.width, height: meta?.height };
	}
	if (route.kind !== 'page' || !record.live || result.status === 0) return record;
	for (const viewport of REMOTE_VIEWPORTS) {
		const { capture, html } = await captureViewport(
			browser,
			options,
			route,
			viewport,
			viewport.name === 'desktop',
		);
		record.captures[viewport.name] = capture;
		if (html) onHtml(html);
	}
	return record;
}

async function runPool<T, R>(
	items: T[],
	concurrency: number,
	worker: (item: T) => Promise<R>,
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let next = 0;
	await Promise.all(
		Array.from({ length: Math.min(concurrency, items.length) }, async () => {
			while (next < items.length) {
				const index = next++;
				results[index] = await worker(items[index]);
			}
		}),
	);
	return results;
}

export async function captureRemoteRoutes(
	options: RemoteCaptureOptions,
): Promise<RemoteCaptureManifest> {
	const log = options.log ?? (() => undefined);
	mkdirSync(options.outputDir, { recursive: true });
	const filter = (routes: RemoteRouteCandidate[]) =>
		options.onlyPaths?.length
			? routes.filter((route) => options.onlyPaths?.includes(route.path))
			: routes;
	const candidates = filter(buildRouteCandidates(options.sources));
	const discoveredPhotos = new Set<string>();
	const browser = await chromium.launch();
	let routes: RemoteRouteRecord[];
	try {
		routes = await runPool(
			candidates,
			options.concurrency ?? DEFAULT_CONCURRENCY,
			async (route) => {
				const record = await captureRoute(browser, options, route, (html) => {
					for (const path of findVistaPreviaPaths(html, options.target.origin)) {
						discoveredPhotos.add(path);
					}
				});
				log(`${String(record.status).padStart(3)} ${route.kind.padEnd(8)} ${route.path}`);
				return record;
			},
		);
		// One discovered unpaid photo is enough to prove the watermark route serves images.
		const known = new Set(candidates.map((route) => route.path));
		const photo = [...discoveredPhotos].find((path) => !known.has(path));
		if (photo && !candidates.some((route) => route.kind === 'asset')) {
			const record = await captureRoute(
				browser,
				options,
				{
					path: photo,
					kind: 'asset',
					group: 'preview-photo',
					expectedContentType: VISTA_PREVIA_CONTENT_TYPE,
				},
				() => undefined,
			);
			log(`${String(record.status).padStart(3)} asset    ${photo}`);
			routes.push(record);
		}
	} finally {
		await browser.close();
	}
	const manifest: RemoteCaptureManifest = {
		schemaVersion: REMOTE_MANIFEST_SCHEMA_VERSION,
		label: options.label,
		origin: options.target.origin,
		originKind: options.target.kind,
		capturedAt: new Date().toISOString(),
		clock: options.clock,
		viewports: [...REMOTE_VIEWPORTS],
		routes,
	};
	writeFileSync(
		join(options.outputDir, REMOTE_MANIFEST_FILE),
		`${JSON.stringify(manifest, null, 2)}\n`,
	);
	return manifest;
}
