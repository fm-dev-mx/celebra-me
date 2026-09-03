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

const VIEWPORTS = VISUAL_VIEWPORTS;

const EXPECTED_CAPTURE_COUNT =
	(CANONICAL_VARIANT_REGISTRY.length + CROSS_PRESET_REPRESENTATIVE_VARIANTS.length) *
	VIEWPORTS.length;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const VISUAL_PARITY_MODE =
	process.env.VISUAL_PARITY_MODE ?? (process.env.CI ? 'compare' : 'diagnostic');
const ACCEPTED_BASELINES_MANIFEST = path.resolve(
	process.cwd(),
	'tests/e2e/visual-baselines/manifest.json',
);
const hasAcceptedBaselines = fs.existsSync(ACCEPTED_BASELINES_MANIFEST);

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
	// Baseline Preset: jewelry-box (all 39 canonical variants)
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
			status:
				VISUAL_PARITY_MODE === 'compare' && hasAcceptedBaselines ? 'COMPARED' : 'CANDIDATE',
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
			new URL(requestUrl).origin !== documentOrigin
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
						if (z1 !== z2 && (z1 <= 0 || z2 <= 0)) continue;
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

	// 5. Verify no horizontal document overflow
	const hasOverflow = await page.evaluate(() => {
		return document.documentElement.scrollWidth > window.innerWidth;
	});
	expect(hasOverflow).toBe(false);

	// 6. Verify no console or unhandled errors
	expect(consoleErrors).toEqual([]);
	expect(pageErrors).toEqual([]);

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

	// Wait for GPU compositing and CSS transition stability before capturing.
	await page.waitForTimeout(200);

	// 8. Capture diagnostic viewport image for contact sheet / manifest
	const snapshotName = `${preset}-${vp.name}-${section}-${variant}.png`;
	const viewportSnapshotBuffer = await page.screenshot({ animations: 'disabled' });
	if (
		VISUAL_PARITY_MODE === 'candidate' ||
		(VISUAL_PARITY_MODE === 'compare' && hasAcceptedBaselines)
	) {
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
		comparisonResult:
			VISUAL_PARITY_MODE === 'compare' && hasAcceptedBaselines ? 'PASS' : 'CANDIDATE',
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
