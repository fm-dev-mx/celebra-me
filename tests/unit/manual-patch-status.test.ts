import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, jest } from '@jest/globals';
import {
	ACTIVE_MANUAL_PATCH_CATALOG,
	MANUAL_PATCH_DIRECTORY,
	MAX_ACTIVE_MANUAL_PATCHES,
	classifyPatchPreviewResult,
	readManualPatchStatuses,
	validateManualPatchCatalog,
} from '../../scripts/provision/manual-patch-status';
import { prepareProductionPatchFile } from '../../scripts/db/run-prod-patch';

const PAIRED_MANIFEST = prepareProductionPatchFile(
	'scripts/manual/production-patches/20260812_p0_itinerary_gallery_structural_contracts.sql',
).manifest;

function pairedStoreScriptIds(): string[] {
	const directory = join(process.cwd(), MANUAL_PATCH_DIRECTORY);
	const ids: string[] = [];
	for (const name of readdirSync(directory)) {
		if (!name.endsWith('.sql')) continue;
		const lines: string[] = [];
		for (const line of readFileSync(join(directory, name), 'utf8').split(/\r?\n/)) {
			const trimmed = line.trim();
			if (trimmed !== '' && !trimmed.startsWith('--')) break;
			lines.push(line);
		}
		const header = lines.join('\n');
		if (!/--\s*@paired-stores:\s*\S+/.test(header)) continue;
		const scriptId = header.match(/^--\s*@script-id:\s*(\S+)/m)?.[1];
		if (scriptId) ids.push(scriptId);
	}
	return ids;
}

