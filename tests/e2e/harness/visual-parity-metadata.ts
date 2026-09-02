import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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

function hashDirectoryFiles(root: string, pattern: RegExp, label: string): string {
	if (!fs.existsSync(root)) {
		throw new Error(`Visual parity ${label} directory is missing: ${root}`);
	}
	const files: string[] = [];
	const visit = (directory: string, prefix = ''): void => {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			const relativePath = prefix ? path.join(prefix, entry.name) : entry.name;
			const absolutePath = path.join(directory, entry.name);
			if (entry.isDirectory()) visit(absolutePath, relativePath);
			else if (entry.isFile() && pattern.test(entry.name)) files.push(relativePath);
		}
	};
	visit(root);
	if (files.length === 0) {
		throw new Error(`Visual parity ${label} directory has no matching files: ${root}`);
	}
	return hashAssetFiles(root, files);
}

function readPackageVersion(packagePath: string): string {
	try {
		const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8')) as {
			version?: unknown;
		};
		return typeof packageJson.version === 'string' ? packageJson.version : 'unknown';
	} catch {
		return 'unknown';
	}
}

function readChromiumVersion(): { revision: string; browserVersion: string } {
	try {
		const manifest = JSON.parse(
			fs.readFileSync(
				path.join(process.cwd(), 'node_modules/playwright-core/browsers.json'),
				'utf8',
			),
		) as { browsers?: Array<{ name?: string; revision?: string; browserVersion?: string }> };
		const chromium = manifest.browsers?.find((browser) => browser.name === 'chromium');
		return {
			revision: chromium?.revision ?? 'unknown',
			browserVersion: chromium?.browserVersion ?? 'unknown',
		};
	} catch {
		return { revision: 'unknown', browserVersion: 'unknown' };
	}
}

const projectRoot = process.cwd();
const chromium = readChromiumVersion();

/** Runtime and source identity recorded with every visual candidate and accepted baseline. */
export const VISUAL_PARITY_RUNTIME = {
	node: process.version,
	pnpm: process.env.npm_config_user_agent?.match(/pnpm\/(\S+)/u)?.[1] ?? 'unknown',
	playwright: readPackageVersion(
		path.join(projectRoot, 'node_modules/@playwright/test/package.json'),
	),
	browser: 'chromium',
	browserRevision: chromium.revision,
	browserVersion: chromium.browserVersion,
	platform: `${process.platform}-${process.arch}`,
	locale: 'en-US',
	timezone: 'UTC',
	deviceScaleFactor: 1,
	lockfileSha256: hashAssetFiles(projectRoot, ['pnpm-lock.yaml']),
	cssSha256: hashDirectoryFiles(path.join(projectRoot, 'src/styles'), /\.(?:css|scss)$/iu, 'CSS'),
	assetSha256: hashDirectoryFiles(
		path.join(projectRoot, 'src/assets'),
		/\.(?:avif|gif|jpe?g|png|svg|webp)$/iu,
		'asset',
	),
	fontSha256: hashVisualValue({
		standard: hashDirectoryFiles(
			path.join(projectRoot, 'node_modules/@fontsource'),
			/\.(?:css|otf|ttf|woff2?)$/iu,
			'standard font',
		),
		variable: hashDirectoryFiles(
			path.join(projectRoot, 'node_modules/@fontsource-variable'),
			/\.(?:css|otf|ttf|woff2?)$/iu,
			'variable font',
		),
	}),
	osImageDigest: process.env.VISUAL_PARITY_OS_IMAGE_DIGEST ?? 'unverified',
} as const;

/** Hash every versioned binary in a local asset directory in stable path order. */
export function hashAssetDirectory(root: string): string {
	return hashDirectoryFiles(root, /\.(?:avif|gif|jpe?g|png|webp)$/iu, 'asset');
}
