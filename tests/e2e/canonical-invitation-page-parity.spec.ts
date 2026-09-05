import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { listInvitationDefinitions } from '../../scripts/provision/invitations/registry';
import {
	hashAssetDirectory,
	hashAssetFiles,
	hashVisualValue,
	VISUAL_PARITY_RUNTIME,
} from './harness/visual-parity-metadata';
import { buildSemanticAssetMap } from '../../scripts/provision/normalized-invitation-release';
import {
	assertVisualComparisonReady,
	shouldCompareVisualSnapshots,
	visualComparisonResult,
} from './harness/visual-baseline-policy';
import {
	buildVisualPageCases,
	VISUAL_VIEWPORTS,
	computeVisualMatrixHash,
	type VisualPageCase,
} from '../../scripts/screenshot/visual-coverage-contract';

const VIEWPORTS = VISUAL_VIEWPORTS;
const VISUAL_PARITY_MODE = (process.env.VISUAL_PARITY_MODE ??
	(process.env.CI ? 'compare' : 'diagnostic')) as 'diagnostic' | 'candidate' | 'compare';
const ACCEPTED_BASELINES_MANIFEST = path.resolve(
	process.cwd(),
	'tests/e2e/visual-baselines/manifest.json',
);
assertVisualComparisonReady(VISUAL_PARITY_MODE, ACCEPTED_BASELINES_MANIFEST);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface PageCapture {
	kind: VisualPageCase['kind'];
	slug: string;
	eventType: string;
	preset?: string;
	viewport: string;
	file: string;
	sha256: string;
	contentHash: string;
	assetHash: string;
	comparisonResult: 'PASS' | 'CANDIDATE';
}

const PAGE_CASES: VisualPageCase[] = buildVisualPageCases();

const EXPECTED_CAPTURE_COUNT = PAGE_CASES.length * VIEWPORTS.length;
const captures: PageCapture[] = [];

function isAllowedVisualAssetUrl(rawUrl: string, baseOrigin: string): boolean {
	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		return false;
	}
	if (url.origin === baseOrigin) return true;

	const configuredOrigins = [process.env.PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL]
		.filter((value): value is string => Boolean(value))
		.map((value) => {
			try {
				return new URL(value).origin;
			} catch {
				return null;
			}
		})
		.filter((origin): origin is string => origin !== null);
	if (
		configuredOrigins.includes(url.origin) &&
		url.pathname.startsWith('/storage/v1/object/public/invitation-assets/')
	) {
		return true;
	}
	if (
		url.hostname === '127.0.0.1' &&
		url.port === '54321' &&
		url.pathname.startsWith('/storage/v1/object/public/invitation-assets/')
	) {
		return true;
	}
	if (
		url.hostname === 'res.cloudinary.com' &&
		url.pathname.startsWith('/dusxvauvj/image/upload/')
	) {
		return true;
	}
	return /^(?:a|b|c)\.basemaps\.cartocdn\.com$/u.test(url.hostname);
}

