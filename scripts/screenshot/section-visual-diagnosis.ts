import { captureInvitationDocumentSpaceFullPage } from './invitation-full-page';
import { verifySectionCropInclusion } from './artifact-validation';
import {
	stabilizeCaptureRandomness,
	alignSectionCaptureToPixelGrid,
	hideFixedOverlaysForCapture,
} from './element-capture';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import sharp from 'sharp';
import { buildVisualPageCases, VISUAL_VIEWPORTS } from './visual-coverage-contract';
import { assertManifestIntegrity, listPngFiles } from './visual-manifest-integrity';
import {
	assertDiagnosisCoverage,
	classifySectionDifference,
	compareSectionImages,
	normalizeCaptureImageSource,
	captureImageTransformations,
	captureImageInputSource,
	sectionImageSignature,
	type CapturedImageIdentity,
	sectionSemanticSignature,
	normalizeCapturedFonts,
} from './section-visual-diff';
import { writeSectionDiagnosisReport } from './section-visual-report';

const digest = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
interface SectionCapture {
	file: string;
	sha256: string;
	index: number;
	width: number;
	height: number;
	domBounds?: { x: number; y: number; width: number; height: number };
	pixelGridOffset?: { x: number; y: number };
	fonts: string[];
	images: CapturedImageIdentity[];
	textHash: string;
}
interface PageCapture {
	sections: Record<string, SectionCapture>;
	contentVersion: string | null;
	url: string;
}
export interface SectionDiagnosisRow {
	route: string;
	viewport: string;
	section: string;
	status: 'MATCH' | 'DIFFERENT' | 'UNSTABLE' | 'MISSING' | 'ERROR';
	ratio: number | null;
	repeatRatio?: number;
	productionNoise?: number;
	previewNoise?: number;
	reasons: string[];
	production?: SectionCapture;
	preview?: SectionCapture;
	diff?: string;
	overlay?: string;
}

export function parseDiagnosisArgs(args: string[]): Record<string, string> {
	const options: Record<string, string> = {};
	const allowed = [
		'production-url',
		'preview-url',
		'production-sha',
		'preview-sha',
		'route',
		'routes',
		'viewports',
		'full-pages',
		'output',
		'at',
	];
	for (let i = 0; i < args.length; i++) {
		const match = /^--([a-z-]+)(?:=(.*))?$/u.exec(args[i]);
		if (!match || !allowed.includes(match[1]) || options[match[1]])
			throw new Error('Unknown or duplicate diagnosis option.');
		const value = match[2] ?? args[++i];
		if (!value || value.startsWith('--')) throw new Error(`Missing value for ${match[1]}.`);
		options[match[1]] = value;
	}
	validateDiagnosisOrigins(options);
	if (options['production-url'] === options['preview-url'])
		throw new Error('Production and Preview must be distinct origins.');
	if (options.at && !Number.isFinite(Date.parse(options.at)))
		throw new Error('Invalid fixed capture time.');
	if (options.route && options.routes) throw new Error('Use route or routes, not both.');
	if (options['full-pages'] && !['true', 'false'].includes(options['full-pages']))
		throw new Error('full-pages must be true or false.');
	return options;
}

