import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
	diffReleaseHashes,
	formatReleaseHashReport,
	ownsChangedFile,
	readReleaseHashBaseline,
	RELEASE_HASH_BASELINE_PATH,
} from '../../scripts/provision/release-hash-baseline.ts';
import { listActiveInvitationDefinitions } from '../../scripts/provision/invitations/registry.ts';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);

describe('release hash baseline', () => {
	const definitions = [{ slug: 'renata' }, { slug: 'leah-lexa' }, { slug: 'nueva' }];

	it('flags hashes moved by a global change as collateral', () => {
		const report = diffReleaseHashes({
			baseline: { packageHashes: { renata: A, 'leah-lexa': A, retirada: A } },
			current: { renata: B, 'leah-lexa': A, nueva: A },
			definitions,
			changedFiles: ['scripts/provision/invitation-package.ts'],
		});
		expect(report.collateral).toEqual([{ slug: 'renata', previous: A, current: B }]);
		expect(report.expected).toEqual([]);
		expect(report.added).toEqual(['nueva']);
		expect(report.removed).toEqual(['retirada']);
		const text = formatReleaseHashReport(report);
		expect(text).toContain('renata');
		expect(text).toContain('MISSING_PREVIEW_APPROVAL');
		expect(text).toContain('pnpm invitation:hash-baseline -- --update');
	});

	it('treats a move with the invitation own definition or assets as expected', () => {
		const report = diffReleaseHashes({
			baseline: { packageHashes: { renata: A, 'leah-lexa': A } },
			current: { renata: B, 'leah-lexa': B },
			definitions,
			changedFiles: [
				'scripts\\provision\\invitations\\renata.ts',
				'src/assets/invitations/leah-lexa/hero.webp',
			],
		});
		expect(report.collateral).toEqual([]);
		expect(report.expected.map((move) => move.slug)).toEqual(['leah-lexa', 'renata']);
	});

	it('honours a custom asset directory', () => {
		expect(
			ownsChangedFile({ slug: 'x', assetDir: 'src/assets/custom/x' }, [
				'src/assets/custom/x/a.webp',
			]),
		).toBe(true);
		expect(ownsChangedFile({ slug: 'x' }, ['src/assets/invitations/xy/a.webp'])).toBe(false);
	});

	it('keeps the committed baseline aligned with the active registry', () => {
		const baseline = readReleaseHashBaseline();
		expect(readFileSync(RELEASE_HASH_BASELINE_PATH, 'utf8').endsWith('\n')).toBe(true);
		expect(Object.keys(baseline.packageHashes).sort()).toEqual(
			listActiveInvitationDefinitions()
				.map((definition) => definition.slug)
				.sort(),
		);
		for (const hash of Object.values(baseline.packageHashes)) {
			expect(hash).toMatch(/^[a-f0-9]{64}$/);
		}
	});
});
