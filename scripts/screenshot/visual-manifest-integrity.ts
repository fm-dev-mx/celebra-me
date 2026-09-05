import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

export function listPngFiles(root: string): string[] {
	if (!existsSync(root)) return [];
	return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
		const file = join(root, entry.name);
		return entry.isDirectory() ? listPngFiles(file) : entry.name.endsWith('.png') ? [file] : [];
	});
}

export function assertManifestIntegrity(
	manifest: { captures: readonly { file: string; sha256: string }[] },
	root: string,
): void {
	const declaredFiles = new Set(
		manifest.captures.map((capture) => capture.file.replaceAll('\\', '/')),
	);
	const actualFiles = new Set(
		listPngFiles(root).map((file) => relative(root, file).replaceAll('\\', '/')),
	);
	for (const file of actualFiles) {
		if (!declaredFiles.has(file))
			throw new Error(`Visual root contains an unlisted PNG: ${file}`);
	}
	for (const file of declaredFiles) {
		if (!actualFiles.has(file)) throw new Error(`Visual manifest is missing a PNG: ${file}`);
	}
	for (const capture of manifest.captures) {
		const absolutePath = resolve(root, capture.file);
		if (!absolutePath.startsWith(`${resolve(root)}${sep}`)) {
			throw new Error(`Visual manifest path escapes its root: ${capture.file}`);
		}
		if (!existsSync(absolutePath)) {
			throw new Error(`Visual manifest references a missing PNG: ${capture.file}`);
		}
		const digest = createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
		if (digest !== capture.sha256) {
			throw new Error(`Visual manifest hash mismatch: ${capture.file}`);
		}
	}
}
