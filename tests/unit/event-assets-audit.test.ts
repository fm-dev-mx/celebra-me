import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { collectEventAssetFindings } = require('../../scripts/check-event-assets.cjs') as {
	collectEventAssetFindings: (
		eventsRoot: string,
	) => Array<{ type: string; path: string; message: string }>;
};

function createTempEventDir() {
	return fs.mkdtempSync(path.join(os.tmpdir(), 'celebra-assets-'));
}

describe('collectEventAssetFindings', () => {
	it('passes when all event images are imported by index.ts', () => {
		const root = createTempEventDir();
		const eventDir = path.join(root, 'sample-event');
		fs.mkdirSync(eventDir, { recursive: true });
		fs.writeFileSync(path.join(eventDir, 'hero.webp'), 'stub');
		fs.writeFileSync(
			path.join(eventDir, 'index.ts'),
			"import hero from './hero.webp';\nexport const assets = { hero };\n",
		);

		const findings = collectEventAssetFindings(root);

		expect(findings).toEqual([]);
	});

	it('reports untracked image files that are not imported by index.ts', () => {
		const root = createTempEventDir();
		const eventDir = path.join(root, 'broken-event');
		fs.mkdirSync(eventDir, { recursive: true });
		fs.writeFileSync(path.join(eventDir, 'hero.webp'), 'stub');
		fs.writeFileSync(path.join(eventDir, 'gallery-01.webp'), 'stub');
		fs.writeFileSync(
			path.join(eventDir, 'index.ts'),
			"import hero from './hero.webp';\nexport const assets = { hero };\n",
		);

		const findings = collectEventAssetFindings(root);

		expect(
			findings.some((finding: { type: string }) => finding.type === 'untracked-file'),
		).toBe(true);
	});
});
