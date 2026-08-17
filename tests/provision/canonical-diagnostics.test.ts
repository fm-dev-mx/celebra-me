import { describe, expect, it } from '@jest/globals';
import { enrichCanonicalDiagnostics } from '../../scripts/provision/canonical-diagnostics.ts';
import { decidePromotionAction } from '../../src/lib/status/decision.ts';
import { CanonicalStatusViewSchema } from '../../src/lib/status/schema.ts';
import { buildCanonicalStatusViewFixture } from '../helpers/canonical-status-fixture.ts';
import type { InvitationDefinition } from '../../scripts/provision/invitations/invitation-definition.ts';

describe('enrichCanonicalDiagnostics', () => {
	it('does not change canonical promotion, schema, or readiness decisions', () => {
		const view = buildCanonicalStatusViewFixture();
		const promotions = structuredClone(view.promotions);
		const environments = structuredClone(view.environments);
		const before = decidePromotionAction({
			canonicalAvailable: true,
			local: 'match',
			preview: 'match',
			production: 'behind',
		});

		const diagnostics = enrichCanonicalDiagnostics({
			view,
			definitions: [],
			rowsByEnv: { local: [], preview: [], production: [] },
			includeSemanticDetail: true,
		});

		expect(view.promotions).toEqual(promotions);
		expect(view.environments).toEqual(environments);
		expect(
			decidePromotionAction({
				canonicalAvailable: true,
				local: 'match',
				preview: 'match',
				production: 'behind',
			}),
		).toEqual(before);
		expect(diagnostics.every((item) => !('action' in item) && !('nextStep' in item))).toBe(
			true,
		);
	});

	it('rejects diagnostic payloads that carry action authority', () => {
		const view = buildCanonicalStatusViewFixture({
			diagnostics: [
				{
					code: 'MANAGED_DRIFT',
					domain: 'content',
					evidence: 'LIVE',
					cause: 'Semantic drift.',
					affectedFieldCount: 1,
					affectedSectionCount: 1,
					semanticPaths: ['hero.title'],
				},
			],
		});
		expect(() => CanonicalStatusViewSchema.parse(view)).not.toThrow();
		const promotion = view.promotions[0];
		if (!promotion) throw new Error('expected fixture promotion');
		const legacyRow: Record<string, unknown> = { ...promotion };
		delete legacyRow.lifecycle;
		delete legacyRow.preflightBlockCode;
		delete legacyRow.preflightReason;
		expect(
			CanonicalStatusViewSchema.parse({
				...view,
				promotions: [legacyRow],
			}).promotions[0],
		).toMatchObject({
			lifecycle: 'published',
			preflightBlockCode: null,
			preflightReason: null,
		});
		expect(() =>
			CanonicalStatusViewSchema.parse({
				...view,
				diagnostics: [
					{
						...view.diagnostics[0],
						action: 'PROMOTE_PREVIEW',
					},
				],
			}),
		).toThrow();
	});

	it('emits UNREFERENCED_MANAGED_ASSET diagnostic when live assets contain unreferenced managed keys', () => {
		const view = buildCanonicalStatusViewFixture();
		const definition = {
			slug: 'demo-slug',
			title: 'Demo',
			lifecycle: 'published' as const,
			assets: [{ key: 'hero' }],
			deliveryScope: 'content-and-assets' as const,
		};
		const liveRow = {
			slug: 'demo-slug',
			eventType: 'boda',
			kind: 'client',
			baseDemoId: 'demo',
			themeId: 'theme',
			snapshot: null,
			managedIdentityId: 'id',
			definitionSlug: 'demo-slug',
			clientName: 'Demo',
			draftContent: null,
			publishedContent: { hero: { type: 'uploaded' } },
			publishedVersion: 1,
			assets: [
				{
					id: '1',
					managedSourceKey: 'hero',
					managedSha256: 'a'.repeat(64),
					sha256: 'a'.repeat(64),
					displayName: 'hero',
					mimeType: 'image/jpeg',
					width: null,
					height: null,
					fileSize: null,
				},
				{
					id: '2',
					managedSourceKey: 'zombie-asset-02',
					managedSha256: 'b'.repeat(64),
					sha256: 'b'.repeat(64),
					displayName: 'zombie-asset-02',
					mimeType: 'image/jpeg',
					width: null,
					height: null,
					fileSize: null,
				},
			],
			packageHash: null,
			releaseSchemaVersion: null,
			hasManagedProjection: false,
			appliedDraftUpdatedAt: null,
			appliedOperationId: null,
			appliedPublishedVersion: null,
			appliedPublishedProjectionHash: null,
			appliedReceipt: null,
			latestReceipt: null,
			managedProjection: null,
			detailBudgetExceeded: false,
		};

		const diagnostics = enrichCanonicalDiagnostics({
			view,
			definitions: [definition as unknown as InvitationDefinition],
			rowsByEnv: { local: [liveRow], preview: [], production: [] },
			includeSemanticDetail: true,
		});

		const unreferenced = diagnostics.find((d) => d.code === 'UNREFERENCED_MANAGED_ASSET');
		expect(unreferenced).toBeDefined();
		expect(unreferenced?.slug).toBe('demo-slug');
		expect(unreferenced?.environment).toBe('local');
		expect(unreferenced?.semanticPaths).toEqual(['zombie-asset-02']);
	});

	it('emits both REQUIRED_PUBLISHED_ASSET_MISSING and UNREFERENCED_MANAGED_ASSET simultaneously', () => {
		const view = buildCanonicalStatusViewFixture();
		const definition = {
			slug: 'demo-slug',
			title: 'Demo',
			lifecycle: 'published' as const,
			assets: [{ key: 'hero' }, { key: 'gallery' }],
			deliveryScope: 'content-and-assets' as const,
		};
		const liveRow = {
			slug: 'demo-slug',
			eventType: 'boda',
			kind: 'client',
			baseDemoId: 'demo',
			themeId: 'theme',
			snapshot: null,
			managedIdentityId: 'id',
			definitionSlug: 'demo-slug',
			clientName: 'Demo',
			draftContent: null,
			publishedContent: { hero: { type: 'uploaded' } },
			publishedVersion: 1,
			assets: [
				{
					id: '1',
					managedSourceKey: 'hero',
					managedSha256: 'a'.repeat(64),
					sha256: 'a'.repeat(64),
					displayName: 'hero',
					mimeType: 'image/jpeg',
					width: null,
					height: null,
					fileSize: null,
				},
				{
					id: '2',
					managedSourceKey: 'zombie-asset',
					managedSha256: 'b'.repeat(64),
					sha256: 'b'.repeat(64),
					displayName: 'zombie-asset',
					mimeType: 'image/jpeg',
					width: null,
					height: null,
					fileSize: null,
				},
			],
			packageHash: null,
			releaseSchemaVersion: null,
			hasManagedProjection: false,
			appliedDraftUpdatedAt: null,
			appliedOperationId: null,
			appliedPublishedVersion: null,
			appliedPublishedProjectionHash: null,
			appliedReceipt: null,
			latestReceipt: null,
			managedProjection: null,
			detailBudgetExceeded: false,
		};

		const diagnostics = enrichCanonicalDiagnostics({
			view,
			definitions: [definition as unknown as InvitationDefinition],
			rowsByEnv: { local: [liveRow], preview: [], production: [] },
			includeSemanticDetail: true,
		});

		const missing = diagnostics.find((d) => d.code === 'REQUIRED_PUBLISHED_ASSET_MISSING');
		const unreferenced = diagnostics.find((d) => d.code === 'UNREFERENCED_MANAGED_ASSET');
		expect(missing).toBeDefined();
		expect(unreferenced).toBeDefined();
		expect(unreferenced?.semanticPaths).toEqual(['zombie-asset']);
	});

	it('emits ASSET_IDENTITY_UNVERIFIED when live assets contain unkeyed items and missing keys', () => {
		const view = buildCanonicalStatusViewFixture();
		const definition = {
			slug: 'demo-slug',
			title: 'Demo',
			lifecycle: 'published' as const,
			assets: [{ key: 'hero' }],
			deliveryScope: 'content-and-assets' as const,
		};
		const liveRow = {
			slug: 'demo-slug',
			eventType: 'boda',
			kind: 'client',
			baseDemoId: 'demo',
			themeId: 'theme',
			snapshot: null,
			managedIdentityId: 'id',
			definitionSlug: 'demo-slug',
			clientName: 'Demo',
			draftContent: null,
			publishedContent: { hero: { type: 'uploaded' } },
			publishedVersion: 1,
			assets: [
				{
					id: '1',
					managedSourceKey: null,
					managedSha256: null,
					sha256: 'a'.repeat(64),
					displayName: 'unkeyed-hero',
					mimeType: 'image/jpeg',
					width: null,
					height: null,
					fileSize: null,
				},
			],
			packageHash: null,
			releaseSchemaVersion: null,
			hasManagedProjection: false,
			appliedDraftUpdatedAt: null,
			appliedOperationId: null,
			appliedPublishedVersion: null,
			appliedPublishedProjectionHash: null,
			appliedReceipt: null,
			latestReceipt: null,
			managedProjection: null,
			detailBudgetExceeded: false,
		};

		const diagnostics = enrichCanonicalDiagnostics({
			view,
			definitions: [definition as unknown as InvitationDefinition],
			rowsByEnv: { local: [liveRow], preview: [], production: [] },
			includeSemanticDetail: true,
		});

		const unverified = diagnostics.find((d) => d.code === 'ASSET_IDENTITY_UNVERIFIED');
		expect(unverified).toBeDefined();
	});
});
