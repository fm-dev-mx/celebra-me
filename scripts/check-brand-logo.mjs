#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The Celebra-me logo comes only from the logo_2026_v2 exports copied into public/, is referenced
// only through src/lib/brand/brand-logo.ts (rendered by src/components/ui/Logo.astro), and is
// never filtered, shadowed or rotated. CI fails when any of that drifts.

const BRAND_MODULE = 'src/lib/brand/brand-logo.ts';

/** Files and folders of the retired logo; naming one means the old logo is coming back. */
const RETIRED_LOGO_PATTERNS = [
	/horizontal-logo150x56/u,
	/celebra-me-mark\.svg/u,
	/celebra-me-lockup-/u,
	/celebra-me-(square|circle)-500/u,
	/brands\/assets\/celebra-me\/logo\//u,
	/icons\/favicon\.svg/u,
	/icons\/icon-192\.png/u,
	/og-(home|login)\.jpg/u,
];

/** Paths that point straight at a logo or brand icon file. */
const LOGO_FILE_PATTERN =
	/celebra-me_(principal|compacto|horizontal|sello|firma-invitacion)_|\/favicon(-16|-32)?\.(svg|ico|png)|\/apple-touch-icon\.png|\/icon-512\.png|og-image_1200x630/u;

const CODE_EXTENSIONS = new Set(['.astro', '.ts', '.tsx', '.js', '.mjs', '.scss', '.css', '.html']);

/** Files allowed to name logo files directly: the owner module, docs and the web manifest. */
const LOGO_PATH_ALLOWLIST = new Set([BRAND_MODULE, 'public/site.webmanifest', 'README.md']);

/** History and the guard itself may name retired files. */
const RETIRED_ALLOWLIST = new Set([
	'CHANGELOG.md',
	'scripts/check-brand-logo.mjs',
	'tests/unit/check-brand-logo.test.ts',
]);

const LOGO_SELECTOR = /logo/iu;
const FORBIDDEN_LOGO_DECLARATION = /^\s*(-webkit-)?(filter|box-shadow|text-shadow)\s*:|rotate\(/u;

function normalizePath(file) {
	return file.replaceAll('\\', '/').replace(/^\.\//u, '');
}

function readText(root, relativeFile) {
	const absolute = path.join(root, ...relativeFile.split('/'));
	if (!existsSync(absolute)) return null;
	const content = readFileSync(absolute, 'utf8');
	return content.includes('\0') ? null : content;
}

export function findRetiredLogoReferences(root, files) {
	const findings = [];
	for (const file of files) {
		if (RETIRED_ALLOWLIST.has(file)) continue;
		const content = readText(root, file);
		if (content === null) continue;
		content.split(/\r?\n/u).forEach((line, index) => {
			if (RETIRED_LOGO_PATTERNS.some((pattern) => pattern.test(line))) {
				findings.push(`${file}:${index + 1}: names a retired logo file.`);
			}
		});
	}
	return findings;
}

export function findDirectLogoPaths(root, files) {
	const findings = [];
	for (const file of files) {
		if (LOGO_PATH_ALLOWLIST.has(file) || RETIRED_ALLOWLIST.has(file)) continue;
		if (!CODE_EXTENSIONS.has(path.extname(file))) continue;
		const content = readText(root, file);
		if (content === null) continue;
		content.split(/\r?\n/u).forEach((line, index) => {
			if (LOGO_FILE_PATTERN.test(line)) {
				findings.push(`${file}:${index + 1}: points at a logo file; use ${BRAND_MODULE}.`);
			}
		});
	}
	return findings;
}

/** Flags filters, shadows and rotation declared inside any rule whose selector mentions a logo. */
export function findStyledLogos(root, files) {
	const findings = [];
	for (const file of files) {
		if (!['.scss', '.css', '.astro'].includes(path.extname(file))) continue;
		const content = readText(root, file);
		if (content === null) continue;
		const selectors = [];
		let pending = '';
		content.split(/\r?\n/u).forEach((line, index) => {
			const code = line.replace(/\/\/.*$/u, '');
			for (const char of code) {
				if (char === '{') {
					selectors.push(pending.trim());
					pending = '';
				} else if (char === '}') {
					selectors.pop();
					pending = '';
				} else if (char === ';') {
					pending = '';
				} else {
					pending += char;
				}
			}
			pending += ' ';
			const inLogoRule = selectors.some((selector) => LOGO_SELECTOR.test(selector));
			if (inLogoRule && FORBIDDEN_LOGO_DECLARATION.test(code)) {
				findings.push(
					`${file}:${index + 1}: styles the logo with a filter, shadow or rotation.`,
				);
			}
		});
	}
	return findings;
}

/** Every file the brand module and the Logo usages need must exist in public/. */
export function findMissingLogoFiles(root, files) {
	const findings = [];
	const required = new Set();
	const brandModule = readText(root, BRAND_MODULE) ?? '';
	for (const match of brandModule.matchAll(/'(\/[^']+\.(?:svg|ico|png))'/gu))
		required.add(match[1]);
	for (const file of files) {
		if (path.extname(file) !== '.astro') continue;
		const content = readText(root, file) ?? '';
		for (const match of content.matchAll(/<Logo\b[^>]*>/gu)) {
			const version = /version="([^"]+)"/u.exec(match[0])?.[1];
			const tone = /tone="([^"]+)"/u.exec(match[0])?.[1];
			if (version && tone) required.add(`/brand/celebra-me_${version}_color-${tone}.svg`);
		}
	}
	for (const asset of [...required].sort()) {
		if (!existsSync(path.join(root, 'public', ...asset.slice(1).split('/')))) {
			findings.push(`public${asset}: missing logo_2026_v2 file.`);
		}
	}
	return findings;
}

export function checkBrandLogo(root, files) {
	return [
		...findRetiredLogoReferences(root, files),
		...findDirectLogoPaths(root, files),
		...findStyledLogos(root, files),
		...findMissingLogoFiles(root, files),
	];
}

function listRepositoryFiles(root) {
	const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
		cwd: root,
		encoding: 'utf8',
	});
	return output.split('\n').filter(Boolean).map(normalizePath);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
	const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
	const findings = checkBrandLogo(root, listRepositoryFiles(root));
	if (findings.length > 0) {
		console.error(`Brand logo check failed (${findings.length}):`);
		for (const finding of findings) console.error(`  - ${finding}`);
		process.exit(1);
	}
	console.log('Brand logo check passed.');
}
