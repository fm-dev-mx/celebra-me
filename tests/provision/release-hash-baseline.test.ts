import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import {
	buildValidUntil,
	diffReleaseHashes,
	findPrematureDefinitionRemovals,
	formatReleaseHashReport,
	ownsChangedFile,
	readReleaseHashBaseline,
	RELEASE_HASH_BASELINE_PATH,
} from '../../scripts/provision/release-hash-baseline.ts';
import {
	listActiveInvitationDefinitions,
	listInvitationDefinitions,
} from '../../scripts/provision/invitations/registry.ts';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);

describe('release hash baseline', () => {
	const definitions = [{ slug: 'renata' }, { slug: 'norma-hernandez' }, { slug: 'nueva' }];

	it('flags hashes moved by a global change as collateral', () => {
		const report = diffReleaseHashes({
			baseline: { packageHashes: { renata: A, 'norma-hernandez': A, retirada: A } },
			current: { renata: B, 'norma-hernandez': A, nueva: A },
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
			baseline: { packageHashes: { renata: A, 'norma-hernandez': A } },
			current: { renata: B, 'norma-hernandez': B },
			definitions,
			changedFiles: [
				'scripts\\provision\\invitations\\renata.ts',
				'src/assets/invitations/norma-hernandez/hero.webp',
			],
		});
		expect(report.collateral).toEqual([]);
		expect(report.expected.map((move) => move.slug)).toEqual(['norma-hernandez', 'renata']);
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

	it('pins the validity window of every active definition', () => {
		expect(readReleaseHashBaseline().validUntil).toEqual(
			buildValidUntil(listActiveInvitationDefinitions()),
		);
	});

	it('never loses a definition before its invitation expires', () => {
		// A failure here means a definition file was deleted while its invitation is still
		// public (event date + 1 year): restore it until the window closes.
		expect(
			findPrematureDefinitionRemovals(
				readReleaseHashBaseline(),
				listInvitationDefinitions().map((definition) => definition.slug),
			),
		).toEqual([]);
	});

	it('flags removed slugs whose window is open or unknown, never expired ones', () => {
		const baseline = {
			packageHashes: { kept: A, expired: A, open: A, undated: A },
			validUntil: {
				kept: '2026-01-01T05:59:59.999Z',
				expired: '2026-01-01T05:59:59.999Z',
				open: '2027-06-21T05:59:59.999Z',
			},
		};
		expect(
			findPrematureDefinitionRemovals(baseline, ['kept'], new Date('2026-10-13T00:00:00Z')),
		).toEqual(['open', 'undated']);
		expect(
			findPrematureDefinitionRemovals(
				baseline,
				['kept'],
				new Date('2027-06-21T05:59:59.999Z'),
			),
		).toEqual(['open', 'undated']);
		expect(
			findPrematureDefinitionRemovals(
				baseline,
				['kept'],
				new Date('2027-06-21T06:00:00.000Z'),
			),
		).toEqual(['undated']);
	});
});
