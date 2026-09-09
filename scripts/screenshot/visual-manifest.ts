import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeVisualMatrixHash } from './visual-coverage-contract';

export interface CaptureManifest {
	status: string;
	mode?: string;
	totalCaptures: number;
	runtimeFingerprint?: Record<string, unknown>;
	captures: Array<{
		kind?: string;
		file: string;
		sha256: string;
		contentHash?: string;
		assetHash?: string;
		viewport: string;
		preset: string;
		section: string;
		variant: string;
	}>;
	matrixHash?: string;
	[key: string]: unknown;
}

export interface CombinedManifest extends CaptureManifest {
	variantManifest: CaptureManifest;
	pageManifest: CaptureManifest;
}

function readManifestSource(
	root: string,
	preferSuiteManifests: boolean,
): CaptureManifest & Partial<CombinedManifest> {
	const variantFile = join(root, 'manifest.json');
	const combinedFile = join(root, 'combined-manifest.json');
	if (!existsSync(variantFile) && !existsSync(combinedFile)) {
		throw new Error(`Missing visual manifest: ${variantFile}`);
	}
	const primary = existsSync(variantFile)
		? (JSON.parse(readFileSync(variantFile, 'utf8')) as CaptureManifest &
				Partial<CombinedManifest>)
		: undefined;
	// Regeneration uses fresh suites; acceptance still reads the reviewed combined artifact.
	return primary && (primary.status === 'ACCEPTED' || preferSuiteManifests)
		? primary
		: (JSON.parse(
				readFileSync(existsSync(combinedFile) ? combinedFile : variantFile, 'utf8'),
			) as CaptureManifest & Partial<CombinedManifest>);
}

export function readVisualManifest(
	root: string,
	expected: { variants: number; pages: number },
	preferSuiteManifests = false,
): CombinedManifest {
	const pageFile = join(root, 'pages-manifest.json');
	const raw = readManifestSource(root, preferSuiteManifests);
	const variantManifest = raw.variantManifest ?? raw;
	if (!variantManifest || !Array.isArray(variantManifest.captures)) {
		throw new Error('Visual manifest must declare a captures array. Regenerate the candidate.');
	}
	let pageManifest = raw.pageManifest;
	if (!pageManifest && existsSync(pageFile)) {
		pageManifest = JSON.parse(readFileSync(pageFile, 'utf8')) as CaptureManifest;
	}
	if (!pageManifest) {
		if (!Array.isArray(raw.captures)) {
			throw new Error(`Missing page manifest: ${pageFile}. Regenerate the candidate.`);
		}
		const pageCaptures = raw.captures.filter(
			(capture) => capture.kind === 'invitation' || capture.kind === 'demo',
		);
		pageManifest = { ...raw, captures: pageCaptures, totalCaptures: pageCaptures.length };
	}
	if (!Array.isArray(pageManifest.captures)) {
		throw new Error('Page manifest must declare a captures array. Regenerate the candidate.');
	}
	if (
		variantManifest.totalCaptures !== expected.variants ||
		variantManifest.captures.length !== expected.variants
	) {
		throw new Error(
			`Expected ${expected.variants} variant captures, found ${variantManifest.totalCaptures}.`,
		);
	}
	if (
		pageManifest.totalCaptures !== expected.pages ||
		pageManifest.captures.length !== expected.pages
	) {
		throw new Error(
			`Expected ${expected.pages} complete-page captures, found ${pageManifest.totalCaptures}.`,
		);
	}
	const captures =
		raw.status === 'ACCEPTED'
			? raw.captures
			: [...variantManifest.captures, ...pageManifest.captures];
	return {
		...variantManifest,
		...raw,
		totalCaptures: captures.length,
		captures,
		matrixHash:
			raw.status === 'ACCEPTED'
				? raw.matrixHash
				: computeVisualMatrixHash(captures as unknown as Array<Record<string, unknown>>),
		variantManifest,
		pageManifest,
	};
}