describe('active manual patch status', () => {
	it('discovers every paired-store production patch, including America residuals', () => {
		const discovered = ACTIVE_MANUAL_PATCH_CATALOG.map((item) => item.scriptId);
		expect(new Set(discovered)).toEqual(new Set(pairedStoreScriptIds()));
		expect(discovered).toEqual(
			expect.arrayContaining([
				'20260815_america_johana_gifts_rsvp_copy',
				'20260815_america_johana_ceremony_coordinates',
			]),
		);
		expect(
			ACTIVE_MANUAL_PATCH_CATALOG.every(
				(item) => item.targetEnvironments.join(',') === 'production',
			),
		).toBe(true);
		expect(ACTIVE_MANUAL_PATCH_CATALOG.length).toBeLessThanOrEqual(MAX_ACTIVE_MANUAL_PATCHES);
		expect(validateManualPatchCatalog()).toEqual({ valid: true, errors: [] });
	});

	it('rejects a catalog that exceeds the status schema maximum', () => {
		const overflow = Array.from({ length: MAX_ACTIVE_MANUAL_PATCHES + 1 }, (_, index) => ({
			scriptId: `overflow-${index}`,
			file: `${MANUAL_PATCH_DIRECTORY}/overflow-${index}.sql`,
			purpose: 'overflow',
			targetEnvironments: ['production'] as const,
			expectedRowsMin: 0,
			expectedRowsMax: 0,
		}));
		expect(validateManualPatchCatalog(overflow).errors).toContain('CATALOG_OVERFLOW');
	});

	it.each([
		[{ status: 0, stdout: '0\n' }, 'NOT_NEEDED', 'LIVE_ZERO_ROWS'],
		[{ status: 0, stdout: '4\n' }, 'PENDING', 'LIVE_ROWS_WITHIN_RANGE'],
		[{ status: 0, stdout: '9\n' }, 'BLOCKED', 'LIVE_ROWS_OUTSIDE_RANGE'],
		[{ status: 1, stdout: '', stderr: 'connection refused' }, 'UNVERIFIED', 'QUERY_FAILED'],
		[{ status: 1, stdout: '', stderr: 'STATUS_PROBE_TIMEOUT' }, 'UNVERIFIED', 'QUERY_TIMEOUT'],
		[{ status: 0, stdout: '4\n5\n' }, 'UNVERIFIED', 'QUERY_INVALID_OUTPUT'],
	] as const)('classifies %s safely', (result, status, reason) => {
		const classified = classifyPatchPreviewResult({ result, min: 4, max: 8 });
		expect(classified.status).toBe(status);
		expect(classified.reason).toBe(reason);
		expect(classified.planCommand).toBe(
			status === 'PENDING' ? 'pnpm prod:apply -- --patch <file>' : null,
		);
	});

	it('isolates an invalid catalog entry as BLOCKED without probing', async () => {
		const psql = jest.fn();
		const statuses = await readManualPatchStatuses({
			catalog: [
				{
					scriptId: 'invalid-entry',
					file: 'scripts/manual/production-patches/not-approved.sql',
					purpose: 'invalid',
					targetEnvironments: ['production'],
					expectedRowsMin: 1,
					expectedRowsMax: 2,
				},
			],
			session: { psql } as never,
		});
		expect(statuses[0]?.environments.production.status).toBe('BLOCKED');
		expect(statuses[0]?.environments.production.reason).toBe('CATALOG_INVALID');
		expect(psql).not.toHaveBeenCalled();
	});

	it('classifies matching published/draft identities as PENDING', () => {
		const stdout = JSON.stringify([
			{ store: 'published', key: '["alpha"]' },
			{ store: 'published', key: '["beta"]' },
			{ store: 'draft', key: '["alpha"]' },
			{ store: 'draft', key: '["beta"]' },
		]);
		const classified = classifyPatchPreviewResult({
			result: { status: 0, stdout },
			manifest: PAIRED_MANIFEST,
			min: 4,
			max: 8,
		});
		expect(classified).toMatchObject({
			status: 'PENDING',
			reason: 'LIVE_ROWS_WITHIN_RANGE',
			matchingRowCount: 4,
		});
	});

	it('preserves exact paired rows and selected version metadata', () => {
		const stdout = JSON.stringify([
			{
				store: 'published',
				key: '["abril-michelle-becerra-rea"]',
				row: { store: 'published', slug: 'abril-michelle-becerra-rea', version: 12 },
			},
			{
				store: 'draft',
				key: '["abril-michelle-becerra-rea"]',
				row: { store: 'draft', slug: 'abril-michelle-becerra-rea', version: null },
			},
		]);
		const classified = classifyPatchPreviewResult({
			result: { status: 0, stdout },
			manifest: PAIRED_MANIFEST,
			min: 2,
			max: 2,
			projectRef: 'ineitkdkyrxqyressllp',
		});
		expect(classified).toMatchObject({
			status: 'PENDING',
			matchingRowCount: 2,
			projectRef: 'ineitkdkyrxqyressllp',
			affectedRows: [
				{ store: 'published', slug: 'abril-michelle-becerra-rea', version: 12 },
				{ store: 'draft', slug: 'abril-michelle-becerra-rea', version: null },
			],
		});
	});

	it('does not block when a draft is absent for a published key', () => {
		const stdout = JSON.stringify([
			{ store: 'published', key: '["alpha"]' },
			{ store: 'published', key: '["beta"]' },
			{ store: 'draft', key: '["alpha"]' },
		]);
		const classified = classifyPatchPreviewResult({
			result: { status: 0, stdout },
			manifest: PAIRED_MANIFEST,
			min: 3,
			max: 8,
		});
		expect(classified).toMatchObject({
			status: 'PENDING',
			reason: 'LIVE_ROWS_WITHIN_RANGE',
			matchingRowCount: 3,
		});
	});

	it('blocks duplicate keys within one store', () => {
		const stdout = JSON.stringify([
			{ store: 'published', key: '["alpha"]' },
			{ store: 'published', key: '["alpha"]' },
			{ store: 'draft', key: '["alpha"]' },
		]);
		const classified = classifyPatchPreviewResult({
			result: { status: 0, stdout },
			manifest: PAIRED_MANIFEST,
			min: 1,
			max: 8,
		});
		expect(classified).toMatchObject({
			status: 'BLOCKED',
			reason: 'LIVE_STORE_DISAGREEMENT',
			matchingRowCount: 3,
			planCommand: null,
		});
	});

	it('fails closed on malformed paired evidence', () => {
		const classified = classifyPatchPreviewResult({
			result: { status: 0, stdout: '[{"store":"published"}]' },
			manifest: PAIRED_MANIFEST,
			min: 4,
			max: 8,
		});
		expect(classified).toMatchObject({
			status: 'UNVERIFIED',
			reason: 'QUERY_INVALID_OUTPUT',
		});
	});
});
