import { describe, expect, it } from '@jest/globals';

import {
	exportInvitationPackage,
	type InvitationPackageData,
} from '../../scripts/provision/invitation-package.ts';
import {
	assertLegacyBaselineApplyBlocked,
	buildLegacyBaselineAdoptionEntry,
	computeLegacyBaselineManifestFingerprint,
	createLegacyBaselineAdoptionManifest,
	dryRunLegacyBaselineAdoption,
	type LegacyAdoptionRawEnvironmentCandidate,
} from '../../scripts/provision/legacy-baseline-adoption.ts';

function replaceAssetReferences(value: unknown, ids: ReadonlyMap<string, string>): unknown {
	if (Array.isArray(value)) return value.map((item) => replaceAssetReferences(item, ids));
	if (!value || typeof value !== 'object') return value;
	const record = value as Record<string, unknown>;
	if (record.type === 'uploaded' && typeof record.assetId === 'string') {
		const key = record.assetId.replace('__INVITATION_ASSET_KEY__:', '');
		return { type: 'uploaded', assetId: ids.get(key), src: `https://invalid.example/${key}` };
	}
	return Object.fromEntries(
		Object.entries(record).map(([key, item]) => [key, replaceAssetReferences(item, ids)]),
	);
}

function candidate(
	pkg: InvitationPackageData,
	suffix: string,
): LegacyAdoptionRawEnvironmentCandidate {
	const ids = new Map(
		pkg.assets.map((asset, index) => [
			asset.key,
			`00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
		]),
	);
	const content = replaceAssetReferences(pkg.publishedContent.content, ids);
	const owner = '11111111-1111-4111-8111-111111111111';
	return {
		environment: suffix as LegacyAdoptionRawEnvironmentCandidate['environment'],
		invitation: {
			slug: pkg.invitation.slug,
			eventType: pkg.invitation.eventType,
			kind: 'client',
			baseDemoId: pkg.invitation.baseDemoId,
			themeId: pkg.invitation.themeId,
			snapshot: pkg.invitation.snapshot,
			createdBy: owner,
		},
		draft: { content, status: 'published', updatedAt: '2026-08-01T00:00:00.000Z' },
		published: {
			content,
			version: 1,
			isDemo: false,
			slug: pkg.invitation.slug,
			eventType: pkg.invitation.eventType,
		},
		event: {
			slug: pkg.invitation.slug,
			eventType: pkg.invitation.eventType,
			ownerUserId: owner,
		},
		assets: pkg.assets.map((asset) => ({
			id: ids.get(asset.key)!,
			displayName: asset.displayName,
			mimeType: asset.mimeType,
			width: asset.width,
			height: asset.height,
			fileSize: asset.fileSize,
			sha256: asset.sha256,
		})),
	};
}

async function packageFor(slug: string): Promise<InvitationPackageData> {
	return (
		await exportInvitationPackage({
			slug,
			sourceDir: `src/assets/invitations/${slug}`,
			dryRun: true,
		})
	).packageData;
}

describe('legacy baseline administrative adoption manifest', () => {
	it('builds one stable Production candidate checkpoint without transport identifiers', async () => {
		const pkg = await packageFor('abril-michelle-becerra-rea');
		const environments = {
			local: candidate(pkg, 'local'),
			preview: candidate(pkg, 'preview'),
			production: candidate(pkg, 'production'),
		};
		const first = createLegacyBaselineAdoptionManifest({
			packages: [pkg],
			candidates: [environments],
			generatedAt: '2026-08-01T00:00:00.000Z',
		});
		const second = createLegacyBaselineAdoptionManifest({
			packages: [pkg],
			candidates: [environments],
			generatedAt: '2026-08-01T00:01:00.000Z',
		});

		expect(first.entries[0]?.status).toBe('ELIGIBLE');
		expect(first.entries[0]?.comparisons).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ against: 'canonical', outcome: 'ALIGNED' }),
				expect.objectContaining({ against: 'local', outcome: 'ALIGNED' }),
				expect.objectContaining({ against: 'preview', outcome: 'ALIGNED' }),
			]),
		);
		expect(first.manifestFingerprint).toBe(second.manifestFingerprint);
		expect(computeLegacyBaselineManifestFingerprint(first)).toBe(first.manifestFingerprint);
		expect(first.entries[0]?.stableAssetIdentities).toEqual(
			expect.arrayContaining([expect.objectContaining({ semanticKey: expect.any(String) })]),
		);
		expect(JSON.stringify(first)).not.toContain('00000000-0000-4000-8000');
		expect(JSON.stringify(first)).not.toContain('invalid.example');
	});

	it('fails an incomplete candidate without preventing a separate eligible entry', async () => {
		const [abril, romina] = await Promise.all([
			packageFor('abril-michelle-becerra-rea'),
			packageFor('romina-rios-chaparro'),
		]);
		const broken = candidate(abril, 'production');
		broken.assets.pop();
		const manifest = createLegacyBaselineAdoptionManifest({
			packages: [abril, romina],
			candidates: [
				{
					local: candidate(abril, 'local'),
					preview: candidate(abril, 'preview'),
					production: broken,
				},
				{
					local: candidate(romina, 'local'),
					preview: candidate(romina, 'preview'),
					production: candidate(romina, 'production'),
				},
			],
		});
		const dryRun = dryRunLegacyBaselineAdoption({ manifest, refreshed: manifest });

		expect(dryRun.map((entry) => [entry.slug, entry.status, entry.writes])).toEqual(
			expect.arrayContaining([
				['abril-michelle-becerra-rea', 'BLOCKED', 0],
				['romina-rios-chaparro', 'ELIGIBLE', 0],
			]),
		);
		expect(
			dryRun.find((entry) => entry.slug === 'romina-rios-chaparro')?.metadataChanges,
		).toEqual([
			'shared_managed_baseline',
			'semantic_asset_identity',
			'adoption_provenance_receipt',
		]);
	});

	it('keeps ambiguous semantic asset evidence unverified without using URLs or database IDs', async () => {
		const pkg = await packageFor('abril-michelle-becerra-rea');
		const production = candidate(pkg, 'production');
		production.assets[1] = {
			...production.assets[0]!,
			id: '00000000-0000-4000-8000-999999999999',
		};
		const entry = buildLegacyBaselineAdoptionEntry({
			pkg,
			candidates: { production },
		});

		expect(entry.status).toBe('BLOCKED');
		expect(entry.unresolvedAmbiguity).toEqual(['ASSET_IDENTITY_AMBIGUOUS']);
		expect(JSON.stringify(entry)).not.toContain('99999999');
	});

	it('invalidates a generated manifest after a relevant candidate change and never enables apply', async () => {
		const pkg = await packageFor('abril-michelle-becerra-rea');
		const inputs = {
			local: candidate(pkg, 'local'),
			preview: candidate(pkg, 'preview'),
			production: candidate(pkg, 'production'),
		};
		const manifest = createLegacyBaselineAdoptionManifest({
			packages: [pkg],
			candidates: [inputs],
		});
		const changed = candidate(pkg, 'production');
		changed.published.content = {
			...(changed.published.content as Record<string, unknown>),
			legacyAdded: true,
		};
		const refreshed = createLegacyBaselineAdoptionManifest({
			packages: [pkg],
			candidates: [{ ...inputs, production: changed }],
		});
		const [result] = dryRunLegacyBaselineAdoption({ manifest, refreshed });

		expect(result?.sourceChangedAfterGeneration).toBe(true);
		expect(result?.blockingReason).toBe('STALE_MANIFEST');
		expect(result?.writes).toBe(0);
		expect(() =>
			assertLegacyBaselineApplyBlocked({
				manifest,
				providedFingerprint: manifest.manifestFingerprint,
			}),
		).toThrow('APPLY_DISABLED');
	});

	it('rejects incompatible normalization before a candidate can be adopted', async () => {
		const pkg = await packageFor('abril-michelle-becerra-rea');
		const entry = buildLegacyBaselineAdoptionEntry({
			pkg: { ...pkg, schemaVersion: '1.0.0' },
			candidates: {},
		});
		expect(entry.unresolvedAmbiguity).toEqual(['NORMALIZATION_VERSION_UNSUPPORTED']);
	});
});
