import {
	hideOperationalTooling,
	assertNoOperationalTooling,
	initializeVisualCapture,
	waitForVisualHydration,
} from './harness/complete-page-capture';
import { auditCriticalLayout } from './harness/critical-layout-audit';
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
	CANONICAL_VARIANT_REGISTRY,
	type CanonicalVariantSection,
	type CanonicalVariantCssOwner,
} from '../../src/lib/invitation/section-variants';
import { buildSyntheticVariantEvent } from '../fixtures/structural-variants/synthetic-variant-fixtures';
import {
	CROSS_PRESET_REPRESENTATIVE_VARIANTS,
	VISUAL_VIEWPORTS,
	computeVisualMatrixHash,
} from '../../scripts/screenshot/visual-coverage-contract';
import { hashVisualValue, VISUAL_PARITY_RUNTIME } from './harness/visual-parity-metadata';
import {
	assertVisualComparisonReady,
	shouldCompareVisualSnapshots,
	visualComparisonResult,
} from './harness/visual-baseline-policy';

const VIEWPORTS = VISUAL_VIEWPORTS;

const EXPECTED_CAPTURE_COUNT =
	(CANONICAL_VARIANT_REGISTRY.length + CROSS_PRESET_REPRESENTATIVE_VARIANTS.length) *
	VIEWPORTS.length;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const VISUAL_PARITY_MODE = (process.env.VISUAL_PARITY_MODE ??
	(process.env.CI ? 'compare' : 'diagnostic')) as 'diagnostic' | 'candidate' | 'compare';
const ACCEPTED_BASELINES_MANIFEST = path.resolve(
	process.cwd(),
	'tests/e2e/visual-baselines/manifest.json',
);
assertVisualComparisonReady(VISUAL_PARITY_MODE, ACCEPTED_BASELINES_MANIFEST);

function isExpectedVisualDependency(rawUrl: string, documentOrigin: string): boolean {
	try {
		const url = new URL(rawUrl);
		if (url.origin === documentOrigin) return true;
		return /^(?:a|b|c)\.basemaps\.cartocdn\.com$/u.test(url.hostname);
	} catch {
		return false;
	}
}
function getSectionLocator(page: Page, section: CanonicalVariantSection) {
	if (section === 'hero') {
		return page.locator('#inicio, section.invitation-hero, [data-screenshot-section="hero"]');
	}
	const componentName = section === 'personalizedAccess' ? 'personalized-access' : section;
	return page.locator(`.invitation-section-wrapper[data-section-kind="${componentName}"]`);
}

interface CapturedSnapshotInfo {
	kind: 'variant';
	section: string;
	variant: string;
	preset: string;
	viewport: string;
	cssOwner: string;
	fixtureIdentity: string;
	file: string;
	sha256: string;
	contentHash: string;
	assetHash: string;
	comparisonResult: string;
}

const capturedSnapshots: CapturedSnapshotInfo[] = [];

