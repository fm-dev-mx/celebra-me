import type { Page } from 'playwright';
import { evidenceHash } from './source-evidence.js';
import { redactScreenshotUrl } from './redaction.js';

export interface CaptureResourceEvidence {
	url: string;
	kind: string;
	status: number;
	bodySha256: string | null;
}

/** Observe only render resources, never API bodies or authentication responses. */
export function observeCaptureResources(page: Page): () => Promise<CaptureResourceEvidence[]> {
	const pending: Promise<CaptureResourceEvidence>[] = [];
	page.on('response', (response) => {
		const kind = response.request().resourceType();
		if (!['stylesheet', 'font', 'image'].includes(kind)) return;
		pending.push(
			response
				.body()
				.then((body) => ({
					url: redactScreenshotUrl(response.url()),
					kind,
					status: response.status(),
					bodySha256: evidenceHash(body),
				}))
				.catch(() => ({
					url: redactScreenshotUrl(response.url()),
					kind,
					status: response.status(),
					bodySha256: null,
				})),
		);
	});
	return () => Promise.all(pending);
}

/** Explicitly allowlisted capture controls; guest identifiers and arbitrary query values stay private. */
export function captureControls(rawUrl: string): Record<string, string> {
	const params = new URL(rawUrl, 'http://localhost').searchParams;
	const allowed: Record<string, readonly string[]> = {
		full: ['1'],
		presentation: ['1'],
		envelope: ['1'],
		screenshot: ['1', 'true', 'audit'],
		animations: ['off'],
		reveal: ['open', 'closed', 'letter'],
	};
	return Object.fromEntries(
		Object.entries(allowed).flatMap(([key, values]) => {
			const value = params.get(key);
			return value && values.includes(value) ? [[key, value]] : [];
		}),
	);
}

/** Observe the post-capture state. No DOM normalization, navigation or extra resource requests. */
export async function collectPresentationEvidence(page: Page) {
	const observed = await page.evaluate(() => {
		const stylesheets = Array.from(document.styleSheets).map((sheet) => {
			let css: string | null = null;
			try {
				css = Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n');
			} catch {
				/* Cross-origin CSS. */
			}
			return {
				href: sheet.href,
				css,
				disabled: sheet.disabled,
				media: sheet.media.mediaText,
				active:
					!sheet.disabled &&
					(!sheet.media.mediaText || matchMedia(sheet.media.mediaText).matches),
			};
		});
		const requiredLayers = ['global', 'invitation'];
		const missingLayers = requiredLayers.filter((layer) => {
			const link = document.querySelector<HTMLLinkElement>(
				`link[data-capture-layer="${layer}"]`,
			);
			return (
				!link?.sheet ||
				link.sheet.disabled ||
				(link.media && !matchMedia(link.media).matches)
			);
		});
		const fonts = Array.from(document.fonts, (font) => ({
			family: font.family,
			weight: font.weight,
			style: font.style,
			status: font.status,
		}));
		const samples = ['h1', '.quote-content', '.family__name', '.rsvp', 'button'].flatMap(
			(selector) => {
				const element = document.querySelector(selector);
				if (!element) return [];
				const style = getComputedStyle(element);
				return [
					{
						selector,
						family: style.fontFamily,
						size: style.fontSize,
						weight: style.fontWeight,
					},
				];
			},
		);
		return {
			harness: document.documentElement.dataset.captureSurface ?? null,
			missingLayers,
			stylesheets,
			fonts,
			samples,
			fontSetStatus: document.fonts.status,
			content:
				document.querySelector('[data-screenshot="invitation-root"]')?.textContent ?? null,
			images: Array.from(document.images, (image) => ({
				source: image.currentSrc || image.src,
				loaded: image.complete && image.naturalWidth > 0,
				width: image.naturalWidth,
				height: image.naturalHeight,
			})),
			locale: navigator.language,
			timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			deviceScaleFactor: devicePixelRatio,
			viewportScale: window.visualViewport?.scale ?? null,
			observedClock: new Date().toISOString(),
			reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
		};
	});
	const { content, stylesheets, images, ...conditions } = observed;
	const parsedUrl = new URL(page.url(), 'http://localhost');
	const controls = captureControls(page.url());
	const fullHarness =
		observed.harness === 'full-invitation' ||
		(parsedUrl.pathname === '/test/variant' && controls.full === '1');
	return {
		...conditions,
		stage: 'post-capture' as const,
		route: redactScreenshotUrl(page.url()),
		controls,
		querySha256: evidenceHash(parsedUrl.search),
		browserVersion: page.context().browser()?.version() ?? null,
		presentation: fullHarness
			? observed.missingLayers.length
				? 'incomplete'
				: 'complete'
			: 'unverified',
		contentSha256: content === null ? null : evidenceHash(content),
		stylesheets: stylesheets.map(({ css, href, ...sheet }) => ({
			...sheet,
			href: href ? redactScreenshotUrl(href) : null,
			cssSha256: css === null ? null : evidenceHash(css),
		})),
		images: images.map(({ source, ...image }) => ({
			...image,
			sourceSha256: evidenceHash(source),
		})),
		// FontFace status and computed families do not prove per-glyph fallback selection.
		glyphFallbackVerification: 'unverified' as const,
	};
}

export type PresentationEvidence = Awaited<ReturnType<typeof collectPresentationEvidence>>;

export function presentationFailures(evidence: PresentationEvidence): string[] {
	const failures: string[] = [];
	if (evidence.presentation === 'incomplete') {
		failures.push(
			'INCOMPLETE_PRESENTATION: Full invitation harness is missing active global/base styles; use presentation=1.',
		);
	}
	if (
		evidence.fontSetStatus !== 'loaded' ||
		evidence.fonts.some((font) => font.status === 'error')
	) {
		failures.push('FONT_LOAD_INCOMPLETE: Requested fonts have not loaded successfully.');
	}
	return failures;
}
