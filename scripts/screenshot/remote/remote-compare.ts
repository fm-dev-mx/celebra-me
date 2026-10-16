import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { isVisiblePixelChange } from '../visual-yiq.ts';
import {
	routeFileStem,
	type RemoteBox,
	type RemoteCaptureManifest,
	type RemoteImageRegion,
	type RemoteRouteRecord,
	type RemoteViewportCapture,
	type RemoteViewportName,
} from './remote-manifest.ts';

/** Owner pass rule: at most 0.5 % changed pixels outside photo regions. */
const PIXEL_CHANGE_LIMIT = 0.005;
/** A photo whose box shifts or resizes by more than this many CSS pixels has moved. */
const IMAGE_MOVE_TOLERANCE_PX = 2;
const MAX_REPORT_CASES = 6;
const CASE_WINDOW_PX = 900;

type RemoteFailureKind =
	| 'route-missing'
	| 'status-changed'
	| 'redirect-changed'
	| 'asset-invalid'
	| 'capture-failed'
	| 'image-missing'
	| 'image-broken'
	| 'image-moved'
	| 'pixels-changed';

export interface RemoteFailure {
	kind: RemoteFailureKind;
	path: string;
	group: string;
	viewport?: RemoteViewportName;
	detail: string;
	ratio?: number;
	/** Full-page region (CSS px) worth showing in a cropped case. */
	focus?: RemoteBox;
}

export interface RemotePixelComparison {
	path: string;
	viewport: RemoteViewportName;
	ratio: number;
	changedPixels: number;
	comparedPixels: number;
	maskedPixels: number;
	sizeChanged: boolean;
	focus?: RemoteBox;
}

export interface RemoteCompareResult {
	passed: boolean;
	before: { label: string; origin: string; capturedAt: string };
	after: { label: string; origin: string; capturedAt: string };
	routeCount: number;
	failures: RemoteFailure[];
	warnings: string[];
	comparisons: RemotePixelComparison[];
	cases: Array<{ file: string; failure: RemoteFailure }>;
}

const PERMANENT_REDIRECTS = new Set([301, 308]);
const TEMPORARY_REDIRECTS = new Set([302, 307]);

export function sameStatusClass(before: number, after: number): boolean {
	if (before === after) return true;
	if (PERMANENT_REDIRECTS.has(before) && PERMANENT_REDIRECTS.has(after)) return true;
	return TEMPORARY_REDIRECTS.has(before) && TEMPORARY_REDIRECTS.has(after);
}

/** Checks that hold for the "after" set on its own, whatever the "before" set showed. */
export function checkRouteExpectations(route: RemoteRouteRecord): RemoteFailure[] {
	const base = { path: route.path, group: route.group };
	if (route.kind === 'redirect') {
		const failures: RemoteFailure[] = [];
		if (!PERMANENT_REDIRECTS.has(route.status)) {
			failures.push({
				...base,
				kind: 'redirect-changed',
				detail: `respondió ${route.status}; se espera una redirección permanente (301/308)`,
			});
		}
		if (route.expectedLocation && route.location !== route.expectedLocation) {
			failures.push({
				...base,
				kind: 'redirect-changed',
				detail: `redirige a ${route.location ?? '(ninguna)'}; se espera ${route.expectedLocation}`,
			});
		}
		return failures;
	}
	if (route.kind === 'asset') {
		if (route.status !== 200 || route.contentType !== route.expectedContentType) {
			return [
				{
					...base,
					kind: 'asset-invalid',
					detail: `respondió ${route.status} ${route.contentType ?? '(sin tipo)'}; se espera 200 ${route.expectedContentType}`,
				},
			];
		}
	}
	return [];
}

function photoRegions(regions: RemoteImageRegion[]): RemoteImageRegion[] {
	return regions.filter((region) => region.kind !== 'embed');
}

function boxMoved(before: RemoteBox, after: RemoteBox): boolean {
	return (
		Math.abs(before.x - after.x) > IMAGE_MOVE_TOLERANCE_PX ||
		Math.abs(before.y - after.y) > IMAGE_MOVE_TOLERANCE_PX ||
		Math.abs(before.width - after.width) > IMAGE_MOVE_TOLERANCE_PX ||
		Math.abs(before.height - after.height) > IMAGE_MOVE_TOLERANCE_PX
	);
}