test.describe('Registry-Driven Visual Portability Suite', () => {
	test.describe.configure({ retries: 0 });
	// Baseline Preset: jewelry-box (all registered canonical variants)
	for (const entry of CANONICAL_VARIANT_REGISTRY) {
		for (const vp of VIEWPORTS) {
			test(`baseline: ${entry.section}.${entry.variant} @ ${vp.name} (jewelry-box)`, async ({
				page,
			}) => {
				await runVariantVisualTest(
					page,
					entry.section,
					entry.variant,
					'jewelry-box',
					vp,
					entry.cssOwner,
				);
			});
		}
	}

	// Cross-Preset Verification: celestial-blue (10 representative variants)
	for (const rep of CROSS_PRESET_REPRESENTATIVE_VARIANTS) {
		const registryEntry = CANONICAL_VARIANT_REGISTRY.find(
			(e) => e.section === rep.section && e.variant === rep.variant,
		);

		for (const vp of VIEWPORTS) {
			test(`cross-preset: ${rep.section}.${rep.variant} @ ${vp.name} (celestial-blue)`, async ({
				page,
			}) => {
				expect(
					registryEntry,
					`Cross-preset representative is missing from the canonical registry: ${rep.section}.${rep.variant}`,
				).toBeDefined();
				if (!registryEntry) {
					throw new Error(
						`Missing canonical registry entry for ${rep.section}.${rep.variant}`,
					);
				}
				await runVariantVisualTest(
					page,
					rep.section,
					rep.variant,
					'celestial-blue',
					vp,
					registryEntry.cssOwner,
				);
			});
		}
	}

	test.afterAll(() => {
		if (capturedSnapshots.length === 0) return;

		const outputDir = path.resolve(
			process.cwd(),
			process.env.VISUAL_PARITY_OUTPUT_ROOT ?? 'output/screenshots/variant-portability',
		);
		fs.mkdirSync(outputDir, { recursive: true });

		// Full candidate/compare runs must cover the complete registry. Diagnostic
		// runs may select a focused case without weakening CI or acceptance gates.
		if (VISUAL_PARITY_MODE !== 'diagnostic') {
			expect(capturedSnapshots.length).toBe(EXPECTED_CAPTURE_COUNT);
		}
		for (const capture of capturedSnapshots) {
			const filePath = path.join(outputDir, capture.file);
			expect(fs.existsSync(filePath)).toBe(true);
			const buffer = fs.readFileSync(filePath);
			expect(buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)).toBe(true);
			expect(buffer.length).toBeGreaterThanOrEqual(24);
			const width = buffer.readUInt32BE(16);
			const height = buffer.readUInt32BE(20);
			const expectedVp = VIEWPORTS.find((v) => v.name === capture.viewport);
			expect(expectedVp).toBeDefined();
			if (!expectedVp) continue;
			expect(width).toBe(expectedVp.width);
			expect(height).toBe(expectedVp.height);
		}

		const manifest = {
			generatedAt: new Date().toISOString(),
			runtimeFingerprint: VISUAL_PARITY_RUNTIME,
			status: VISUAL_PARITY_MODE === 'compare' ? 'COMPARED' : 'CANDIDATE',
			mode: VISUAL_PARITY_MODE,
			totalCaptures: capturedSnapshots.length,
			matrixHash: computeVisualMatrixHash(
				capturedSnapshots as unknown as Array<Record<string, unknown>>,
			),
			baselinePreset: 'jewelry-box',
			crossPreset: 'celestial-blue',
			captures: capturedSnapshots,
		};

		fs.writeFileSync(
			path.join(outputDir, 'manifest.json'),
			JSON.stringify(manifest, null, 2),
			'utf8',
		);

		generateContactSheet(outputDir, manifest);
	});
});

