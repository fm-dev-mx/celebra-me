import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function normalizePath(file) {
	return file.replaceAll('\\', '/').replace(/^\.\//u, '');
}

// `sharp` is a native Node module. Edge runtimes do not ship it, so a static import under
// `src/` makes every route that (transitively) imports that module fail at load time, before
// authentication. Server code must load it lazily (`await import('sharp')`) from Node-only
// paths, or leave image decoding to `scripts/`. Type-only imports are erased and stay allowed.
const STATIC_SHARP_IMPORT_ALLOWLIST = new Set([]);

const STATIC_SHARP_IMPORT_RULES = [
	{
		// import sharp from 'sharp'; import { x } from 'sharp'; import * as s from 'sharp'; import 'sharp'
		pattern: /^\s*import\s+(?!type\b)(?:[^;'"]*?\s+from\s+)?['"]sharp['"]/,
		message: 'imports sharp statically',
	},
	{
		pattern: /^\s*export\s+(?!type\b)[^;'"]*?\s+from\s+['"]sharp['"]/,
		message: 're-exports sharp statically',
	},
	{
		pattern: /\brequire\(\s*['"]sharp['"]\s*\)/,
		message: 'requires sharp statically',
	},
];

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.astro']);

export function validateStaticSharpImports(root, trackedFiles) {
	const errors = [];
	for (const trackedFile of trackedFiles) {
		const relativeFile = normalizePath(trackedFile);
		if (!relativeFile.startsWith('src/')) continue;
		if (!SCAN_EXTENSIONS.has(path.extname(relativeFile))) continue;
		if (STATIC_SHARP_IMPORT_ALLOWLIST.has(relativeFile)) continue;
		const absolute = path.join(root, ...relativeFile.split('/'));
		if (!existsSync(absolute)) continue;
		let content;
		try {
			content = readFileSync(absolute, 'utf8');
		} catch {
			continue;
		}
		content.split(/\r?\n/).forEach((lineText, idx) => {
			for (const rule of STATIC_SHARP_IMPORT_RULES) {
				if (rule.pattern.test(lineText)) {
					errors.push(
						`${relativeFile}:${idx + 1}: ${rule.message}; sharp is Node-only, so load it with import() in Node-only code or move the work to scripts/.`,
					);
				}
			}
		});
	}
	return errors;
}