/** Photos are matched in document order; one failure per kind per capture keeps reports short. */
export function compareImageRegions(
	route: Pick<RemoteRouteRecord, 'path' | 'group'>,
	viewport: RemoteViewportName,
	before: RemoteImageRegion[],
	after: RemoteImageRegion[],
): RemoteFailure[] {
	const left = photoRegions(before);
	const right = photoRegions(after);
	const found = new Map<RemoteFailureKind, { count: number; first: RemoteFailure }>();
	const note = (kind: RemoteFailureKind, detail: string, focus: RemoteBox) => {
		const entry = found.get(kind);
		if (entry) entry.count += 1;
		else found.set(kind, { count: 1, first: { ...route, kind, viewport, detail, focus } });
	};
	left.forEach((region, index) => {
		const match = right[index];
		if (!match) {
			note('image-missing', `falta la imagen ${index + 1} (${region.identity})`, region.box);
			return;
		}
		if (match.identity !== region.identity) {
			note(
				'image-missing',
				`la imagen ${index + 1} era ${region.identity} y ahora es ${match.identity}`,
				region.box,
			);
			return;
		}
		if (boxMoved(region.box, match.box)) {
			note(
				'image-moved',
				`la imagen ${index + 1} (${region.identity}) se movió de ${region.box.x},${region.box.y} ${region.box.width}×${region.box.height} a ${match.box.x},${match.box.y} ${match.box.width}×${match.box.height}`,
				match.box,
			);
		}
	});
	right.forEach((region, index) => {
		if (region.kind === 'img' && region.loaded === false) {
			const wasBroken =
				left[index]?.identity === region.identity && left[index]?.loaded === false;
			note(
				'image-broken',
				`la imagen ${index + 1} (${region.identity}) no carga${wasBroken ? ' (ya fallaba antes)' : ''}`,
				region.box,
			);
		}
	});
	return [...found.values()].map(({ count, first }) => ({
		...first,
		detail: count > 1 ? `${first.detail} y ${count - 1} más` : first.detail,
	}));
}

function paintMask(mask: Uint8Array, width: number, height: number, box: RemoteBox): void {
	const x0 = Math.max(0, Math.floor(box.x));
	const y0 = Math.max(0, Math.floor(box.y));
	const x1 = Math.min(width, Math.ceil(box.x + box.width));
	const y1 = Math.min(height, Math.ceil(box.y + box.height));
	for (let y = y0; y < y1; y++) mask.fill(1, y * width + x0, y * width + x1);
}

/** Row window of `windowHeight` holding the most changed pixels. */
export function densestBand(rowCounts: Uint32Array, windowHeight: number): number {
	let best = 0;
	let bestStart = 0;
	let current = 0;
	for (let y = 0; y < rowCounts.length; y++) {
		current += rowCounts[y];
		if (y >= windowHeight) current -= rowCounts[y - windowHeight];
		if (current > best) {
			best = current;
			bestStart = Math.max(0, y - windowHeight + 1);
		}
	}
	// Center the window on the changed rows it holds.
	const end = Math.min(rowCounts.length, bestStart + windowHeight);
	let first = -1;
	let last = -1;
	for (let y = bestStart; y < end; y++) {
		if (rowCounts[y] === 0) continue;
		if (first < 0) first = y;
		last = y;
	}
	if (first < 0) return bestStart;
	const centered = Math.round((first + last) / 2 - windowHeight / 2);
	return Math.max(0, Math.min(centered, rowCounts.length - windowHeight));
}

interface RawImage {
	data: Buffer;
	width: number;
	height: number;
}

async function readRaw(file: string): Promise<RawImage> {
	const { data, info } = await sharp(file)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	return { data, width: info.width, height: info.height };
}

/**
 * Pads instead of resizing: a height change shows up as changed rows. Pixels inside any photo
 * or embedded-media box of either capture are left out of both numerator and denominator.
 */
export function comparePixels(
	before: RawImage,
	after: RawImage,
	regions: RemoteImageRegion[],
): Omit<RemotePixelComparison, 'path' | 'viewport'> {
	const width = Math.max(before.width, after.width);
	const height = Math.max(before.height, after.height);
	const mask = new Uint8Array(width * height);
	for (const region of regions) paintMask(mask, width, height, region.box);
	const rowCounts = new Uint32Array(height);
	let changedPixels = 0;
	let maskedPixels = 0;
	const white = Buffer.from([255, 255, 255, 255]);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (mask[y * width + x]) {
				maskedPixels++;
				continue;
			}
			const inBefore = x < before.width && y < before.height;
			const inAfter = x < after.width && y < after.height;
			const changed =
				inBefore !== inAfter ||
				isVisiblePixelChange(
					inBefore ? before.data : white,
					inBefore ? (y * before.width + x) * 4 : 0,
					inAfter ? after.data : white,
					inAfter ? (y * after.width + x) * 4 : 0,
				);
			if (changed) {
				changedPixels++;
				rowCounts[y]++;
			}
		}
	}
	const comparedPixels = width * height - maskedPixels;
	const windowHeight = Math.min(CASE_WINDOW_PX, height);
	return {
		ratio: comparedPixels > 0 ? changedPixels / comparedPixels : 0,
		changedPixels,
		comparedPixels,
		maskedPixels,
		sizeChanged: before.width !== after.width || before.height !== after.height,
		focus:
			changedPixels > 0
				? { x: 0, y: densestBand(rowCounts, windowHeight), width, height: windowHeight }
				: undefined,
	};
}

