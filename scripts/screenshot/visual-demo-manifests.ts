import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * The accepted visual manifest is split per demo so a demo change only edits that demo's file.
 *
 * Layout beside `manifest.json`: `demos/<slug>.json`, one file per demo with its complete-page
 * captures. `manifest.json` keeps the global data (runtime fingerprint, matrix hash, status,
 * variant and invitation captures). Readers always get the merged view, so every consumer sees
 * the same shape as before the split.
 */
export const DEMO_MANIFEST_DIR = 'demos';
export const DEMO_MANIFEST_VERSION = 1;

type Json = Record<string, unknown>;

interface DemoCapture extends Json {
	kind: 'demo';
	slug: string;
	eventType: string;
}

export interface DemoManifest {
	version: typeof DEMO_MANIFEST_VERSION;
	slug: string;
	eventType: string;
	captures: DemoCapture[];
}

export interface SplitAcceptedManifest {
	root: Json;
	demos: DemoManifest[];
}

function isDemoCapture(value: unknown): value is DemoCapture {
	return Boolean(value) && (value as Json).kind === 'demo';
}

function withoutDemos(captures: unknown): unknown {
	return Array.isArray(captures)
		? captures.filter((capture) => !isDemoCapture(capture))
		: captures;
}

function demoKey(demo: Pick<DemoManifest, 'slug' | 'eventType'>): string {
	return `${demo.eventType}/${demo.slug}`;
}

/** Moves every demo capture out of the manifest, including the nested page manifest copy. */
export function splitDemoCaptures(manifest: Json): SplitAcceptedManifest {
	const byDemo = new Map<string, DemoManifest>();
	const captures = Array.isArray(manifest.captures) ? manifest.captures : [];
	for (const capture of captures) {
		if (!isDemoCapture(capture)) continue;
		const key = demoKey(capture);
		const demo = byDemo.get(key) ?? {
			version: DEMO_MANIFEST_VERSION,
			slug: capture.slug,
			eventType: capture.eventType,
			captures: [],
		};
		demo.captures.push(capture);
		byDemo.set(key, demo);
	}
	const root: Json = { ...manifest, captures: withoutDemos(manifest.captures) };
	const nested = manifest.pageManifest as Json | undefined;
	if (nested) root.pageManifest = { ...nested, captures: withoutDemos(nested.captures) };
	const demos = [...byDemo.values()].sort((left, right) =>
		demoKey(left) < demoKey(right) ? -1 : demoKey(left) > demoKey(right) ? 1 : 0,
	);
	return { root, demos };
}

/** Inverse of {@link splitDemoCaptures}: demo captures follow the root ones, ordered by demo. */
export function mergeDemoManifests(root: Json, demos: readonly DemoManifest[]): Json {
	const ordered = [...demos].sort((left, right) =>
		demoKey(left) < demoKey(right) ? -1 : demoKey(left) > demoKey(right) ? 1 : 0,
	);
	const demoCaptures = ordered.flatMap((demo) => demo.captures);
	if (demoCaptures.length === 0) return root;
	const merged: Json = {
		...root,
		captures: [...((root.captures as unknown[]) ?? []), ...demoCaptures],
	};
	const nested = root.pageManifest as Json | undefined;
	if (nested) {
		merged.pageManifest = {
			...nested,
			captures: [...((nested.captures as unknown[]) ?? []), ...demoCaptures],
		};
	}
	return merged;
}

export function demoManifestDirectory(manifestPath: string): string {
	return join(dirname(manifestPath), DEMO_MANIFEST_DIR);
}

export function listDemoManifestFiles(manifestPath: string): string[] {
	const directory = demoManifestDirectory(manifestPath);
	if (!existsSync(directory)) return [];
	return readdirSync(directory)
		.filter((name) => name.endsWith('.json'))
		.sort()
		.map((name) => join(directory, name));
}

function parseDemoManifest(file: string): DemoManifest {
	const demo = JSON.parse(readFileSync(file, 'utf8')) as Partial<DemoManifest>;
	if (
		demo.version !== DEMO_MANIFEST_VERSION ||
		typeof demo.slug !== 'string' ||
		typeof demo.eventType !== 'string' ||
		!Array.isArray(demo.captures)
	) {
		throw new Error(`Invalid demo visual manifest: ${file}`);
	}
	return demo as DemoManifest;
}

/** Reads the accepted manifest with every per-demo manifest merged back in. */
export function readAcceptedManifestFile(manifestPath: string): Json {
	const root = JSON.parse(readFileSync(manifestPath, 'utf8')) as Json;
	return mergeDemoManifests(root, listDemoManifestFiles(manifestPath).map(parseDemoManifest));
}

/** Raw bytes of the manifest and its demo manifests, in a stable order, for digesting. */
export function readAcceptedManifestBytes(manifestPath: string): Buffer {
	return Buffer.concat([
		readFileSync(manifestPath),
		...listDemoManifestFiles(manifestPath).map((file) => readFileSync(file)),
	]);
}

/** Writes `manifest.json` plus one file per demo, with the indentation Prettier uses for JSON. */
export function writeAcceptedManifestFiles(manifestPath: string, manifest: Json): void {
	const { root, demos } = splitDemoCaptures(manifest);
	const directory = demoManifestDirectory(manifestPath);
	rmSync(directory, { recursive: true, force: true });
	if (demos.length > 0) mkdirSync(directory, { recursive: true });
	for (const demo of demos) {
		writeFileSync(
			join(directory, `${demo.slug}.json`),
			`${JSON.stringify(demo, null, 4)}\n`,
			'utf8',
		);
	}
	writeFileSync(manifestPath, `${JSON.stringify(root, null, 4)}\n`, 'utf8');
}
