#!/usr/bin/env tsx
/**
 * CSS visual parity harness — required before invitation-profile LAYOUT deletion.
 * @see docs/domains/theme/css-visual-parity.md
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
	corpusPublicRoute,
	listLocalRenderCorpus,
} from '../provision/local-render-corpus/registry.ts';

export type ParityPhase = 'baseline' | 'compare';

export interface ParityManifest {
	slug: string;
	route: string;
	phase: ParityPhase;
	viewport: string;
	createdAt: string;
	files: Record<string, string>;
}

export function parityRoot(slug: string): string {
	return path.join(process.cwd(), '.tmp', 'css-visual-parity', slug);
}

export function phaseDir(slug: string, phase: ParityPhase): string {
	return path.join(parityRoot(slug), phase);
}

export function manifestPath(slug: string, phase: ParityPhase): string {
	return path.join(phaseDir(slug, phase), 'manifest.json');
}

export function sha256File(filePath: string): string {
	const buf = fs.readFileSync(filePath);
	return crypto.createHash('sha256').update(buf).digest('hex');
}

export function listPngFiles(dir: string): string[] {
	if (!fs.existsSync(dir)) return [];
	const out: string[] = [];
	const walk = (current: string) => {
		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const full = path.join(current, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.name.toLowerCase().endsWith('.png')) out.push(full);
		}
	};
	walk(dir);
	return out.sort();
}

export function buildManifest(input: {
	slug: string;
	route: string;
	phase: ParityPhase;
	viewport: string;
	captureDir: string;
}): ParityManifest {
	const files: Record<string, string> = {};
	for (const absolute of listPngFiles(input.captureDir)) {
		const relative = path.relative(input.captureDir, absolute).split(path.sep).join('/');
		files[relative] = sha256File(absolute);
	}
	return {
		slug: input.slug,
		route: input.route,
		phase: input.phase,
		viewport: input.viewport,
		createdAt: new Date().toISOString(),
		files,
	};
}

export function compareManifests(
	baseline: ParityManifest,
	candidate: ParityManifest,
): { ok: true } | { ok: false; reasons: string[] } {
	const reasons: string[] = [];
	const baselineKeys = Object.keys(baseline.files).sort();
	const candidateKeys = Object.keys(candidate.files).sort();

	if (baselineKeys.length === 0) {
		reasons.push('Baseline manifest has zero PNG files.');
	}
	if (candidateKeys.length === 0) {
		reasons.push('Compare manifest has zero PNG files.');
	}

	for (const key of baselineKeys) {
		if (!(key in candidate.files)) {
			reasons.push(`Missing in compare: ${key}`);
			continue;
		}
		if (baseline.files[key] !== candidate.files[key]) {
			reasons.push(`Hash mismatch: ${key}`);
		}
	}
	for (const key of candidateKeys) {
		if (!(key in baseline.files)) {
			reasons.push(`Unexpected in compare: ${key}`);
		}
	}

	return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

function parseArgs(argv: string[]): {
	slug?: string;
	url?: string;
	phase?: ParityPhase;
	viewport: string;
	skipCapture: boolean;
} {
	const options: {
		slug?: string;
		url?: string;
		phase?: ParityPhase;
		viewport: string;
		skipCapture: boolean;
	} = {
		viewport: 'mobile-standard',
		skipCapture: false,
	};
	for (const arg of argv) {
		if (arg.startsWith('--slug=')) options.slug = arg.slice('--slug='.length);
		else if (arg.startsWith('--url=')) options.url = arg.slice('--url='.length);
		else if (arg.startsWith('--phase=')) {
			const phase = arg.slice('--phase='.length);
			if (phase !== 'baseline' && phase !== 'compare') {
				throw new Error(`Invalid --phase=${phase}. Use baseline|compare.`);
			}
			options.phase = phase;
		} else if (arg.startsWith('--viewport=')) {
			options.viewport = arg.slice('--viewport='.length);
		} else if (arg === '--skip-capture') {
			options.skipCapture = true;
		}
	}
	return options;
}

function resolveRoute(
	slug: string | undefined,
	url: string | undefined,
): {
	slug: string;
	route: string;
} {
	if (url) {
		const pathname = url.startsWith('http') ? new URL(url).pathname : url;
		const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean);
		const inferredSlug = slug ?? parts.at(-1);
		if (!inferredSlug) {
			throw new Error('Could not infer slug from --url. Pass --slug=<slug>.');
		}
		return { slug: inferredSlug, route: pathname.startsWith('/') ? pathname : `/${pathname}` };
	}
	if (!slug) {
		throw new Error('Pass --slug=<corpus-slug> or --url=/<eventType>/<slug>.');
	}
	const entry = listLocalRenderCorpus().find((item) => item.slug === slug);
	if (!entry) {
		throw new Error(
			`Slug "${slug}" is not in the Local Render Corpus. Pass --url=/<eventType>/<slug> explicitly.`,
		);
	}
	return { slug, route: corpusPublicRoute(entry) };
}

function runCapture(route: string, outputDir: string, viewport: string): void {
	fs.mkdirSync(outputDir, { recursive: true });
	const result = spawnSync(
		'pnpm',
		[
			'exec',
			'tsx',
			'scripts/screenshot/cli.ts',
			`--url=${route}`,
			'--type=invitation',
			`--viewport=${viewport}`,
			'--target=critical-qa',
			`--output=${outputDir}`,
			'--clean',
		],
		{ stdio: 'inherit', shell: true, cwd: process.cwd() },
	);
	if (result.status !== 0) {
		throw new Error(
			`Screenshot capture failed for ${route} (exit ${result.status ?? 'null'}).`,
		);
	}
}

function main(): void {
	const parsed = parseArgs(process.argv.slice(2));
	if (!parsed.phase) {
		throw new Error('Pass --phase=baseline or --phase=compare.');
	}
	const { slug, route } = resolveRoute(parsed.slug, parsed.url);
	const captureDir = phaseDir(slug, parsed.phase);

	if (!parsed.skipCapture) {
		runCapture(route, captureDir, parsed.viewport);
	}

	const manifest = buildManifest({
		slug,
		route,
		phase: parsed.phase,
		viewport: parsed.viewport,
		captureDir,
	});
	fs.mkdirSync(captureDir, { recursive: true });
	fs.writeFileSync(manifestPath(slug, parsed.phase), `${JSON.stringify(manifest, null, 2)}\n`);

	console.log(
		`Wrote ${manifestPath(slug, parsed.phase)} (${Object.keys(manifest.files).length} PNG digests).`,
	);

	if (parsed.phase === 'compare') {
		const baselineFile = manifestPath(slug, 'baseline');
		if (!fs.existsSync(baselineFile)) {
			throw new Error(
				`Missing baseline at ${baselineFile}. Run --phase=baseline before LAYOUT deletion.`,
			);
		}
		const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8')) as ParityManifest;
		const result = compareManifests(baseline, manifest);
		if (!result.ok) {
			console.error('CSS visual parity FAILED:');
			for (const reason of result.reasons) console.error(`  - ${reason}`);
			console.error('Restore the profile LAYOUT change and do not delete LAYOUT.');
			process.exit(1);
		}
		console.log('CSS visual parity PASSED.');
	}
}

const isDirectRun =
	process.argv[1]?.includes('css-visual-parity') ||
	process.argv[1]?.endsWith('css-visual-parity.ts');

if (isDirectRun) {
	try {
		main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