function captureError(capture: RemoteViewportCapture | undefined): string | undefined {
	if (!capture) return 'sin captura';
	if (capture.error) return capture.error;
	return undefined;
}

/** Spreads cases across failure kinds and route groups: never more than MAX_REPORT_CASES. */
export function selectCases(failures: RemoteFailure[], limit = MAX_REPORT_CASES): RemoteFailure[] {
	const visual = failures.filter((failure) => failure.focus && failure.viewport);
	const severity: RemoteFailureKind[] = [
		'image-missing',
		'image-broken',
		'image-moved',
		'pixels-changed',
	];
	const ranked = [...visual].sort(
		(a, b) =>
			severity.indexOf(a.kind) - severity.indexOf(b.kind) || (b.ratio ?? 0) - (a.ratio ?? 0),
	);
	const picked: RemoteFailure[] = [];
	const usedCaptures = new Set<string>();
	const usedGroups = new Set<string>();
	for (const pass of [0, 1]) {
		for (const failure of ranked) {
			if (picked.length >= limit) return picked;
			const key = `${failure.path}|${failure.viewport}`;
			if (usedCaptures.has(key)) continue;
			if (pass === 0 && usedGroups.has(`${failure.kind}|${failure.group}`)) continue;
			usedCaptures.add(key);
			usedGroups.add(`${failure.kind}|${failure.group}`);
			picked.push(failure);
		}
	}
	return picked;
}

async function cropPanel(file: string, focus: RemoteBox, label: string): Promise<Buffer> {
	const meta = await sharp(file).metadata();
	const width = meta.width ?? 1;
	const height = meta.height ?? 1;
	const center = focus.y + focus.height / 2;
	const top = Math.max(
		0,
		Math.min(Math.round(center - CASE_WINDOW_PX / 2), Math.max(0, height - 1)),
	);
	const cropHeight = Math.max(1, Math.min(CASE_WINDOW_PX, height - top));
	const panel = await sharp(file)
		.extract({ left: 0, top, width, height: cropHeight })
		.extend({ bottom: CASE_WINDOW_PX - cropHeight, background: '#ffffff' })
		.resize({ width: Math.min(width, 720) })
		.png()
		.toBuffer();
	const panelMeta = await sharp(panel).metadata();
	const banner = Buffer.from(
		`<svg width="${panelMeta.width}" height="32"><rect width="100%" height="100%" fill="#1f2937"/><text x="10" y="22" font-family="sans-serif" font-size="16" fill="#ffffff">${label}</text></svg>`,
	);
	return sharp({
		create: {
			width: panelMeta.width ?? 1,
			height: (panelMeta.height ?? 1) + 32,
			channels: 4,
			background: '#ffffff',
		},
	})
		.composite([
			{ input: banner, top: 0, left: 0 },
			{ input: panel, top: 32, left: 0 },
		])
		.png()
		.toBuffer();
}

async function writeCase(
	beforeDir: string,
	afterDir: string,
	casesDir: string,
	index: number,
	failure: RemoteFailure,
): Promise<string | undefined> {
	if (!failure.focus || !failure.viewport) return undefined;
	const name = `${routeFileStem(failure.path)}.${failure.viewport}.png`;
	const beforeFile = join(beforeDir, name);
	const afterFile = join(afterDir, name);
	if (!existsSync(beforeFile) || !existsSync(afterFile)) return undefined;
	const [left, right] = await Promise.all([
		cropPanel(beforeFile, failure.focus, `antes · ${failure.path} · ${failure.viewport}`),
		cropPanel(afterFile, failure.focus, `después · ${failure.kind}`),
	]);
	const [lm, rm] = await Promise.all([sharp(left).metadata(), sharp(right).metadata()]);
	const gap = 16;
	const out = `${String(index + 1).padStart(2, '0')}-${name}`;
	await sharp({
		create: {
			width: (lm.width ?? 0) + gap + (rm.width ?? 0),
			height: Math.max(lm.height ?? 0, rm.height ?? 0),
			channels: 4,
			background: '#e5e7eb',
		},
	})
		.composite([
			{ input: left, top: 0, left: 0 },
			{ input: right, top: 0, left: (lm.width ?? 0) + gap },
		])
		.png()
		.toFile(join(casesDir, out));
	return out;
}