function validateDiagnosisOrigins(options: Record<string, string>): void {
	for (const env of ['production', 'preview']) {
		if (!options[`${env}-url`]) throw new Error(`Provide the verified ${env} deployment URL.`);
		const url = new URL(options[`${env}-url`]);
		if (
			url.username ||
			url.password ||
			url.search ||
			url.hash ||
			url.pathname !== '/' ||
			(url.protocol !== 'https:' &&
				!(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
		)
			throw new Error(
				'Use a credential-free HTTPS origin (HTTP is allowed only for loopback).',
			);
		if (!/^[a-f0-9]{40}$/iu.test(options[`${env}-sha`] ?? ''))
			throw new Error(`Provide the verified ${env} deployment SHA.`);
		options[`${env}-url`] = url.origin;
	}
}

export function hashDeliveredImage(bytes: Buffer, contentType: string) {
	return {
		deliveredSha256: digest(bytes),
		// XML normalizes CRLF and CR to LF before parsing. Retain the delivered-byte proof.
		...(contentType.split(';')[0].trim() === 'image/svg+xml'
			? { normalizedSvgSha256: digest(bytes.toString('utf8').replace(/\r\n?/g, '\n')) }
			: {}),
	};
}

export async function waitForCaptureHydration(page: Page, timeout = 15000): Promise<void> {
	await page.waitForFunction(
		() =>
			Array.from(document.querySelectorAll('astro-island[client="visible"][ssr]')).every(
				(island) =>
					!island.getBoundingClientRect().width || !island.getBoundingClientRect().height,
			),
		null,
		{ timeout },
	);
}

export function measureSectionPresentation(node: HTMLElement) {
	return {
		fonts: [
			...new Set(
				[node, ...Array.from(node.querySelectorAll('*'))]
					.filter(
						(element) =>
							element instanceof HTMLElement &&
							Array.from(element.childNodes).some(
								(child) =>
									child.nodeType === Node.TEXT_NODE &&
									Boolean(child.textContent?.trim()),
							),
					)
					.filter((element) =>
						element.checkVisibility({
							checkOpacity: true,
							checkVisibilityCSS: true,
						}),
					)
					.map((element) => {
						const style = getComputedStyle(element);
						return `${style.fontFamily} | ${style.fontSize} | ${style.lineHeight} | ${style.fontWeight} | ${style.fontStyle} | ${style.letterSpacing}`;
					}),
			),
		],
		images: Array.from(node.querySelectorAll('img'))
			.filter((image) =>
				image.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }),
			)
			.map((image) => ({
				src: image.currentSrc || image.getAttribute('src') || '',
				naturalWidth: image.naturalWidth,
				naturalHeight: image.naturalHeight,
				objectFit: getComputedStyle(image).objectFit,
				objectPosition: getComputedStyle(image).objectPosition,
			})),
		text: node.innerText,
	};
}

