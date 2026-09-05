import fs from 'node:fs';

export type VisualParityMode = 'diagnostic' | 'candidate' | 'compare';

interface AcceptedVisualCapture {
	file?: unknown;
	sha256?: unknown;
	viewport?: unknown;
	comparisonResult?: unknown;
}

interface AcceptedVisualManifest {
	status?: unknown;
	mode?: unknown;
	totalCaptures?: unknown;
	matrixHash?: unknown;
	captures?: unknown;
}

function readAcceptedManifest(manifestPath: string): AcceptedVisualManifest {
	if (!fs.existsSync(manifestPath)) {
		throw new Error(
			`Visual parity compare requires an accepted baseline manifest: ${manifestPath}`,
		);
	}

	let manifest: unknown;
	try {
		manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown;
	} catch (error) {
		throw new Error(
			`Visual parity compare could not read the accepted baseline manifest: ${manifestPath}`,
			{ cause: error },
		);
	}

	if (!manifest || typeof manifest !== 'object') {
		throw new Error('Visual parity compare requires an object baseline manifest.');
	}
	return manifest as AcceptedVisualManifest;
}

/** Compare mode is a release gate and never degrades into a candidate run. */
export function assertVisualComparisonReady(mode: VisualParityMode, manifestPath: string): void {
	if (mode !== 'compare') return;

	const manifest = readAcceptedManifest(manifestPath);
	if (manifest.status !== 'ACCEPTED' || manifest.mode !== 'accepted') {
		throw new Error(
			'Visual parity compare requires a manifest with status=ACCEPTED and mode=accepted.',
		);
	}
	if (!Array.isArray(manifest.captures) || manifest.captures.length === 0) {
		throw new Error('Visual parity compare requires a non-empty accepted capture set.');
	}
	if (manifest.totalCaptures !== manifest.captures.length) {
		throw new Error(
			'Visual parity compare requires totalCaptures to match the accepted capture set.',
		);
	}
	if (typeof manifest.matrixHash !== 'string' || !/^[0-9a-f]{64}$/iu.test(manifest.matrixHash)) {
		throw new Error('Visual parity compare requires a valid accepted coverage matrix hash.');
	}
	const files = new Set<string>();
	for (const rawCapture of manifest.captures) {
		if (!rawCapture || typeof rawCapture !== 'object') {
			throw new Error('Visual parity compare requires object capture records.');
		}
		const capture = rawCapture as AcceptedVisualCapture;
		if (
			typeof capture.file !== 'string' ||
			capture.file.length === 0 ||
			files.has(capture.file) ||
			!capture.file.toLowerCase().endsWith('.png')
		) {
			throw new Error('Visual parity compare requires unique PNG capture paths.');
		}
		if (typeof capture.sha256 !== 'string' || !/^[0-9a-f]{64}$/iu.test(capture.sha256)) {
			throw new Error(`Visual parity compare requires a valid SHA-256 for ${capture.file}.`);
		}
		if (typeof capture.viewport !== 'string' || capture.viewport.length === 0) {
			throw new Error(`Visual parity compare requires a viewport for ${capture.file}.`);
		}
		if (capture.comparisonResult === 'CANDIDATE') {
			throw new Error(
				`Visual parity compare cannot accept a candidate capture: ${capture.file}.`,
			);
		}
		files.add(capture.file);
	}
}

export function shouldCompareVisualSnapshots(mode: VisualParityMode): boolean {
	return mode === 'candidate' || mode === 'compare';
}

export function visualComparisonResult(mode: VisualParityMode): 'PASS' | 'CANDIDATE' {
	return mode === 'compare' ? 'PASS' : 'CANDIDATE';
}