async function runVariantVisualTest(
	page: Page,
	section: CanonicalVariantSection,
	variant: string,
	preset: string,
	vp: { name: string; width: number; height: number },
	cssOwner: CanonicalVariantCssOwner | string,
) {
	await initializeVisualCapture(page);
	const consoleErrors: string[] = [];
	const pageErrors: string[] = [];
	const externalRequests: string[] = [];
	let documentOrigin: string | undefined;
	await page.route('**/*', async (route) => {
		const request = route.request();
		const requestUrl = request.url();
		if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
			documentOrigin ??= new URL(requestUrl).origin;
		}
		if (
			/^https?:/iu.test(requestUrl) &&
			documentOrigin &&
			!isExpectedVisualDependency(requestUrl, documentOrigin)
		) {
			externalRequests.push(requestUrl);
			await route.abort();
			return;
		}
		await route.continue();
	});

	page.on('console', (msg) => {
		if (msg.type() === 'error') {
			const text = msg.text();
			if (!text.includes('ERR_NO_BUFFER_SPACE')) {
				consoleErrors.push(text);
			}
		}
	});

	page.on('pageerror', (err) => {
		pageErrors.push(err.message);
	});

	await page.setViewportSize({ width: vp.width, height: vp.height });

	const url = `/test/variant?section=${encodeURIComponent(section)}&variant=${encodeURIComponent(variant)}&preset=${encodeURIComponent(preset)}`;
	const response = await page.goto(url, { waitUntil: 'load' });

	expect(response?.status()).toBe(200);

	// 1. Verify expected theme class on body
	const body = page.locator('body');
	await expect(body).toHaveClass(new RegExp(`theme-preset--${preset}`));

	// 2. Verify target section element and variant attribute
	const target = getSectionLocator(page, section);
	await expect(target).toBeVisible();
	await target.scrollIntoViewIfNeeded();

	// Wait for document fonts and images to load
	await page.evaluate(() => document.fonts?.ready);
	await page.evaluate(async () => {
		const maxScroll = Math.max(document.documentElement.scrollHeight, window.innerHeight);
		for (let y = 0; y <= maxScroll; y += Math.max(window.innerHeight, 1)) {
			window.scrollTo(0, y);
			await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
		}
		window.scrollTo(0, 0);
	});
	await page.evaluate(async () => {
		const images = Array.from(document.querySelectorAll('img'));
		await Promise.all(
			images.map((img) =>
				img.complete
					? Promise.resolve()
					: new Promise((res) => {
							img.onload = res;
							img.onerror = res;
						}),
			),
		);
	});
	const brokenImages = await page.evaluate(() =>
		Array.from(document.images)
			.filter((image) => image.currentSrc && image.naturalWidth === 0)
			.map((image) => image.currentSrc),
	);
	expect(brokenImages).toEqual([]);
	expect(
		externalRequests,
		`External dependencies are forbidden for ${section}.${variant}.`,
	).toEqual([]);

	const hasVariant = await target.evaluate((el, v) => {
		return (
			el.getAttribute('data-variant') === v ||
			Boolean(el.querySelector(`[data-variant="${v}"]`))
		);
	}, variant);
	expect(hasVariant).toBe(true);

	// 3. Verify exact CSS ownership across all categories and absence of origin-profile CSS
	const stylesheets = await page.evaluate(() =>
		Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map(
			(link) => ({
				href: link.href,
				canonicalOwner: link.dataset.canonicalCssOwner ?? null,
			}),
		),
	);
	const hasOriginProfile = stylesheets.some(({ href }) => href.includes('invitation-profiles'));
	expect(hasOriginProfile).toBe(false);

	const canonicalOwners = stylesheets
		.map(({ canonicalOwner }) => canonicalOwner)
		.filter((owner): owner is string => Boolean(owner));
	if (cssOwner.startsWith('src/styles/themes/sections/')) {
		expect(
			canonicalOwners,
			'CSS owner verification failed for ' +
				section +
				'.' +
				variant +
				': expected exact owner "' +
				cssOwner +
				'". Observed canonical owners: ' +
				JSON.stringify(canonicalOwners),
		).toContain(cssOwner);
	} else if (cssOwner.startsWith('section-base:')) {
		const hasPresetBundle = stylesheets.some(
			({ href }) =>
				href.includes('invitation-presets/' + preset) ||
				href.includes('invitation-sections-by-preset/' + preset) ||
				href.includes(preset),
		);
		expect(
			hasPresetBundle,
			'CSS owner verification failed for ' +
				section +
				'.' +
				variant +
				': expected active preset bundle "' +
				preset +
				'" for owner "' +
				cssOwner +
				'". Observed stylesheets: ' +
				JSON.stringify(stylesheets),
		).toBe(true);
		const sectionDir =
			section === 'personalizedAccess'
				? 'personalized-access'
				: section === 'thankYou'
					? 'thank-you'
					: section;
		expect(
			canonicalOwners.some((owner) =>
				owner.startsWith('src/styles/themes/sections/' + sectionDir + '/'),
			),
			'CSS owner verification failed for ' +
				section +
				'.' +
				variant +
				': a section-base variant must not load modular section CSS. Observed canonical owners: ' +
				JSON.stringify(canonicalOwners),
		).toBe(false);
	}
	// 4. Bounded clipping and overlap layout audit
	const layoutAudit = await target.evaluate((sectionEl) => {
		const docWidth = window.innerWidth;
		const issues: string[] = [];

		const isExempt = (el: Element): boolean => {
			if (
				el.getAttribute('aria-hidden') === 'true' ||
				el.getAttribute('data-decorative') === 'true' ||
				el.getAttribute('role') === 'presentation'
			) {
				return true;
			}
			const token = `${el.className} ${el.id}`.toLowerCase();
			if (
				/ambient|backdrop|background|bg|overlay|grain|mesh|pattern|flourish|glow|texture|divider|watermark|scroll-indicator|photo-frame|hero__background|animated-line/.test(
					token,
				)
			) {
				return true;
			}
			return Boolean(
				el.closest(
					'[aria-hidden="true"], [data-decorative="true"], [role="presentation"], .invitation-hero__background, .invitation-hero__scroll-indicator, .photo-frame',
				),
			);
		};

		const candidateSelectors = [
			'h1, h2, h3, h4, h5, h6',
			'p',
			'a[href], button, input, select, textarea, label',
			'.countdown__value, .countdown__label',
			'.invitation-hero__title, .invitation-hero__label, .invitation-hero__date, .invitation-hero__time, .invitation-hero__venue',
			'.thank-you-message, .closing-name',
			'.access-card, .rsvp__radio-card',
			'.event-location__card-content-list',
			'.gallery__item img, .thank-you-editorial__media img',
		].join(', ');

		const isVisibleElement = (el: HTMLElement): boolean => {
			if (isExempt(el)) return false;
			const style = window.getComputedStyle(el);
			if (
				style.display === 'none' ||
				style.visibility === 'hidden' ||
				parseFloat(style.opacity || '1') === 0
			) {
				return false;
			}
			const rect = el.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) return false;
			const isMedia = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|IMG|PICTURE|SVG)$/i.test(el.tagName);
			return isMedia || Boolean(el.textContent?.trim());
		};

		const checkAncestorClipping = (el: HTMLElement, rect: DOMRect) => {
			let parent = el.parentElement;
			while (parent && parent !== document.body) {
				const style = window.getComputedStyle(parent);
				const clips = /^(hidden|clip|scroll|auto)$/i;
				if (clips.test(style.overflowX) || clips.test(style.overflowY)) {
					const pRect = parent.getBoundingClientRect();
					const clippedX =
						clips.test(style.overflowX) &&
						(rect.left < pRect.left - 4 || rect.right > pRect.right + 4);
					const clippedY =
						clips.test(style.overflowY) &&
						(rect.top < pRect.top - 4 || rect.bottom > pRect.bottom + 4);
					if (clippedX || clippedY) {
						issues.push(
							`Clipped by ancestor <${parent.tagName.toLowerCase()} class="${parent.className}">: <${el.tagName.toLowerCase()} class="${el.className}">`,
						);
						break;
					}
				}
				parent = parent.parentElement;
			}
		};

		const checkOverlap = (elements: HTMLElement[]) => {
			for (let i = 0; i < elements.length; i++) {
				for (let j = i + 1; j < elements.length; j++) {
					const el1 = elements[i];
					const el2 = elements[j];
					if (el1.contains(el2) || el2.contains(el1)) continue;

					const r1 = el1.getBoundingClientRect();
					const r2 = el2.getBoundingClientRect();
					const overlapX = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left);
					const overlapY = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);

					if (overlapX > 8 && overlapY > 8) {
						const z1 = parseInt(window.getComputedStyle(el1).zIndex || '0', 10);
						const z2 = parseInt(window.getComputedStyle(el2).zIndex || '0', 10);
						const bothMeaningfulText = Boolean(
							el1.textContent?.trim() && el2.textContent?.trim(),
						);
						if (!bothMeaningfulText && z1 !== z2 && (z1 <= 0 || z2 <= 0)) continue;
						issues.push(
							`Unintended overlap (${Math.round(overlapX)}x${Math.round(overlapY)}px) between <${el1.tagName.toLowerCase()} class="${el1.className}"> and <${el2.tagName.toLowerCase()} class="${el2.className}">`,
						);
					}
				}
			}
		};

		const criticalElements = Array.from(
			sectionEl.querySelectorAll<HTMLElement>(candidateSelectors),
		).filter(isVisibleElement);

		for (const el of criticalElements) {
			const rect = el.getBoundingClientRect();
			if (rect.left < -2 || rect.right > docWidth + 2) {
				issues.push(
					`Horizontal overflow: <${el.tagName.toLowerCase()} class="${el.className}"> [${Math.round(rect.left)}, ${Math.round(rect.right)}] exceeds viewport width ${docWidth}`,
				);
			}
			checkAncestorClipping(el, rect);
		}

		checkOverlap(criticalElements);

		return {
			issues,
			checkedCount: criticalElements.length,
		};
	});

	expect(
		layoutAudit.issues,
		`Layout clipping/overlap audit failed for ${section}.${variant} @ ${vp.name} (${preset}):\n${layoutAudit.issues.join('\n')}`,
	).toEqual([]);

	expect(await target.evaluate(auditCriticalLayout)).toEqual([]);

	// 5. Verify no horizontal document overflow
	const hasOverflow = await page.evaluate(() => {
		return document.documentElement.scrollWidth > window.innerWidth;
	});
	expect(hasOverflow).toBe(false);

	// 6. Verify no console or unhandled errors
	expect(consoleErrors).toEqual([]);
	expect(pageErrors).toEqual([]);

	await hideOperationalTooling(page);
	await assertNoOperationalTooling(page);

	// 7. Deterministic normalizations
	// Normalize dynamic countdown digits and clear intervals so visual structure, styling,
	// and typography are tested deterministically without live clock-ticking drift.
	if (section === 'countdown') {
		await page.evaluate(() => {
			let id = window.setInterval(() => {}, 0);
			while (id > 0) {
				window.clearInterval(id);
				id--;
			}
			const values = document.querySelectorAll<HTMLElement>('.countdown__value');
			const defaults = ['173', '12', '34', '56'];
			values.forEach((v, i) => {
				v.textContent = defaults[i] ?? '00';
			});
		});
	}

	await waitForVisualHydration(page);

	// 8. Capture diagnostic viewport image for contact sheet / manifest
	const snapshotName = `${preset}-${vp.name}-${section}-${variant}.png`;
	const viewportSnapshotBuffer = await page.screenshot({ animations: 'disabled' });
	if (shouldCompareVisualSnapshots(VISUAL_PARITY_MODE)) {
		expect(viewportSnapshotBuffer).toMatchSnapshot(snapshotName, {
			maxDiffPixelRatio: 0.001,
		});
	}
	const hash = crypto.createHash('sha256').update(viewportSnapshotBuffer).digest('hex');
	const syntheticEvent = buildSyntheticVariantEvent({
		section,
		variant,
		themePreset: preset,
	});
	const contentHash = hashVisualValue(syntheticEvent.data);
	const assetHash = hashVisualValue({ source: 'synthetic-variant-fixture', preset });

	const outputSnapshotPath = path.resolve(
		process.cwd(),
		process.env.VISUAL_PARITY_OUTPUT_ROOT ?? 'output/screenshots/variant-portability',
		snapshotName,
	);
	fs.mkdirSync(path.dirname(outputSnapshotPath), { recursive: true });
	fs.writeFileSync(outputSnapshotPath, viewportSnapshotBuffer);

	capturedSnapshots.push({
		kind: 'variant',
		section,
		variant,
		preset,
		viewport: vp.name,
		cssOwner,
		fixtureIdentity: `synthetic:${section}.${variant}`,
		file: snapshotName,
		sha256: hash,
		contentHash,
		assetHash,
		comparisonResult: visualComparisonResult(VISUAL_PARITY_MODE),
	});
}