async function capturePage(
	browser: Browser,
	origin: string,
	route: string,
	viewport: { name: string; width: number; height: number },
	prefix: string,
	root: string,
	fixedTime: string,
	token: string | undefined,
	fullPages: boolean,
	inputHashes: Map<string, Promise<string | undefined>>,
): Promise<PageCapture> {
	const context = await browser.newContext({
		viewport,
		deviceScaleFactor: 1,
		locale: 'en-US',
		timezoneId: 'UTC',
		reducedMotion: 'reduce',
	});
	try {
		if (token)
			await context.route(`${origin}/**`, (route) =>
				route.continue({
					headers: {
						...route.request().headers(),
						'x-vercel-protection-bypass': token,
					},
				}),
			);
		const page = await context.newPage();
		const deliveredImages = new Map<
			string,
			Promise<ReturnType<typeof hashDeliveredImage> | undefined>
		>();
		page.on('response', (response) => {
			if (response.ok() && response.request().resourceType() === 'image')
				deliveredImages.set(
					response.url(),
					response
						.body()
						.then((bytes) =>
							hashDeliveredImage(bytes, response.headers()['content-type'] ?? ''),
						)
						.catch(() => undefined),
				);
		});
		const measureImage = async (image: CapturedImageIdentity) => {
			const input = captureImageInputSource(image.src);
			if (input && !inputHashes.has(input)) {
				inputHashes.set(
					input,
					page.request
						.get(input, {
							timeout: 15000,
							...(token && new URL(input).origin === origin
								? { headers: { 'x-vercel-protection-bypass': token } }
								: {}),
						})
						.then(async (response) => {
							if (
								!response.ok() ||
								!response.headers()['content-type']?.startsWith('image/')
							)
								return undefined;
							const bytes = await response.body();
							const identity = hashDeliveredImage(
								bytes,
								response.headers()['content-type'],
							);
							return identity.normalizedSvgSha256 ?? identity.deliveredSha256;
						})
						.catch(() => undefined),
				);
			}
			return {
				...image,
				src: normalizeCaptureImageSource(image.src, origin),
				...(await deliveredImages.get(image.src)),
				...(input ? { inputSha256: await inputHashes.get(input) } : {}),
				transformations: captureImageTransformations(image.src),
			};
		};
		await stabilizeCaptureRandomness(page);
		await page.clock.setFixedTime(new Date(fixedTime));
		const response = await page.goto(`${origin}${route}?skipEnvelope=true&animations=off`, {
			waitUntil: 'load',
			timeout: 60000,
		});
		if (response?.status() !== 200 || new URL(page.url()).pathname !== route)
			throw new Error(`Public route failed: ${origin}${route}, HTTP ${response?.status()}.`);
		await page.locator('.event-theme-wrapper').waitFor();
		await page.evaluate(async () => {
			await document.fonts.ready;
			for (const image of document.images) image.loading = 'eager';
			await Promise.all(
				Array.from(document.images).map((image) => image.decode().catch(() => {})),
			);
			for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
				window.scrollTo(0, y);
				await new Promise((resolve) => setTimeout(resolve, 35));
			}
			window.scrollTo(0, 0);
		});
		await waitForCaptureHydration(page);
		await page.waitForTimeout(300);
		await page.addStyleTag({
			content:
				'html { scroll-behavior: auto !important; } *, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }',
		});
		await hideFixedOverlaysForCapture(page);
		const measured = await page.evaluate(() => {
			const nodes = Array.from(
				document.querySelectorAll<HTMLElement>(
					'[data-screenshot-section="hero"], .invitation-section-wrapper[data-screenshot-section]',
				),
			);
			const seen = new Set<string>();
			return nodes.map((node, index) => {
				const key = node.dataset.screenshotSection!;
				if (!/^[a-zA-Z0-9-]+$/u.test(key)) throw new Error('Invalid section identity.');
				if (seen.has(key)) throw new Error(`Duplicate section identity: ${key}`);
				seen.add(key);
				const box = node.getBoundingClientRect();
				const failed = Array.from(node.querySelectorAll('img')).filter(
					(image) =>
						!image.naturalWidth && (image.currentSrc || image.getAttribute('src')),
				);
				if (failed.length) throw new Error(`Section ${key} has undecoded images.`);
				return {
					key,
					index,
					left: Math.max(0, Math.floor(box.left + scrollX)),
					top: Math.max(0, Math.floor(box.top + scrollY)),
					width: Math.ceil(box.width),
					height: Math.ceil(box.height),
				};
			});
		});
		if (measured.length < 2 || !measured.some((section) => section.key === 'hero'))
			throw new Error('Missing public section inventory.');
		const sections: Record<string, SectionCapture> = {};
		for (const section of measured) {
			// Capture each section directly: very tall full-page bitmaps can contain blank
			// compositor regions even when the DOM and image decoding are complete.
			const selector =
				section.key === 'hero'
					? '[data-screenshot-section="hero"]'
					: `.invitation-section-wrapper[data-screenshot-section="${section.key}"]`;
			const target = page.locator(selector);
			await target.scrollIntoViewIfNeeded();
			await page.evaluate(async () => {
				await document.fonts.ready;
				await new Promise(requestAnimationFrame);
			});
			const alignment = await alignSectionCaptureToPixelGrid(target);
			const presentation = await target.evaluate(measureSectionPresentation);
			const bounds = await target.boundingBox();
			if (!bounds) throw new Error(`Missing section bounds: ${section.key}`);
			section.width = Math.ceil(bounds.width);
			section.height = Math.ceil(bounds.height);
			const bytes = await target
				.screenshot({ animations: 'disabled' })
				.finally(alignment.restore);
			const metadata = await sharp(bytes).metadata();
			if (
				!metadata.width ||
				!metadata.height ||
				Math.abs(metadata.height - section.height) > 1
			)
				throw new Error(`Incomplete section capture: ${section.key}`);
			const file = `${prefix}-${section.key.replace(/[^a-zA-Z0-9-]/gu, '_')}.png`;
			fs.writeFileSync(path.join(root, file), bytes);
			sections[section.key] = {
				file,
				sha256: digest(bytes),
				index: section.index,
				width: metadata.width,
				height: metadata.height,
				domBounds: alignment.bounds,
				pixelGridOffset: alignment.offset,
				fonts: presentation.fonts,
				images: await Promise.all(presentation.images.map(measureImage)),
				textHash: digest(presentation.text),
			};
		}
		if (fullPages) {
			const height = await page.evaluate(() => document.documentElement.scrollHeight);
			const file = `${prefix}-full-page.png`;
			const outputPath = path.join(root, file);
			const capture = await captureInvitationDocumentSpaceFullPage(
				page,
				outputPath,
				'png',
				0,
				height,
				viewport.width,
				{ deviceScaleFactor: 1 },
			);
			for (const section of measured) {
				const validation = await verifySectionCropInclusion({
					fullPagePath: outputPath,
					sectionId: section.key,
					sectionBounds: { y: section.top, height: section.height },
					topY: 0,
					deviceScaleFactor: 1,
					...(section.key === 'hero'
						? { standalonePath: path.join(root, sections.hero.file) }
						: {}),
				});
				if (!validation.valid)
					throw new Error(validation.error ?? 'Incomplete full-page capture.');
			}
			const presentation = await page.locator('body').evaluate(measureSectionPresentation);
			sections['full-page'] = {
				file,
				sha256: digest(fs.readFileSync(outputPath)),
				index: measured.length,
				width: capture.width,
				height: capture.height,
				domBounds: { x: 0, y: 0, width: viewport.width, height },
				fonts: presentation.fonts,
				images: await Promise.all(presentation.images.map(measureImage)),
				textHash: digest(presentation.text),
			};
		}
		return {
			sections,
			contentVersion: await page
				.locator('.event-theme-wrapper')
				.getAttribute('data-content-version'),
			url: page.url(),
		};
	} finally {
		await context.close();
	}
}