function readManifest(dir: string): RemoteCaptureManifest {
	return JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as RemoteCaptureManifest;
}

/** Status, redirect target and standalone expectations of one route. */
function compareRouteResponses(route: RemoteRouteRecord, next: RemoteRouteRecord): RemoteFailure[] {
	const base = { path: route.path, group: route.group };
	const failures: RemoteFailure[] = [];
	if (!sameStatusClass(route.status, next.status)) {
		failures.push({
			...base,
			kind: 'status-changed',
			detail: `respondía ${route.status} y ahora ${next.status}`,
		});
	}
	if (route.kind === 'redirect' && route.location !== next.location) {
		failures.push({
			...base,
			kind: 'redirect-changed',
			detail: `redirigía a ${route.location ?? '(ninguna)'} y ahora a ${next.location ?? '(ninguna)'}`,
		});
	}
	return [...failures, ...checkRouteExpectations(next)];
}

async function compareViewportCaptures(
	dirs: { beforeDir: string; afterDir: string },
	route: RemoteRouteRecord,
	next: RemoteRouteRecord,
	viewport: RemoteViewportName,
): Promise<{
	failures: RemoteFailure[];
	warning?: string;
	comparison?: RemotePixelComparison;
}> {
	const base = { path: route.path, group: route.group, viewport };
	const left = route.captures[viewport];
	const right = next.captures[viewport];
	if (!left && !right) return { failures: [] };
	const beforeError = captureError(left);
	if (beforeError) {
		return {
			failures: [],
			warning: `${route.path} ${viewport}: "antes" sin captura (${beforeError}).`,
		};
	}
	const afterError = captureError(right);
	if (afterError || !left || !right) {
		return {
			failures: [{ ...base, kind: 'capture-failed', detail: afterError ?? 'sin captura' }],
		};
	}
	const failures = compareImageRegions(route, viewport, left.images, right.images);
	const pixels = comparePixels(
		await readRaw(join(dirs.beforeDir, left.file)),
		await readRaw(join(dirs.afterDir, right.file)),
		[...left.images, ...right.images],
	);
	if (pixels.ratio > PIXEL_CHANGE_LIMIT) {
		const height = pixels.sizeChanged ? ` (alto ${left.height} → ${right.height} px)` : '';
		failures.push({
			...base,
			kind: 'pixels-changed',
			ratio: pixels.ratio,
			detail: `${(pixels.ratio * 100).toFixed(2)} % de píxeles cambiados fuera de fotos${height}`,
			focus: pixels.focus,
		});
	}
	return { failures, comparison: { path: route.path, viewport, ...pixels } };
}

