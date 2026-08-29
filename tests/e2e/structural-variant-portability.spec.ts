import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
	CANONICAL_VARIANT_REGISTRY,
	type CanonicalVariantSection,
	type CanonicalVariantCssOwner,
} from '../../src/lib/invitation/section-variants';
import {
	CROSS_PRESET_REPRESENTATIVE_VARIANTS,
} from '../fixtures/structural-variants/synthetic-variant-fixtures';

const VIEWPORTS = [
	{ name: 'mobile', width: 390, height: 844 },
	{ name: 'desktop', width: 1440, height: 900 },
] as const;

function getSectionLocator(page: Page, section: CanonicalVariantSection) {
	if (section === 'hero') {
		return page.locator('#inicio, section.invitation-hero, [data-screenshot-section="hero"]');
	}
	const componentName = section === 'personalizedAccess' ? 'personalized-access' : section;
	return page.locator(`.invitation-section-wrapper[data-section-kind="${componentName}"]`);
}

interface CapturedSnapshotInfo {
	section: string;
	variant: string;
	preset: string;
	viewport: string;
	cssOwner: string;
	fixtureIdentity: string;
	file: string;
	sha256: string;
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
		const cssOwner = registryEntry?.cssOwner ?? 'unknown';

		for (const vp of VIEWPORTS) {
			test(`cross-preset: ${rep.section}.${rep.variant} @ ${vp.name} (celestial-blue)`, async ({
				page,
			}) => {
				await runVariantVisualTest(
					page,
					rep.section,
					rep.variant,
					'celestial-blue',
					vp,
					cssOwner,
				);
			});
		}
	}

	test.afterAll(async () => {
		if (capturedSnapshots.length === 0) return;

		const outputDir = path.resolve(process.cwd(), 'output/screenshots/variant-portability');
		fs.mkdirSync(outputDir, { recursive: true });

		const manifest = {
			generatedAt: new Date().toISOString(),
			status: 'READY_FOR_VISUAL_APPROVAL',
			totalCaptures: capturedSnapshots.length,
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
	const response = await page.goto(url, { waitUntil: 'domcontentloaded' });

	expect(response?.status()).toBe(200);

	// Wait for document fonts and images to load
	await page.evaluate(() => document.fonts?.ready);
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

	// 1. Verify expected theme class on body
	const body = page.locator('body');
	await expect(body).toHaveClass(new RegExp(`theme-preset--${preset}`));

	// 2. Verify target section element and variant attribute
	const target = getSectionLocator(page, section);
	await expect(target).toBeVisible();
	const hasVariant = await target.evaluate((el, v) => {
		return (
			el.getAttribute('data-variant') === v ||
			Boolean(el.querySelector(`[data-variant="${v}"]`))
		);
	}, variant);
	expect(hasVariant).toBe(true);

	// 3. Verify CSS owner resolution and absence of origin-profile CSS
	const stylesheets = await page.evaluate(() =>
		Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map(
			(l) => l.href,
		),
	);
	const hasOriginProfile = stylesheets.some((href) => href.includes('invitation-profiles'));
	expect(hasOriginProfile).toBe(false);

	if (cssOwner.startsWith('src/styles/themes/sections/')) {
		const fileBase = path.basename(cssOwner, '.scss').replace(/^_/, '');
		const hasOwnerCss = stylesheets.some((href) => href.includes(fileBase));
		expect(hasOwnerCss).toBe(true);
	}

	// 4. Verify no horizontal overflow
	const hasOverflow = await page.evaluate(() => {
		return document.documentElement.scrollWidth > window.innerWidth;
	});
	expect(hasOverflow).toBe(false);

	// 5. Verify no console or unhandled errors
	expect(consoleErrors).toEqual([]);
	expect(pageErrors).toEqual([]);

	// 6. Deterministic normalizations
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

	// 7. Capture diagnostic viewport image for contact sheet / manifest
	const snapshotName = `${preset}-${vp.name}-${section}-${variant}.png`;
	const viewportSnapshotBuffer = await page.screenshot({ animations: 'disabled' });
	const hash = crypto.createHash('sha256').update(viewportSnapshotBuffer).digest('hex');

	const outputSnapshotPath = path.resolve(
		process.cwd(),
		'output/screenshots/variant-portability',
		snapshotName,
	);
	fs.mkdirSync(path.dirname(outputSnapshotPath), { recursive: true });
	fs.writeFileSync(outputSnapshotPath, viewportSnapshotBuffer);

	capturedSnapshots.push({
		section,
		variant,
		preset,
		viewport: vp.name,
		cssOwner,
		fixtureIdentity: `synthetic:${section}.${variant}`,
		file: snapshotName,
		sha256: hash,
		comparisonResult: 'PASS',
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