function readCapture(root: string, capture: SectionCapture): Buffer {
	const bytes = fs.readFileSync(path.join(root, capture.file));
	if (digest(bytes) !== capture.sha256)
		throw new Error(`Capture integrity mismatch: ${capture.file}`);
	return bytes;
}

async function compareInitialSection(
	root: string,
	prefix: string,
	route: string,
	viewport: string,
	section: string,
	a?: SectionCapture,
	b?: SectionCapture,
): Promise<SectionDiagnosisRow> {
	const row: SectionDiagnosisRow = {
		route,
		viewport,
		section,
		status: 'MISSING',
		ratio: null,
		reasons: [],
		production: a,
		preview: b,
	};
	if (!a || !b) row.reasons.push(!a ? 'Absent in Production' : 'Absent in Preview');
	else {
		const compared = await compareSectionImages(readCapture(root, a), readCapture(root, b));
		row.ratio = compared.ratio;
		if (compared.sizeChanged)
			row.reasons.push(
				`Capture dimensions differ: Production ${a.width}x${a.height}, Preview ${b.width}x${b.height}; DOM heights ${a.domBounds?.height ?? 'unknown'} / ${b.domBounds?.height ?? 'unknown'}.`,
			);
		if (a.index !== b.index) row.reasons.push('Section order differs');
		if (
			JSON.stringify(normalizeCapturedFonts(a.fonts)) !==
			JSON.stringify(normalizeCapturedFonts(b.fonts))
		)
			row.reasons.push('Typography differs');
		if (a.textHash !== b.textHash) row.reasons.push('Visible text differs');
		if (sectionImageSignature(a.images) !== sectionImageSignature(b.images))
			row.reasons.push('Image source or crop differs');
		row.status =
			compared.ratio <= 0.001 &&
			!compared.sizeChanged &&
			a.index === b.index &&
			sectionSemanticSignature(a) === sectionSemanticSignature(b)
				? 'MATCH'
				: 'UNSTABLE';
		if (row.status !== 'MATCH') {
			row.diff = `${prefix}-${section}-diff.png`;
			row.overlay = `${prefix}-${section}-overlay.png`;
			fs.writeFileSync(path.join(root, row.diff), compared.diff);
			fs.writeFileSync(path.join(root, row.overlay), compared.overlay);
		}
	}
	return row;
}