export async function compareRemoteCaptures(options: {
	beforeDir: string;
	afterDir: string;
	outputDir: string;
	log?: (line: string) => void;
}): Promise<RemoteCompareResult> {
	const log = options.log ?? (() => undefined);
	const before = readManifest(options.beforeDir);
	const after = readManifest(options.afterDir);
	const failures: RemoteFailure[] = [];
	const warnings: string[] = [];
	const comparisons: RemotePixelComparison[] = [];
	if (before.clock !== after.clock) {
		warnings.push(
			`Los relojes congelados difieren (${before.clock} / ${after.clock}); las cuentas regresivas pueden cambiar.`,
		);
	}
	const afterByPath = new Map(after.routes.map((route) => [route.path, route]));
	const beforePaths = new Set(before.routes.map((route) => route.path));
	for (const route of after.routes) {
		if (!beforePaths.has(route.path)) {
			warnings.push(`Ruta nueva en "después": ${route.path} (${route.status}).`);
		}
	}
	if (!before.routes.some((route) => route.kind === 'asset')) {
		warnings.push(
			'Ninguna foto de /vista-previa en "antes": la marca de agua no quedó cubierta.',
		);
	}

	for (const route of before.routes) {
		const next = afterByPath.get(route.path);
		if (!next) {
			failures.push({
				path: route.path,
				group: route.group,
				kind: 'route-missing',
				detail: 'no se capturó en "después"',
			});
			continue;
		}
		failures.push(...compareRouteResponses(route, next));
		if (route.kind !== 'page') continue;
		for (const viewport of before.viewports) {
			const outcome = await compareViewportCaptures(options, route, next, viewport.name);
			failures.push(...outcome.failures);
			if (outcome.warning) warnings.push(outcome.warning);
			if (outcome.comparison) {
				comparisons.push(outcome.comparison);
				log(
					`${(outcome.comparison.ratio * 100).toFixed(3).padStart(8)} % ${viewport.name.padEnd(7)} ${route.path}`,
				);
			}
		}
	}

	mkdirSync(options.outputDir, { recursive: true });
	const casesDir = join(options.outputDir, 'cases');
	mkdirSync(casesDir, { recursive: true });
	const cases: RemoteCompareResult['cases'] = [];
	for (const failure of selectCases(failures)) {
		const file = await writeCase(
			options.beforeDir,
			options.afterDir,
			casesDir,
			cases.length,
			failure,
		);
		if (file) cases.push({ file: `cases/${file}`, failure });
	}
	const result: RemoteCompareResult = {
		passed: failures.length === 0,
		before: { label: before.label, origin: before.origin, capturedAt: before.capturedAt },
		after: { label: after.label, origin: after.origin, capturedAt: after.capturedAt },
		routeCount: before.routes.length,
		failures,
		warnings,
		comparisons,
		cases,
	};
	writeFileSync(join(options.outputDir, 'report.json'), `${JSON.stringify(result, null, 2)}\n`);
	writeFileSync(join(options.outputDir, 'report.md'), renderRemoteReport(result));
	return result;
}

const KIND_LABELS: Record<RemoteFailureKind, string> = {
	'route-missing': 'Ruta sin capturar',
	'status-changed': 'Código HTTP distinto',
	'redirect-changed': 'Redirección distinta',
	'asset-invalid': 'Foto de vista previa inválida',
	'capture-failed': 'Captura fallida',
	'image-missing': 'Imagen faltante o reemplazada',
	'image-broken': 'Imagen rota',
	'image-moved': 'Imagen movida',
	'pixels-changed': 'Más de 0.5 % de píxeles cambiados',
};

export function renderRemoteReport(result: RemoteCompareResult): string {
	const lines: string[] = [];
	const maxRatio = result.comparisons.reduce((max, item) => Math.max(max, item.ratio), 0);
	lines.push(`# Comparación visual remota: ${result.passed ? 'APROBADA' : 'FALLIDA'}`);
	lines.push('');
	lines.push(
		`- Antes: \`${result.before.label}\` — ${result.before.origin} (${result.before.capturedAt})`,
	);
	lines.push(
		`- Después: \`${result.after.label}\` — ${result.after.origin} (${result.after.capturedAt})`,
	);
	lines.push(
		`- Rutas: ${result.routeCount}; capturas comparadas: ${result.comparisons.length}; mayor cambio fuera de fotos: ${(maxRatio * 100).toFixed(3)} %`,
	);
	lines.push(
		'- Regla: ≤ 0.5 % de píxeles cambiados fuera de fotos; ninguna imagen faltante, rota o movida.',
	);
	lines.push('');
	if (result.failures.length > 0) {
		lines.push('## Fallas por tipo');
		lines.push('');
		const byKind = new Map<RemoteFailureKind, RemoteFailure[]>();
		for (const failure of result.failures) {
			byKind.set(failure.kind, [...(byKind.get(failure.kind) ?? []), failure]);
		}
		for (const [kind, items] of byKind) {
			lines.push(`### ${KIND_LABELS[kind]} (${items.length})`);
			lines.push('');
			for (const item of items.slice(0, 12)) {
				lines.push(
					`- \`${item.path}\`${item.viewport ? ` ${item.viewport}` : ''}: ${item.detail}`,
				);
			}
			if (items.length > 12) lines.push(`- … y ${items.length - 12} más (ver report.json)`);
			lines.push('');
		}
	}
	if (result.cases.length > 0) {
		lines.push(`## Casos de ejemplo (${result.cases.length})`);
		lines.push('');
		for (const item of result.cases) {
			lines.push(
				`- [${item.failure.path} ${item.failure.viewport}](${item.file}) — ${item.failure.detail}`,
			);
		}
		lines.push('');
	}
	if (result.warnings.length > 0) {
		lines.push('## Avisos');
		lines.push('');
		for (const warning of result.warnings) lines.push(`- ${warning}`);
		lines.push('');
	}
	return `${lines.join('\n')}\n`;
}
