#!/usr/bin/env tsx
/**
 * Read-only invitation delivery baseline. Fetches representative documents,
 * classifies discovered URLs, and records cache/timing/size evidence.
 *
 * Does not mutate data, providers, or cache architecture.
 *
 * Usage:
 *   pnpm invitation:delivery:baseline
 *   pnpm invitation:delivery:baseline --origin https://www.celebra-me.com --samples 5
 *   pnpm invitation:delivery:baseline --assert-budget
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
	inventoryInvitationHtml,
	isOriginRevalidatePublicDocument,
	isPrivateNoStoreCacheContract,
	selectHeroResource,
	type InvitationHtmlInventory,
} from '../../src/lib/invitation/delivery-contract.ts';
import { isMutableInPlaceMediaUrl } from '../../src/lib/assets/vercel-image-policy.ts';
import {
	assertDeliveryBudgets,
	type DeliveryBudgetScenario,
} from '../../src/lib/invitation/delivery-budget.ts';

interface CliOptions {
	origin: string;
	samples: number;
	assertBudget: boolean;
}

interface DocumentSample {
	ttfbMs: number;
	htmlBytes: number;
	cacheControl: string | null;
	vercelCache: string | null;
	renderTiming: string | null;
	renderTimingDetail: string | null;
}

interface AssetProbe {
	url: string;
	kind: string;
	status: number;
	bytes: number | null;
	cacheControl: string | null;
	etag: string | null;
	vercelCache: string | null;
	cfCacheStatus: string | null;
}

interface ScenarioReport {
	id: DeliveryBudgetScenario;
	path: string;
	personalized: boolean;
	document: {
		samples: DocumentSample[];
		ttfbMs: { min: number; median: number; max: number };
		htmlBytes: number;
		cacheControl: string | null;
		vercelCacheFirst: string | null;
		vercelCacheRepeat: string | null;
		renderTimingDetail: string | null;
	};
	inventory: {
		uniqueUrlCount: number;
		vercelImageCount: number;
		supabaseStorageCount: number;
		cloudinaryCount: number;
		astroHashedCount: number;
		eagerImageCount: number;
		lazyImageCount: number;
		duplicateUrlCount: number;
		mutableStorageThroughVercelImageCount: number;
	};
	hero: {
		url: string | null;
		kind: string | null;
		deliveredBytes: number | null;
		originBytes: number | null;
		originUrl: string | null;
		cacheControl: string | null;
		repeatCacheControl: string | null;
		repeatVercelCache: string | null;
	};
	astroAsset: AssetProbe | null;
}

function parseArgs(argv: string[]): CliOptions {
	const originIndex = argv.indexOf('--origin');
	const samplesIndex = argv.indexOf('--samples');
	const origin = originIndex >= 0 ? argv[originIndex + 1] : process.env.BASE_URL;
	return {
		origin: (origin || 'https://www.celebra-me.com').replace(/\/$/, ''),
		samples: Math.max(
			1,
			Number.parseInt(samplesIndex >= 0 ? argv[samplesIndex + 1] : '5', 10) || 5,
		),
		assertBudget: argv.includes('--assert-budget'),
	};
}

function median(values: number[]): number {
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	if (sorted.length % 2 === 0) {
		return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
	}
	return sorted[middle];
}

function absoluteUrl(origin: string, url: string): string {
	if (url.startsWith('http://') || url.startsWith('https://')) return url;
	return new URL(url, `${origin}/`).href;
}

async function probeAsset(url: string, kind: string): Promise<AssetProbe> {
	const response = await fetch(url, { method: 'GET', redirect: 'follow' });
	const buffer = Buffer.from(await response.arrayBuffer());
	return {
		url,
		kind,
		status: response.status,
		bytes: buffer.byteLength,
		cacheControl: response.headers.get('cache-control'),
		etag: response.headers.get('etag'),
		vercelCache: response.headers.get('x-vercel-cache'),
		cfCacheStatus: response.headers.get('cf-cache-status'),
	};
}

async function fetchDocument(url: string): Promise<{ sample: DocumentSample; html: string }> {
	const started = performance.now();
	const response = await fetch(url, {
		method: 'GET',
		headers: { Accept: 'text/html' },
		redirect: 'follow',
	});
	const ttfbMs = Math.round(performance.now() - started);
	const html = await response.text();
	return {
		html,
		sample: {
			ttfbMs,
			htmlBytes: Buffer.byteLength(html),
			cacheControl: response.headers.get('cache-control'),
			vercelCache: response.headers.get('x-vercel-cache'),
			renderTiming: response.headers.get('x-render-timing'),
			renderTimingDetail: response.headers.get('x-render-timing-detail'),
		},
	};
}

function summarizeInventory(inventory: InvitationHtmlInventory) {
	return {
		uniqueUrlCount: inventory.uniqueUrlCount,
		vercelImageCount: inventory.vercelImageCount,
		supabaseStorageCount: inventory.supabaseStorageCount,
		cloudinaryCount: inventory.cloudinaryCount,
		astroHashedCount: inventory.astroHashedCount,
		eagerImageCount: inventory.eagerImageCount,
		lazyImageCount: inventory.lazyImageCount,
		duplicateUrlCount: inventory.duplicateUrls.length,
		mutableStorageThroughVercelImageCount: inventory.mutableStorageThroughVercelImage.length,
	};
}

async function collectDocumentSamples(
	url: string,
	samples: number,
): Promise<{ html: string; samples: DocumentSample[]; repeat: DocumentSample }> {
	const documentSamples: DocumentSample[] = [];
	let html = '';
	for (let index = 0; index < samples; index += 1) {
		const result = await fetchDocument(url);
		html = result.html;
		documentSamples.push(result.sample);
	}
	const repeat = await fetchDocument(url);
	return { html, samples: documentSamples, repeat: repeat.sample };
}

function mutableHeroOriginUrl(
	hero: ReturnType<typeof selectHeroResource>,
	heroUrl: string | null,
): string | null {
	if (hero?.optimizedSource && isMutableInPlaceMediaUrl(hero.optimizedSource)) {
		return hero.optimizedSource;
	}
	if (hero?.kind === 'supabase-storage') return heroUrl;
	return null;
}

async function probeOptional(url: string | null, kind: string): Promise<AssetProbe | null> {
	if (!url) return null;
	return probeAsset(url, kind);
}

function toHeroReport(
	heroUrl: string | null,
	kind: string | null,
	heroProbe: AssetProbe | null,
	originProbe: AssetProbe | null,
	heroRepeat: AssetProbe | null,
): ScenarioReport['hero'] {
	return {
		url: heroUrl,
		kind,
		deliveredBytes: heroProbe?.bytes ?? null,
		originBytes: originProbe?.bytes ?? null,
		originUrl: originProbe?.url ?? null,
		cacheControl: heroProbe?.cacheControl ?? null,
		repeatCacheControl: heroRepeat?.cacheControl ?? null,
		repeatVercelCache: heroRepeat?.vercelCache ?? null,
	};
}

async function probeHeroDelivery(
	origin: string,
	inventory: InvitationHtmlInventory,
): Promise<ScenarioReport['hero']> {
	const hero = selectHeroResource(inventory);
	const heroUrl = hero ? absoluteUrl(origin, hero.url) : null;
	const kind = hero ? hero.kind : 'other';
	const heroProbe = await probeOptional(heroUrl, kind);
	const originProbe = await probeOptional(
		mutableHeroOriginUrl(hero, heroUrl),
		'supabase-storage',
	);
	const heroRepeat = await probeOptional(heroProbe ? heroProbe.url : null, kind);
	return toHeroReport(heroUrl, hero ? hero.kind : null, heroProbe, originProbe, heroRepeat);
}

async function probeHashedAstroAsset(
	origin: string,
	inventory: InvitationHtmlInventory,
): Promise<AssetProbe | null> {
	const astroResource = inventory.resources.find((resource) => resource.kind === 'astro-hashed');
	if (!astroResource) return null;
	await probeAsset(absoluteUrl(origin, astroResource.url), 'astro-hashed');
	return probeAsset(absoluteUrl(origin, astroResource.url), 'astro-hashed');
}

function summarizeDocument(
	documentSamples: DocumentSample[],
	repeat: DocumentSample,
): ScenarioReport['document'] {
	const ttfbValues = documentSamples.map((sample) => sample.ttfbMs);
	const last = documentSamples[documentSamples.length - 1];
	return {
		samples: documentSamples,
		ttfbMs: {
			min: Math.min(...ttfbValues),
			median: median(ttfbValues),
			max: Math.max(...ttfbValues),
		},
		htmlBytes: last?.htmlBytes ?? 0,
		cacheControl: last?.cacheControl ?? null,
		vercelCacheFirst: documentSamples[0]?.vercelCache ?? null,
		vercelCacheRepeat: repeat.vercelCache,
		renderTimingDetail:
			documentSamples.find((sample) => sample.renderTimingDetail)?.renderTimingDetail ?? null,
	};
}

async function measureScenario(
	origin: string,
	id: DeliveryBudgetScenario,
	path: string,
	personalized: boolean,
	samples: number,
): Promise<ScenarioReport> {
	const collected = await collectDocumentSamples(`${origin}${path}`, samples);
	const inventory = inventoryInvitationHtml(collected.html);
	const [hero, astroAsset] = await Promise.all([
		probeHeroDelivery(origin, inventory),
		probeHashedAstroAsset(origin, inventory),
	]);
	return {
		id,
		path,
		personalized,
		document: summarizeDocument(collected.samples, collected.repeat),
		inventory: summarizeInventory(inventory),
		hero,
		astroAsset,
	};
}

function printScenario(report: ScenarioReport): void {
	const cacheOk = report.personalized
		? isPrivateNoStoreCacheContract(report.document.cacheControl ?? '')
		: isOriginRevalidatePublicDocument(report.document.cacheControl ?? '');
	console.log(`\n[${report.id}] ${report.path}`);
	console.log(`  cache: ${report.document.cacheControl ?? '(none)'} ${cacheOk ? 'OK' : 'FAIL'}`);
	console.log(
		`  html: ${report.document.htmlBytes} B | ttfb ms min/median/max ${report.document.ttfbMs.min}/${report.document.ttfbMs.median}/${report.document.ttfbMs.max}`,
	);
	console.log(
		`  vercel-cache document first/repeat: ${report.document.vercelCacheFirst}/${report.document.vercelCacheRepeat}`,
	);
	console.log(`  render: ${report.document.renderTimingDetail ?? '(none)'}`);
	console.log(
		`  urls unique=${report.inventory.uniqueUrlCount} vercel-image=${report.inventory.vercelImageCount} storage=${report.inventory.supabaseStorageCount} cloudinary=${report.inventory.cloudinaryCount} astro=${report.inventory.astroHashedCount} lazy-img=${report.inventory.lazyImageCount} eager-img=${report.inventory.eagerImageCount} stale-vercel-storage=${report.inventory.mutableStorageThroughVercelImageCount}`,
	);
	console.log(
		`  hero kind=${report.hero.kind ?? 'n/a'} delivered=${report.hero.deliveredBytes ?? 'n/a'} origin=${report.hero.originBytes ?? 'n/a'} cache=${report.hero.cacheControl ?? 'n/a'}`,
	);
}

async function main(): Promise<void> {
	const options = parseArgs(process.argv.slice(2));
	const startedAt = new Date().toISOString();
	const reports = [
		await measureScenario(
			options.origin,
			'versionedAnonymous',
			'/xv/renata',
			false,
			options.samples,
		),
		await measureScenario(
			options.origin,
			'legacyStorageAnonymous',
			'/xv/romina-rios-chaparro',
			false,
			options.samples,
		),
		await measureScenario(
			options.origin,
			'personalizedLookupMiss',
			'/xv/renata?invite=fixture-not-a-guest',
			true,
			options.samples,
		),
	];

	for (const report of reports) printScenario(report);

	const payload = {
		measuredAt: startedAt,
		origin: options.origin,
		samples: options.samples,
		viewport: 'document-only (no browser layout)',
		connection: 'unthrottled operator network',
		notes: [
			'Personalized scenario uses a synthetic invite id; no guest PII is requested or stored.',
			'LCP is not measured here; use a browser trace for paint timing.',
			'Production HTML may still wrap legacy Storage URLs in /_vercel/image until the cache-safe image change is deployed.',
		],
		scenarios: reports,
	};

	const outputPath = resolve(
		process.cwd(),
		'.tmp/observability/invitation-delivery-baseline.json',
	);
	mkdirSync(dirname(outputPath), { recursive: true });
	writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
	console.log(`\nWrote ${outputPath.replaceAll('\\', '/')}`);

	if (options.assertBudget) {
		assertDeliveryBudgets(
			reports.map((report) => ({
				id: report.id,
				htmlBytes: report.document.htmlBytes,
				uniqueUrlCount: report.inventory.uniqueUrlCount,
				cacheControl: report.document.cacheControl,
				personalized: report.personalized,
				vercelCache: report.document.vercelCacheRepeat,
			})),
		);
		console.log('Budget assertions passed.');
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