async function confirmSection(
	root: string,
	row: SectionDiagnosisRow,
	aa?: SectionCapture,
	bb?: SectionCapture,
): Promise<void> {
	const a = row.production,
		b = row.preview;
	if (!a || !b || !aa || !bb) {
		row.status = !a === !aa && !b === !bb ? 'MISSING' : 'UNSTABLE';
		return;
	}
	const compare = (x: SectionCapture, y: SectionCapture) =>
		compareSectionImages(readCapture(root, x), readCapture(root, y));
	const repeat = await compare(aa, bb),
		productionNoise = await compare(a, aa),
		previewNoise = await compare(b, bb);
	row.repeatRatio = repeat.ratio;
	row.productionNoise = productionNoise.ratio;
	row.previewNoise = previewNoise.ratio;
	row.status = classifySectionDifference({
		first: row.ratio!,
		repeat: repeat.ratio,
		productionNoise: productionNoise.ratio,
		previewNoise: previewNoise.ratio,
		sizeChanged: a.width !== b.width || a.height !== b.height,
		orderChanged: a.index !== b.index,
		semanticChanged: sectionSemanticSignature(a) !== sectionSemanticSignature(b),
		semanticUnstable:
			sectionSemanticSignature(a) !== sectionSemanticSignature(aa) ||
			sectionSemanticSignature(b) !== sectionSemanticSignature(bb),
	});
}