test.describe('Canonical invitation complete-page visual parity', () => {
	for (const entry of PAGE_CASES) {
		for (const viewport of VIEWPORTS) {
			test(`${entry.kind}: ${entry.eventType}/${entry.slug} @ ${viewport.name}`, async ({
				page,
			}, testInfo) => {
				const externalRequests: string[] = [];
				const failedResponses: string[] = [];
				const consoleErrors: string[] = [];
				const pageErrors: string[] = [];
				const baseOrigin = new URL(String(testInfo.project.use.baseURL)).origin;
				await page.route('**/*', async (route) => {
					const requestUrl = route.request().url();
					if (
						/^https?:/i.test(requestUrl) &&
						!isAllowedVisualAssetUrl(requestUrl, baseOrigin)
					) {
						externalRequests.push(requestUrl);
						await route.abort();
						return;
					}
					await route.continue();
				});

				page.on('response', (response) => {
					if (response.url().startsWith(baseOrigin) && response.status() >= 400)
						failedResponses.push(String(response.status()) + ' ' + response.url());
				});
				page.on('console', (message) => {
					if (message.type() === 'error') consoleErrors.push(message.text());
				});
				page.on('pageerror', (error) => pageErrors.push(error.message));

				await page.setViewportSize({ width: viewport.width, height: viewport.height });
				const query = new URLSearchParams({
					skipEnvelope: 'true',
					screenshot: 'true',
					animations: 'off',
				});
				const response = await page.goto(
					`/${entry.eventType}/${entry.slug}?${query.toString()}`,
					{
						waitUntil: 'load',
					},
				);
				expect(response?.status()).toBe(200);
				// Only configured application assets and map tiles may leave the page origin.
				expect(
					externalRequests,
					'Unexpected external dependencies must fail the visual gate.',
				).toEqual([]);
				await page.evaluate(() => document.fonts?.ready);
				await page.evaluate(async () => {
					const maxScroll = Math.max(
						document.documentElement.scrollHeight,
						window.innerHeight,
					);
					for (let y = 0; y <= maxScroll; y += Math.max(window.innerHeight, 1)) {
						window.scrollTo(0, y);
						await new Promise((resolve) =>
							requestAnimationFrame(() => resolve(undefined)),
						);
					}
					window.scrollTo(0, 0);
				});
				await page.evaluate(async () => {
					await Promise.all(
						Array.from(document.images).map((image) =>
							image.complete
								? Promise.resolve()
								: new Promise<void>((resolve) => {
										const done = () => {
											window.clearTimeout(timeout);
											resolve();
										};
										const timeout = window.setTimeout(done, 1000);
										image.addEventListener('load', done, { once: true });
										image.addEventListener('error', done, { once: true });
									}),
						),
					);
				});

				const audit = await page.evaluate(() => {
					const issues: string[] = [];
					for (const section of Array.from(
						document.querySelectorAll<HTMLElement>(
							'[data-section-id], .invitation-section-wrapper[data-section-kind]',
						),
					)) {
						const rect = section.getBoundingClientRect();
						if (rect.left < -2 || rect.right > window.innerWidth + 2)
							issues.push(section.dataset.sectionId ?? 'unknown');
					}
					const brokenImages = Array.from(document.images)
						.filter((image) => image.currentSrc && image.naturalWidth === 0)
						.map((image) => image.currentSrc);
					return {
						scrollWidth: document.documentElement.scrollWidth,
						viewportWidth: window.innerWidth,
						sections: document.querySelectorAll(
							'[data-section-id], .invitation-section-wrapper[data-section-kind]',
						).length,
						root: Boolean(
							document.querySelector('#test-invitation-root, .event-theme-wrapper'),
						),
						issues,
						brokenImages,
					};
				});
				expect(audit.root).toBe(true);
				expect(audit.sections).toBeGreaterThan(0);
				expect(audit.scrollWidth).toBeLessThanOrEqual(audit.viewportWidth);
				expect(audit.issues).toEqual([]);
				expect(audit.brokenImages).toEqual([]);
				expect(failedResponses).toEqual([]);
				expect(consoleErrors).toEqual([]);
				expect(pageErrors).toEqual([]);

				const definition =
					entry.kind === 'invitation'
						? listInvitationDefinitions().find(
								(candidate) => candidate.slug === entry.slug,
							)
						: undefined;
				if (definition) {
					const publishedContent = definition.buildPublishedContent(
						buildSemanticAssetMap(definition),
					) as { sectionOrder?: unknown };
					const expectedSectionOrder = Array.isArray(publishedContent.sectionOrder)
						? publishedContent.sectionOrder.map((section) =>
								String(
									section === 'personalizedAccess'
										? 'personalized-access'
										: section,
								),
							)
						: [];
					const actualSectionOrder = await page
						.locator('.invitation-section-wrapper[data-section-kind]')
						.evaluateAll((sections) =>
							sections
								.map((section) => section.getAttribute('data-section-kind'))
								.filter(
									(section): section is string =>
										section !== null && section !== 'interlude',
								),
						);
					expect(actualSectionOrder).toEqual(expectedSectionOrder);
					expect(
						await page
							.locator('.event-theme-wrapper')
							.getAttribute('data-content-source'),
					).toBe('published');
					expect(
						await page
							.locator('.event-theme-wrapper')
							.getAttribute('data-content-version'),
					).toMatch(/^[1-9]\d*$/u);
				}

				await page.waitForTimeout(100);
				const snapshotName = `pages/${entry.kind}-${entry.eventType}-${entry.slug}-${viewport.name}.png`;
				const pageHeight = await page.evaluate(() =>
					Math.max(document.documentElement.scrollHeight, window.innerHeight),
				);
				const screenshotOptions = {
					animations: 'disabled' as const,
					clip: { x: 0, y: 0, width: viewport.width, height: pageHeight },
				};
				const image = await page.screenshot(screenshotOptions);
				if (shouldCompareVisualSnapshots(VISUAL_PARITY_MODE)) {
					expect(image).toMatchSnapshot(snapshotName, {
						maxDiffPixelRatio: 0.001,
					});
				}
				const contentHash = definition
					? hashVisualValue(
							definition.buildPublishedContent(buildSemanticAssetMap(definition)),
						)
					: hashVisualValue(
							entry.sourcePath
								? JSON.parse(fs.readFileSync(entry.sourcePath, 'utf8'))
								: {
										source: 'event-demo',
										eventType: entry.eventType,
										slug: entry.slug,
									},
						);
				const assetHash = definition
					? hashAssetFiles(
							path.resolve(
								process.cwd(),
								definition.assetDir ?? `src/assets/invitations/${definition.slug}`,
							),
							definition.assets.map((asset) => asset.relativePath),
						)
					: entry.assetSlug
						? hashAssetDirectory(
								path.resolve(
									process.cwd(),
									'src/assets/images/events',
									entry.assetSlug,
								),
							)
						: (() => {
								throw new Error(
									`Demo ${entry.slug} is missing _assetSlug for visual asset hashing.`,
								);
							})();
				const outputRoot = path.resolve(
					process.cwd(),
					process.env.VISUAL_PARITY_OUTPUT_ROOT ??
						'output/screenshots/variant-portability',
				);
				const outputPath = path.join(outputRoot, snapshotName);
				fs.mkdirSync(path.dirname(outputPath), { recursive: true });
				fs.writeFileSync(outputPath, image);
				captures.push({
					kind: entry.kind,
					slug: entry.slug,
					eventType: entry.eventType,
					preset: entry.preset,
					viewport: viewport.name,
					file: snapshotName,
					sha256: crypto.createHash('sha256').update(image).digest('hex'),
					contentHash,
					assetHash,
					comparisonResult: visualComparisonResult(VISUAL_PARITY_MODE),
				});
			});
		}
	}

	test.afterAll(() => {
		if (captures.length === 0) return;
		if (VISUAL_PARITY_MODE !== 'diagnostic') {
			expect(captures.length).toBe(EXPECTED_CAPTURE_COUNT);
		}
		const outputRoot = path.resolve(
			process.cwd(),
			process.env.VISUAL_PARITY_OUTPUT_ROOT ?? 'output/screenshots/variant-portability',
		);
		for (const capture of captures) {
			const filePath = path.join(outputRoot, capture.file);
			expect(fs.existsSync(filePath)).toBe(true);
			const buffer = fs.readFileSync(filePath);
			expect(buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)).toBe(true);
			expect(buffer.length).toBeGreaterThanOrEqual(24);
			const width = buffer.readUInt32BE(16);
			const viewport = VIEWPORTS.find((candidate) => candidate.name === capture.viewport)!;
			expect(width).toBe(viewport.width);
		}
		fs.writeFileSync(
			path.join(outputRoot, 'pages-manifest.json'),
			JSON.stringify(
				{
					generatedAt: new Date().toISOString(),
					runtimeFingerprint: VISUAL_PARITY_RUNTIME,
					status: VISUAL_PARITY_MODE === 'compare' ? 'COMPARED' : 'CANDIDATE',
					mode: VISUAL_PARITY_MODE,
					totalCaptures: captures.length,
					matrixHash: computeVisualMatrixHash(
						captures as unknown as Array<Record<string, unknown>>,
					),
					cases: PAGE_CASES.length,
					captures,
				},
				null,
				2,
			),
			'utf8',
		);
	});
});
test.describe('Reported invitation public-route regressions', () => {
	test.use({ viewport: { width: 414, height: 896 } });

	test('xareni gallery loads its canonical composition and images', async ({ page }) => {
		const response = await page.goto(
			'/xv/xareni-iyarit?skipEnvelope=true&screenshot=true&animations=off',
			{
				waitUntil: 'load',
			},
		);
		expect(response?.status()).toBe(200);
		await page.evaluate(() => document.fonts?.ready);
		const audit = await page.locator('.event-theme-wrapper').evaluate((root) => {
			const gallery = root.querySelector<HTMLElement>('.gallery-section');
			const images = Array.from(
				root.querySelectorAll<HTMLImageElement>('.gallery-section img'),
			);
			return {
				source: root.getAttribute('data-content-source'),
				variant: gallery?.getAttribute('data-variant'),
				imageCount: images.length,
				brokenImages: images.filter((image) => image.currentSrc && image.naturalWidth === 0)
					.length,
			};
		});
		expect(audit.source).toBe('published');
		expect(audit.variant).toBe('index-choreography');
		expect(audit.imageCount).toBeGreaterThanOrEqual(6);
		expect(audit.brokenImages).toBe(0);
	});

	test('ayrin thank-you keeps its published editorial portrait layout', async ({ page }) => {
		const response = await page.goto(
			'/xv/ayrin-samantha-lerma-castro?skipEnvelope=true&screenshot=true&animations=off',
			{ waitUntil: 'load' },
		);
		expect(response?.status()).toBe(200);
		await page.evaluate(() => document.fonts?.ready);
		const audit = await page.locator('.event-theme-wrapper').evaluate((root) => {
			const section = root.querySelector<HTMLElement>('.thank-you-section');
			const media = root.querySelector<HTMLElement>('.thank-you-editorial__media');
			const message = root.querySelector<HTMLElement>('.thank-you-message');
			const closing = root.querySelector<HTMLElement>('.closing-name');
			return {
				source: root.getAttribute('data-content-source'),
				variant: section?.getAttribute('data-variant'),
				mediaVisible: Boolean(media && getComputedStyle(media).display !== 'none'),
				messageWidth: message?.getBoundingClientRect().width ?? 0,
				sectionWidth: section?.getBoundingClientRect().width ?? 0,
				closingText: closing?.textContent?.trim() ?? '',
			};
		});
		expect(audit.source).toBe('published');
		expect(audit.variant).toBe('editorial-back-cover');
		expect(audit.mediaVisible).toBe(true);
		expect(audit.messageWidth).toBeGreaterThan(0);
		expect(audit.messageWidth).toBeLessThanOrEqual(audit.sectionWidth);
		expect(audit.closingText).toContain('Ayrin');
	});

	test('ana sofia keeps the canonical section order and gallery inventory', async ({ page }) => {
		const response = await page.goto(
			'/xv/ana-sofia-cota-guillen?skipEnvelope=true&screenshot=true&animations=off',
			{
				waitUntil: 'load',
			},
		);
		expect(response?.status()).toBe(200);
		await page.evaluate(() => document.fonts?.ready);
		const audit = await page.locator('.event-theme-wrapper').evaluate((root) => ({
			source: root.getAttribute('data-content-source'),
			sections: Array.from(root.querySelectorAll<HTMLElement>('.invitation-section-wrapper'))
				.map((section) => section.dataset.sectionKind)
				.filter((section): section is string =>
					Boolean(section && section !== 'interlude'),
				),
			galleryVariant: root.querySelector('.gallery-section')?.getAttribute('data-variant'),
			galleryImages: root.querySelectorAll('.gallery-section img').length,
		}));
		expect(audit.source).toBe('published');
		expect(audit.sections).toEqual([
			'quote',
			'family',
			'countdown',
			'itinerary',
			'location',
			'gallery',
			'gifts',
			'personalized-access',
			'rsvp',
			'thankYou',
		]);
		expect(audit.galleryVariant).toBe('index-choreography');
		expect(audit.galleryImages).toBe(10);
	});
});