function generateContactSheet(
	outputDir: string,
	manifest: {
		generatedAt: string;
		status: string;
		totalCaptures: number;
		captures: CapturedSnapshotInfo[];
	},
) {
	const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Canonical Variant Visual Portability — Candidate Baselines</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --muted: #94a3b8;
      --border: #334155;
      --accent: #38bdf8;
      --success: #4ade80;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 2rem;
      line-height: 1.5;
    }
    header {
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1rem;
    }
    h1 { font-size: 1.75rem; color: var(--text); margin-bottom: 0.5rem; }
    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 600;
      background: #0284c7;
      color: #fff;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
      gap: 1.5rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .card-header {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .card-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--accent);
    }
    .card-meta {
      font-size: 0.75rem;
      color: var(--muted);
      padding: 0.5rem 1rem;
    }
    .card-meta code {
      background: rgba(0,0,0,0.3);
      padding: 2px 4px;
      border-radius: 4px;
      font-size: 0.7rem;
    }
    .img-container {
      padding: 1rem;
      background: #0b0f19;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      flex-grow: 1;
      max-height: 450px;
      overflow: auto;
    }
    img {
      max-width: 100%;
      height: auto;
      border-radius: 4px;
      border: 1px solid var(--border);
    }
    .digest {
      font-family: monospace;
      font-size: 0.65rem;
      color: var(--muted);
      padding: 0.5rem 1rem;
      border-top: 1px solid var(--border);
      word-break: break-all;
    }
  </style>