export async function diagnoseSections(args: string[]): Promise<void> {
	const options = parseDiagnosisArgs(args);
	const fullPages = options['full-pages'] === 'true';
	const inventory = buildVisualPageCases();
	const requested = (options.routes ?? options.route)?.split(',');
	const routes = inventory.filter(
		(entry) => !requested || requested.includes(`/${entry.eventType}/${entry.slug}`),
	);
	if (
		requested &&
		(new Set(requested).size !== requested.length || requested.length !== routes.length)
	)
		throw new Error('Unknown or duplicate requested routes.');
	const availableViewports = [...VISUAL_VIEWPORTS, { name: 'reported', width: 414, height: 896 }];
	const requestedViewports = options.viewports?.split(',');
	const viewports = requestedViewports
		? availableViewports.filter((viewport) => requestedViewports.includes(viewport.name))
		: VISUAL_VIEWPORTS;
	if (
		requestedViewports &&
		(new Set(requestedViewports).size !== requestedViewports.length ||
			requestedViewports.length !== viewports.length)
	)
		throw new Error('Unknown or duplicate viewports.');
	if (!routes.length) throw new Error('Requested route is outside the canonical inventory.');
	const parent = path.resolve('.tmp/visual-parity/diagnostics');
	const root = path.resolve(
		options.output ?? path.join(parent, new Date().toISOString().replace(/[:.]/gu, '-')),
	);
	if (!root.startsWith(parent + path.sep) || fs.existsSync(root))
		throw new Error('Use a new output directory under .tmp/visual-parity/diagnostics.');
	fs.mkdirSync(root, { recursive: true });
	const fixedTime =
		options.at ?? new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString();
	const browser = await chromium.launch();
	const rows: SectionDiagnosisRow[] = [];
	const pages: {
		route: string;
		viewport: string;
		production?: PageCapture;
		preview?: PageCapture;
		error?: string;
	}[] = [];
	const token = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
	const provenance = {
		production: { url: options['production-url'], sha: options['production-sha'] },
		preview: { url: options['preview-url'], sha: options['preview-sha'] },
		identitySource: 'Operator-verified deployment identities; use immutable deployment URLs.',
		localHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
		workingTreeDiffSha256: digest(
			execFileSync('git', ['diff', 'HEAD', '--', 'src', 'scripts', 'astro.config.mjs']),
		),
		presentationMeasurementVersion: 3,
		fullPages,
		browser: browser.version(),
		platform: process.platform,
		fixedTime,
		locale: 'en-US',
		timezone: 'UTC',
		scale: 1,
		threshold: 0.001,
		pixelChannelTolerance: 24,
		maskedElements: 'Operational fixed overlays only, via hideFixedOverlaysForCapture',
		pixelGridAlignment:
			'Isolated section origin only; original DOM bounds and offsets retained',
		scope: requested || requestedViewports ? 'PARTIAL' : 'FULL',
		selectedViewports: viewports,
		expectedRouteViewports: routes.length * viewports.length,
	};
	const cases = routes.flatMap((entry) => viewports.map((viewport) => ({ entry, viewport })));
	const inputHashes = new Map<string, Promise<string | undefined>>();
	let next = 0;
	try {
		await Promise.all(
			Array.from({ length: 2 }, async () => {
				while (next < cases.length) {
					const { entry, viewport } = cases[next++];
					const route = `/${entry.eventType}/${entry.slug}`;
					const prefix = `${entry.eventType}-${entry.slug}-${viewport.name}`;
					try {
						const capturePair = (attempt: number) =>
							Promise.all(
								['production', 'preview'].map((env) =>
									capturePage(
										browser,
										options[`${env}-url`],
										route,
										viewport,
										`${prefix}-${env}-${attempt}`,
										root,
										fixedTime,
										env === 'preview' ? token : undefined,
										fullPages,
										inputHashes,
									),
								),
							);
						const [production, preview] = await capturePair(1);
						const keys = [
							...new Set([
								...Object.keys(production.sections),
								...Object.keys(preview.sections),
							]),
						];
						const pending: SectionDiagnosisRow[] = [];
						for (const section of keys)
							pending.push(
								await compareInitialSection(
									root,
									prefix,
									route,
									viewport.name,
									section,
									production.sections[section],
									preview.sections[section],
								),
							);
						if (pending.some((row) => row.status !== 'MATCH')) {
							const [secondProduction, secondPreview] = await capturePair(2);
							if (
								production.contentVersion !== secondProduction.contentVersion ||
								preview.contentVersion !== secondPreview.contentVersion
							)
								throw new Error(
									'Content version changed during capture; evidence invalidated.',
								);
							for (const row of pending.filter((row) => row.status !== 'MATCH'))
								await confirmSection(
									root,
									row,
									secondProduction.sections[row.section],
									secondPreview.sections[row.section],
								);
						}
						pages.push({ route, viewport: viewport.name, production, preview });
						rows.push(...pending);
						console.log(
							`${route} @ ${viewport.name}: ${pending.filter((row) => row.status !== 'MATCH').length}/${pending.length} sections require review`,
						);
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						pages.push({ route, viewport: viewport.name, error: message });
						rows.push({
							route,
							viewport: viewport.name,
							section: '*',
							status: 'ERROR',
							ratio: null,
							reasons: [message],
						});
						console.error(`${route} @ ${viewport.name}: capture failed: ${message}`);
					}
					fs.writeFileSync(
						path.join(root, 'progress.json'),
						JSON.stringify({ provenance, pages, rows }, null, 2),
					);
				}
			}),
		);
	} finally {
		await browser.close();
	}
	assertDiagnosisCoverage(
		routes.flatMap((entry) =>
			viewports.map((viewport) => `/${entry.eventType}/${entry.slug}@${viewport.name}`),
		),
		pages.map((page) => `${page.route}@${page.viewport}`),
	);
	const captures = listPngFiles(root).map((file) => ({
		file: path.relative(root, file).replaceAll('\\', '/'),
		sha256: digest(fs.readFileSync(file)),
	}));
	assertManifestIntegrity({ captures }, root);
	const report = { status: 'DIAGNOSTIC_NOT_ACCEPTED', provenance, pages, rows, captures };
	fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2));
	writeSectionDiagnosisReport(root, rows, provenance);
	console.log(
		`Section diagnosis: ${path.relative(process.cwd(), root)} (${rows.filter((row) => row.status !== 'MATCH').length} findings).`,
	);
	if (rows.some((row) => row.status !== 'MATCH')) process.exitCode = 1;
}
