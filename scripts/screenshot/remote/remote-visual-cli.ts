#!/usr/bin/env tsx
/**
 * Read-only visual compare of live routes on an allow-listed origin.
 *
 *   pnpm visual:remote:routes  --origin=https://www.celebra-me.com
 *   pnpm visual:remote:capture --origin=https://www.celebra-me.com --label=antes
 *   pnpm visual:remote:compare --before=antes --after=despues
 *
 * See docs/operations/remote-visual-compare.md.
 */
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadPlaywrightEnvironment } from '../../playwright/preview-environment.ts';
import { captureRemoteRoutes } from './remote-capture.ts';
import { compareRemoteCaptures } from './remote-compare.ts';
import { REMOTE_VISUAL_OUTPUT_ROOT } from './remote-manifest.ts';
import { classifyRemoteHost, resolveRemoteTarget } from './remote-target.ts';
import { buildRouteCandidates, loadRepositoryRouteSources } from './route-inventory.ts';

/** Frozen browser clock shared by every capture set unless `--clock` says otherwise. */
const DEFAULT_REMOTE_CLOCK = '2026-10-17T12:00:00-07:00';
const LABEL_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

function parseRemoteArgs(argv: string[]): { command: string; flags: Map<string, string> } {
	const [command = '', ...rest] = argv;
	const flags = new Map<string, string>();
	for (const arg of rest) {
		const match = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
		if (!match) throw new Error(`Unknown argument: ${arg}`);
		flags.set(match[1], match[2] ?? 'true');
	}
	return { command, flags };
}

function needsAccessToken(origin: string | undefined): boolean {
	try {
		const kind = classifyRemoteHost(new URL(origin ?? '').hostname);
		return kind !== undefined && kind !== 'production-domain';
	} catch {
		return false;
	}
}

function requireLabel(flags: Map<string, string>, name: string): string {
	const value = flags.get(name);
	if (!value || !LABEL_PATTERN.test(value)) {
		throw new Error(
			`--${name} must be a lowercase label such as "antes" (letters, digits, -).`,
		);
	}
	return value;
}

function listFlag(flags: Map<string, string>, name: string): string[] {
	return (flags.get(name) ?? '')
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
}

async function main(): Promise<number> {
	const { command, flags } = parseRemoteArgs(process.argv.slice(2));
	const root = process.cwd();
	const outputRoot = resolve(root, REMOTE_VISUAL_OUTPUT_ROOT);

	if (command === 'routes' || command === 'capture') {
		const origin = flags.get('origin');
		// Access service tokens live in the E2E env file; the public domain never needs it.
		if (needsAccessToken(origin)) loadPlaywrightEnvironment({ cwd: root });
		const target = resolveRemoteTarget(origin);
		const sources = await loadRepositoryRouteSources(root);
		if (command === 'routes') {
			for (const route of buildRouteCandidates(sources)) {
				console.log(`${route.kind.padEnd(8)} ${route.group.padEnd(13)} ${route.path}`);
			}
			return 0;
		}
		const label = requireLabel(flags, 'label');
		const outputDir = join(outputRoot, label);
		if (existsSync(join(outputDir, 'manifest.json')) && flags.get('replace') !== 'true') {
			throw new Error(
				`Capture set "${label}" already exists; pass --replace=true or pick another label.`,
			);
		}
		console.log(
			`Capturing ${target.host} (${target.kind}) into ${REMOTE_VISUAL_OUTPUT_ROOT}/${label}`,
		);
		const manifest = await captureRemoteRoutes({
			target,
			label,
			outputDir,
			sources,
			clock: flags.get('clock') ?? DEFAULT_REMOTE_CLOCK,
			concurrency: flags.has('concurrency') ? Number(flags.get('concurrency')) : undefined,
			onlyPaths: listFlag(flags, 'only'),
			log: (line) => console.log(line),
		});
		const pages = manifest.routes.filter((route) => route.kind === 'page');
		const failed = pages.flatMap((route) =>
			Object.values(route.captures).filter((capture) => capture?.error),
		);
		console.log(
			`Done: ${manifest.routes.length} routes, ${pages.filter((route) => route.live).length} live pages, ${failed.length} failed captures.`,
		);
		return failed.length > 0 ? 1 : 0;
	}

	if (command === 'compare') {
		const before = requireLabel(flags, 'before');
		const after = requireLabel(flags, 'after');
		const outputDir = join(outputRoot, `compare-${before}-vs-${after}`);
		const result = await compareRemoteCaptures({
			beforeDir: join(outputRoot, before),
			afterDir: join(outputRoot, after),
			outputDir,
			log: (line) => console.log(line),
		});
		console.log(
			`${result.passed ? 'PASS' : 'FAIL'}: ${result.failures.length} failures, ${result.cases.length} cases, ${result.warnings.length} warnings.`,
		);
		console.log(`Report: ${REMOTE_VISUAL_OUTPUT_ROOT}/compare-${before}-vs-${after}/report.md`);
		return result.passed ? 0 : 1;
	}

	console.error('Usage: remote-visual-cli.ts <routes|capture|compare> [--flags]');
	return 2;
}

main().then(
	(code) => process.exit(code),
	(error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(2);
	},
);