</head>
<body>
  <header>
    <h1>Canonical Variant Visual Portability — Candidate Baselines</h1>
    <p style="color: var(--muted); margin-bottom: 0.75rem;">
      Status: <span class="status-badge">${manifest.status}</span> &bull;
      Total Visual Test Points: <strong>${manifest.totalCaptures}</strong> &bull;
      Generated: <strong>${manifest.generatedAt}</strong>
    </p>
  </header>
  <div class="grid">
    ${manifest.captures
		.map(
			(c) => `
      <div class="card">
        <div class="card-header">
          <span class="card-title">${c.section}.${c.variant}</span>
          <span style="font-size: 0.75rem; color: var(--success); font-weight: 600;">${c.preset} / ${c.viewport}</span>
        </div>
        <div class="card-meta">
          <div>CSS Owner: <code>${c.cssOwner}</code></div>
          <div>Fixture: <code>${c.fixtureIdentity}</code></div>
        </div>
        <div class="img-container">
          <a href="${c.file}" target="_blank">
            <img src="${c.file}" alt="${c.section}.${c.variant} (${c.preset} ${c.viewport})" loading="lazy" />
          </a>
        </div>
        <div class="digest">SHA-256: ${c.sha256}</div>
      </div>
    `,
		)
		.join('')}
  </div>
