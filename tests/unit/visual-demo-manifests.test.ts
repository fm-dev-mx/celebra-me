import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { discoverDemoCases } from '../../scripts/screenshot/visual-coverage-contract';
import {
	listDemoManifestFiles,
	mergeDemoManifests,
	readAcceptedManifestFile,
	splitDemoCaptures,
	writeAcceptedManifestFiles,
} from '../../scripts/screenshot/visual-demo-manifests';

const ACCEPTED_MANIFEST = 'tests/e2e/visual-baselines/manifest.json';

function demo(slug: string, eventType: string, viewport: string, comparisonResult: string) {
	return {
		kind: 'demo',
		slug,
		eventType,
		viewport,
		file: `${slug}-${viewport}.png`,
		comparisonResult,
	};
}

function sampleManifest() {
	const variant = { kind: 'variant', file: 'hero-mobile.png', comparisonResult: 'ACCEPTED' };
	const invitation = {
		kind: 'invitation',
		slug: 'ana',
		file: 'ana.png',
		comparisonResult: 'ACCEPTED',
	};
	return {
		runtimeFingerprint: { browser: 'chromium' },
		matrixHash: 'a'.repeat(64),
		status: 'ACCEPTED',
		captures: [
			variant,
			invitation,
			demo('demo-a', 'boda', 'mobile', 'ACCEPTED'),
			demo('demo-a', 'boda', 'desktop', 'ACCEPTED'),
			demo('demo-b', 'xv', 'mobile', 'ACCEPTED'),
		],
		variantManifest: { captures: [variant] },
		pageManifest: {
			totalCaptures: 4,
			captures: [
				invitation,
				// The nested copy keeps its own values; the split must not overwrite them.
				demo('demo-a', 'boda', 'mobile', 'CANDIDATE'),
				demo('demo-a', 'boda', 'desktop', 'CANDIDATE'),
				demo('demo-b', 'xv', 'mobile', 'CANDIDATE'),
			],
		},
	};
}

describe('per-demo visual manifests', () => {
	it('splits demo captures out and merges them back unchanged', () => {
		const manifest = sampleManifest();
		const { root, demos } = splitDemoCaptures(manifest);

		expect((root.captures as { kind: string }[]).map((capture) => capture.kind)).toEqual([
			'variant',
			'invitation',
		]);
		expect((root.pageManifest as { captures: unknown[] }).captures).toHaveLength(1);
		expect(root.runtimeFingerprint).toEqual(manifest.runtimeFingerprint);
		expect(demos.map((entry) => `${entry.eventType}/${entry.slug}`)).toEqual([
			'boda/demo-a',
			'xv/demo-b',
		]);
		expect(demos[0].pageCaptures?.map((capture) => capture.comparisonResult)).toEqual([
			'CANDIDATE',
			'CANDIDATE',
		]);
		expect(JSON.stringify(mergeDemoManifests(root, demos))).toBe(JSON.stringify(manifest));
	});

	it('round-trips through the files on disk', () => {
		const directory = mkdtempSync(join(tmpdir(), 'visual-demo-manifests-'));
		try {
			const manifestPath = join(directory, 'manifest.json');
			const manifest = sampleManifest();
			writeAcceptedManifestFiles(manifestPath, manifest);

			expect(readdirSync(join(directory, 'demos')).sort()).toEqual([
				'demo-a.json',
				'demo-b.json',
			]);
			expect(readFileSync(manifestPath, 'utf8')).not.toContain('"demo"');
			expect(JSON.stringify(readAcceptedManifestFile(manifestPath))).toBe(
				JSON.stringify(manifest),
			);
		} finally {
			rmSync(directory, { recursive: true, force: true });
		}
	});

	it('keeps one accepted manifest per demo and none in the root manifest', () => {
		const root = JSON.parse(readFileSync(ACCEPTED_MANIFEST, 'utf8')) as {
			captures: { kind: string }[];
			pageManifest: { captures: { kind: string }[] };
		};
		expect(root.captures.some((capture) => capture.kind === 'demo')).toBe(false);
		expect(root.pageManifest.captures.some((capture) => capture.kind === 'demo')).toBe(false);

		const files = listDemoManifestFiles(ACCEPTED_MANIFEST).map((file) =>
			file.replaceAll('\\', '/').split('/').pop(),
		);
		const slugs = discoverDemoCases().map((entry) => `${entry.slug}.json`);
		expect(files).toEqual([...new Set(slugs)].sort());
	});
});
