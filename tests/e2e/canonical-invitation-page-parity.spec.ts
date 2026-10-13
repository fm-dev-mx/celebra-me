import { auditCriticalLayout } from './harness/critical-layout-audit';
import {
	initializeVisualCapture,
	prepareCompletePage,
	captureCompletePage,
} from './harness/complete-page-capture';
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { listInvitationDefinitions } from '../../scripts/provision/invitations/registry';
import {
	hashAssetDirectory,
	hashAssetFiles,
	hashVisualValue,
} from './harness/visual-parity-metadata';
import { buildSemanticAssetMap } from '../../scripts/provision/normalized-invitation-release';
import {
	assertVisualComparisonReady,
	resolveVisualParityMode,
} from './harness/visual-baseline-policy';
import { markVisualSuiteStarted, resolveVisualOutputRoot } from './harness/visual-capture-record';
import {
	recordVisualCapture,
	settleVisualCaptureWithRecapture,
} from './harness/visual-capture-settlement';
import {
	buildVisualPageCases,
	VISUAL_VIEWPORTS,
	visualPageCaseFile,
	type VisualPageCase,
} from '../../scripts/screenshot/visual-coverage-contract';

const VIEWPORTS = VISUAL_VIEWPORTS;
const VISUAL_PARITY_MODE = resolveVisualParityMode();
const ACCEPTED_BASELINES_MANIFEST = path.resolve(
	process.cwd(),
	'tests/e2e/visual-baselines/manifest.json',
);
assertVisualComparisonReady(VISUAL_PARITY_MODE, ACCEPTED_BASELINES_MANIFEST);

const PAGE_CASES: VisualPageCase[] = buildVisualPageCases();

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

	return false;
}

test.describe('Canonical invitation complete-page visual parity', () => {
	// Captures are independent; each writes its own record and the run teardown aggregates them.
	test.describe.configure({ mode: 'serial', retries: 0 });
	test.beforeAll(() => markVisualSuiteStarted(resolveVisualOutputRoot(), 'pages'));
	for (const entry of PAGE_CASES) {
		for (const viewport of VIEWPORTS) {
			test(`capture ${entry.kind}: ${entry.eventType}/${entry.slug} @ ${viewport.name}`, async ({
				page,
			}, testInfo) => {
				// Complete-page decoding and stabilization need headroom on shared CI runners.
				test.setTimeout(60_000);
				await initializeVisualCapture(page);
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
				await page.evaluate(() => document.fonts.ready);
				expect(await page.locator('body').evaluate(auditCriticalLayout)).toEqual([]);
				await prepareCompletePage(page);

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
				const snapshotName = visualPageCaseFile(entry, viewport.name);
				const captureStarted = Date.now();
				const image = await captureCompletePage(page);
				const captureMs = Date.now() - captureStarted;
				const settlement = await settleVisualCaptureWithRecapture({
					testInfo,
					mode: VISUAL_PARITY_MODE,
					file: snapshotName,
					image,
					recapture: async () => {
						await page.waitForTimeout(500);
						return captureCompletePage(page);
					},
				});
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
				recordVisualCapture(
					'pages',
					{
						kind: entry.kind,
						slug: entry.slug,
						eventType: entry.eventType,
						preset: entry.preset,
						viewport: viewport.name,
						file: snapshotName,
						sha256: settlement.storedSha256,
						contentHash,
						assetHash,
						comparisonResult: settlement.comparisonResult,
					},
					settlement,
					captureMs,
				);
			});
		}
	}
});