</body>
</html>`;

	fs.writeFileSync(path.join(outputDir, 'contact-sheet.html'), html, 'utf8');
}

test('portrait-letter preserves the production mobile portrait and serif letter geometry', async ({
	page,
}) => {
	await page.setViewportSize({ width: 414, height: 896 });
	await page.goto(
		'/test/variant?section=thankYou&variant=portrait-letter&preset=enchanted-rose',
		{ waitUntil: 'load' },
	);
	await page.evaluate(() => document.fonts.ready);
	const section = page.locator('.thank-you-section');
	await section.scrollIntoViewIfNeeded();
	const geometry = await section.evaluate((root) => {
		const media = root.querySelector<HTMLElement>('.thank-you-editorial__media')!;
		const message = root.querySelector<HTMLElement>('.thank-you-message')!;
		return {
			portraitWidth: media.getBoundingClientRect().width,
			fontSize: Number.parseFloat(getComputedStyle(message).fontSize),
			fontFamily: getComputedStyle(message).fontFamily,
			paddingTop: Number.parseFloat(getComputedStyle(root).paddingTop),
		};
	});
	// Measured on the accepted Production deployment at the same viewport.
	expect(geometry.portraitWidth).toBeCloseTo(256.68, 1);
	expect(geometry.fontSize).toBeCloseTo(25.668, 2);
	expect(geometry.fontFamily).toContain('Cormorant Garamond');
	expect(geometry.paddingTop).toBeCloseTo(152, 1);
});

for (const preset of ['celestial-blue', 'jewelry-box']) {
	test(`portrait-keepsake preserves a narrow portrait and serif letter in ${preset}`, async ({
		page,
	}) => {
		await page.setViewportSize({ width: 414, height: 896 });
		await page.goto(
			`/test/variant?section=thankYou&variant=portrait-keepsake&preset=${preset}`,
			{ waitUntil: 'load' },
		);
		await page.evaluate(() => document.fonts.ready);
		const section = page.locator('.thank-you-section');
		const geometry = await section.evaluate((root) => {
			const media = root.querySelector<HTMLElement>('.thank-you-editorial__media')!;
			const message = root.querySelector<HTMLElement>('.thank-you-message')!;
			return {
				width: media.getBoundingClientRect().width,
				height: media.getBoundingClientRect().height,
				fontSize: parseFloat(getComputedStyle(message).fontSize),
				font: getComputedStyle(message).fontFamily,
				displayFont: getComputedStyle(root).getPropertyValue('--font-display').trim(),
			};
		});
		expect(geometry.width).toBeCloseTo(256, 1);
		expect(geometry.height).toBeCloseTo(256, 1);
		// A 4:5 portrait must retain its intrinsic ratio, as delivered in Production.
		await section.locator('.photo-image').evaluate(async (element) => {
			const image = element as HTMLImageElement;
			image.removeAttribute('srcset');
			image.src =
				'data:image/svg+xml,' +
				encodeURIComponent(
					'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="tan"/></svg>',
				);
			await image.decode();
		});
		const intrinsicHeight = await section
			.locator('.thank-you-editorial__media')
			.evaluate((element) => element.getBoundingClientRect().height);
		expect(intrinsicHeight).toBeCloseTo(320, 1);

		expect(geometry.fontSize).toBeCloseTo(25.668, 2);
		expect(geometry.font.replace(/["']/g, '')).toBe(geometry.displayFont.replace(/["']/g, ''));
	});
}

test('public celestial demo resolves portrait-keepsake from its content', async ({ page }) => {
	await page.setViewportSize({ width: 414, height: 896 });
	await page.goto('/xv/demo-xv-celestial-blue', { waitUntil: 'load' });
	const section = page.locator('.thank-you-section');
	await expect(section).toHaveAttribute('data-variant', 'portrait-keepsake');
	const geometry = await section.evaluate((root) => ({
		width: root.querySelector('.thank-you-editorial__media')!.getBoundingClientRect().width,
		fontSize: parseFloat(getComputedStyle(root.querySelector('.thank-you-message')!).fontSize),
	}));
	expect(geometry.width).toBeCloseTo(256, 1);
	expect(geometry.fontSize).toBeCloseTo(25.668, 2);
});

test('section captures exclude a consent banner mounted after capture setup', async ({ page }) => {
	const { hideFixedOverlaysForCapture } =
		await import('../../scripts/screenshot/element-capture');
	await page.setContent(
		'<main><p>Contenido de la invitación</p></main><aside data-music-player>Audio</aside>',
	);
	const restore = await hideFixedOverlaysForCapture(page);
	await page.evaluate(() => {
		const root = document.createElement('div');
		root.id = 'consent-banner-root';
		root.textContent = 'Aviso de cookies';
		document.body.append(root);
	});
	await expect(page.locator('#consent-banner-root')).toBeHidden();
	await expect(page.locator('[data-music-player]')).toBeHidden();
	await expect(page.locator('main')).toBeVisible();
	await restore();
	await expect(page.locator('#consent-banner-root')).toBeVisible();
});

test('venue maps preserve Production tiles and independent navigation without credentials', async ({
	page,
}) => {
	await page.route('https://*.basemaps.cartocdn.com/**', (route) =>
		route.fulfill({
			contentType: 'image/png',
			body: Buffer.from(
				'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
				'base64',
			),
		}),
	);
	await page.goto('/test/variant?section=location&variant=standard&preset=jewelry-box', {
		waitUntil: 'networkidle',
	});
	const location = page.locator('#event-location');
	await location.scrollIntoViewIfNeeded();
	await expect(location.locator('[data-map-provider="carto-voyager"]').first()).toBeVisible();
	await expect(location.locator('a[href="https://maps.app.goo.gl/example1"]')).toBeVisible();
	await expect(location.locator('iframe[src*="maps"]')).toHaveCount(0);
	const tiles = await location
		.locator('.rustic-map-tile')
		.evaluateAll((nodes) => nodes.map((node) => (node as HTMLImageElement).src));
	expect(tiles).toHaveLength(18);
	expect(
		await location
			.locator('.rustic-map-tiles')
			.first()
			.evaluate((node) => getComputedStyle(node).filter),
	).toBe('grayscale(0.12) contrast(1.02) brightness(0.82)');
	for (const source of tiles) {
		const url = new URL(source);
		expect(url.hostname).toMatch(/^[abc]\.basemaps\.cartocdn\.com$/);
		expect(url.pathname).toMatch(/^\/rastertiles\/voyager\/\d+\/\d+\/\d+\.png$/);
		expect(url.search).toBe('');
	}
});

test('diagnostic randomness repeats across fresh documents without becoming constant', async ({
	page,
}) => {
	const { stabilizeCaptureRandomness } = await import('../../scripts/screenshot/element-capture');
	await stabilizeCaptureRandomness(page);
	const values: number[][] = [];
	for (let pass = 0; pass < 2; pass++) {
		await page.goto('about:blank');
		values.push(await page.evaluate(() => Array.from({ length: 4 }, () => Math.random())));
	}
	expect(values[0]).toEqual(values[1]);
	expect(new Set(values[0]).size).toBe(4);
});

test('ornamented access preserves explicit inherited presentation tokens', async ({ page }) => {
	await page.goto(
		'/test/variant?section=personalizedAccess&variant=ornamented&preset=jewelry-box',
	);
	const access = page.locator('.personalized-access');
	await expect(access).toBeVisible();
	await access.evaluate((element) => {
		const parent = element.parentElement!;
		parent.style.setProperty('--pa-corner-opacity', '0.25');
		parent.style.setProperty('--pa-card-glow', 'none');
	});
	await expect(access.locator('.access-card__corner').first()).toHaveCSS('opacity', '0.25');
	const glow = await access
		.locator('.access-card')
		.evaluate((element) => getComputedStyle(element, '::after').backgroundImage);
	expect(glow).toBe('none');
});

test('section pixel alignment preserves geometry and visible differences', async ({ page }) => {
	const { alignSectionCaptureToPixelGrid } =
		await import('../../scripts/screenshot/element-capture');
	await page.setContent(
		'<div id="section" style="position:absolute;left:20.25px;top:10.75px;width:100px;height:60px;background:red"></div>',
	);
	const target = page.locator('#section');
	const original = await target.boundingBox();
	const alignment = await alignSectionCaptureToPixelGrid(target);
	expect(alignment.bounds).toEqual(original);
	expect(await target.boundingBox()).toEqual({ x: 20, y: 11, width: 100, height: 60 });
	const red = await target.screenshot();
	await target.evaluate((element) => {
		(element as HTMLElement).style.background = 'blue';
	});
	const blue = await target.screenshot();
	expect(red.equals(blue)).toBe(false);
	await alignment.restore();
	expect(await target.boundingBox()).toEqual(original);
	await target.evaluate((element) => {
		(element as HTMLElement).style.translate = '3px 4px';
	});
	await expect(alignSectionCaptureToPixelGrid(target)).rejects.toThrow('authored CSS translate');
	await expect(target).toHaveCSS('translate', '3px 4px');
});

test('location profile preserves the production map marker palette', async ({ page }) => {
	const { compile } = await import('sass');
	const styles = [
		'src/styles/invitation/_venue-map.scss',
		'src/styles/invitation-profiles/alba-rosa-quinonez.scss',
	]
		.map((file) => compile(file, { loadPaths: ['node_modules'] }).css)
		.join('\n');
	await page.setContent(`<style>${styles}</style>
		<div class="event--alba-rosa-quinonez theme-preset--luxury-hacienda">
			<div class="event-location"><div class="google-map-container">
				<div class="rustic-map-pin"></div><div class="rustic-map-pulse"></div>
			</div></div>
		</div>`);
	await expect(page.locator('.rustic-map-pin')).toHaveCSS('color', 'rgb(118, 124, 116)');
	await expect(page.locator('.rustic-map-pulse')).toHaveCSS(
		'background-color',
		'rgba(118, 124, 116, 0.4)',
	);
	await expect(page.locator('.rustic-map-pulse')).toHaveCSS(
		'box-shadow',
		'rgb(118, 124, 116) 0px 0px 12px 0px',
	);
});
