import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Runtime identity recorded with every visual candidate and accepted baseline. */
export const VISUAL_PARITY_RUNTIME = {
	node: process.version,
	playwright: '1.62.1',
	browser: 'chromium',
	platform: process.platform,
} as const;

function canonicalize(value: unknown): string {
	if (value === undefined) return 'undefined';
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
		.join(',')}}`;
}

export function hashVisualValue(value: unknown): string {
	return crypto.createHash('sha256').update(canonicalize(value)).digest('hex');
}

export function hashAssetFiles(root: string, files: readonly string[]): string {
	const digest = crypto.createHash('sha256');
	for (const relativePath of [...files].map((file) => file.replaceAll('\\', '/')).sort()) {
		const absolutePath = path.join(root, relativePath);
		digest.update(relativePath);
		digest.update(fs.readFileSync(absolutePath));
	}
	return digest.digest('hex');
}

/** Hash every versioned binary in a local asset directory in stable path order. */
export function hashAssetDirectory(root: string): string {
	if (!fs.existsSync(root)) throw new Error(`Visual asset directory is missing: ${root}`);
	const files: string[] = [];
	const visit = (directory: string, prefix = ''): void => {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			const relativePath = prefix ? path.join(prefix, entry.name) : entry.name;
			const absolutePath = path.join(directory, entry.name);
			if (entry.isDirectory()) visit(absolutePath, relativePath);
			else if (entry.isFile() && /\.(?:avif|gif|jpe?g|png|webp)$/iu.test(entry.name)) {
				files.push(relativePath);
			}
		}
	};
	visit(root);
	return hashAssetFiles(root, files);
}
