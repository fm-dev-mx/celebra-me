import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

function normalizePath(file) {
	return file.replaceAll('\\', '/').replace(/^\.\//u, '');
}

// The operations console (src/ops-console/) is injected only by `astro dev` and runs Node child
// processes. Anything else under src/ is bundled into the Worker, so importing the console from
// there would ship it. Only the console's own files may reference it.
const OPS_CONSOLE_DIR = 'src/ops-console/';
const OPS_CONSOLE_IMPORT =
	/(?:from\s+|import\s*\(\s*|import\s+|require\(\s*)['"][^'"]*ops-console\/[^'"]*['"]/;
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.astro', '.scss']);

export function validateOpsConsoleImports(root, trackedFiles) {
	const errors = [];
	for (const trackedFile of trackedFiles) {
		const relativeFile = normalizePath(trackedFile);
		if (!relativeFile.startsWith('src/') || relativeFile.startsWith(OPS_CONSOLE_DIR)) continue;
		if (!SCAN_EXTENSIONS.has(path.extname(relativeFile))) continue;
		const absolute = path.join(root, ...relativeFile.split('/'));
		if (!existsSync(absolute)) continue;
		const content = readFileSync(absolute, 'utf8');
		content.split(/\r?\n/).forEach((lineText, idx) => {
			if (OPS_CONSOLE_IMPORT.test(lineText)) {
				errors.push(
					`${relativeFile}:${idx + 1}: imports src/ops-console/; the operations console is dev-only and must never reach the Worker bundle.`,
				);
			}
		});
	}
	return errors;
}
