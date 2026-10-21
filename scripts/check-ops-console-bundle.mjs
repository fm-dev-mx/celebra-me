#!/usr/bin/env node
/**
 * Fails the build when anything from the dev-only operations console (src/ops-console/) reached
 * `dist/`, which is what the Cloudflare Worker serves. Runs right after `astro build`.
 *   node scripts/check-ops-console-bundle.mjs [distDir]
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep in sync with src/ops-console/sentinel.ts (a test asserts they match).
export const OPS_CONSOLE_SENTINEL = '__CELEBRA_OPS_CONSOLE__';
const MARKERS = [OPS_CONSOLE_SENTINEL, 'src/ops-console/', 'OpsConsolePage'];
const TEXT_EXTENSIONS = /\.(?:m?js|cjs|css|html|json|map|txt|xml|webmanifest)$/i;

function listFiles(directory) {
	return readdirSync(directory).flatMap((name) => {
		const path = join(directory, name);
		return statSync(path).isDirectory() ? listFiles(path) : [path];
	});
}

export function findOpsConsoleLeaks(distDir) {
	if (!existsSync(distDir)) return null;
	const leaks = [];
	for (const file of listFiles(distDir)) {
		if (!TEXT_EXTENSIONS.test(file)) continue;
		const content = readFileSync(file, 'utf8');
		for (const marker of MARKERS) {
			if (content.includes(marker)) {
				leaks.push({ file: relative(distDir, file).replaceAll('\\', '/'), marker });
			}
		}
	}
	return leaks;
}

function main() {
	const distDir = process.argv[2] ?? 'dist';
	const leaks = findOpsConsoleLeaks(distDir);
	if (leaks === null) {
		console.error(
			`ops-console bundle check: ${distDir}/ does not exist; run astro build first.`,
		);
		process.exit(1);
	}
	if (leaks.length > 0) {
		console.error(
			'ops-console bundle check FAILED: the dev-only console reached the build output.',
		);
		for (const leak of leaks)
			console.error(`  ${distDir}/${leak.file} contains "${leak.marker}"`);
		console.error(
			'Nothing under src/pages, src/components or other bundled code may import src/ops-console/.',
		);
		process.exit(1);
	}
	console.info(`ops-console bundle check passed: ${distDir}/ has no trace of src/ops-console/.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	main();
}
