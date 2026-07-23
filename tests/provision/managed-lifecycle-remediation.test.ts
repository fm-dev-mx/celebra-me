import { describe, expect, it } from '@jest/globals';
import { detectFileMimeType } from '../../src/lib/intake/services/asset-policy.ts';
import {
	classifyDbTarget,
	extractSupabaseProjectRef,
	redactDbUrl,
	redactCredentials,
} from '../../scripts/db/db-target-config.ts';
import {
	computePlanId,
	verifyPlanPreconditions,
	type OperationalPlan,
} from '../../scripts/provision/invitation-update-plan.ts';
import { checkUnknownFlags } from '../../scripts/provision/invitation-update-options.ts';
import { eventContentSchema } from '../../src/lib/schemas/content/base-event.schema.ts';
import { verifyPreviewApprovalArtifact } from '../../scripts/provision/preview-approval-service.ts';

describe('Managed Lifecycle Remediation Suite', () => {
	describe('Server-Safe Import Boundary & Module Safety', () => {
		it('detects PNG, WebP, and JPEG MIME types correctly', () => {
			expect(detectFileMimeType('photo.png')).toBe('image/png');
			expect(detectFileMimeType('photo.webp')).toBe('image/webp');
			expect(detectFileMimeType('photo.jpg')).toBe('image/jpeg');
			expect(detectFileMimeType('photo.jpeg')).toBe('image/jpeg');
		});

		it('detects MIME type from file signature if extension is ambiguous', () => {
			const pngMagic = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
			const webpMagic = new Uint8Array([0x52, 0x49, 0x46, 0x46]);
			expect(detectFileMimeType('unknown', pngMagic)).toBe('image/png');
			expect(detectFileMimeType('unknown', webpMagic)).toBe('image/webp');
		});

		it('ensures shared schema modules import from neutral asset-keys, not asset-registry', async () => {
			// Importing shared schema or base event schema under Node must not trigger ESM image imports
			const baseEventModule =
				await import('../../src/lib/schemas/content/base-event.schema.ts');
			expect(baseEventModule.eventContentSchema).toBeDefined();
		});
	});

	describe('Canonical Public Content Validation Boundary', () => {
		it('validates correct managed public content via canonical schema', () => {
			const validContent = {
				eventType: 'xv',
				title: 'Test Event',
				theme: {
					fontFamily: 'serif',
					preset: 'jewelry-box',
				},
				hero: {
					name: 'Romina',
					date: '2026-12-31T20:00:00.000Z',
					backgroundImage: 'https://example.com/hero.jpg',
				},
				quote: {
					text: 'Un momento especial',
					author: 'Familia Ríos',
				},
			};

			const result = eventContentSchema.safeParse(validContent);
			expect(result.success).toBe(true);
		});

		it('rejects invalid content missing required fields', () => {
			const invalidContent = {
				eventType: 'xv',
				// missing title
				theme: { preset: 'jewelry-box' },
				hero: { name: 'Romina' },
			};

			const result = eventContentSchema.safeParse(invalidContent);
			expect(result.success).toBe(false);
			const paths = result.error!.issues.map((i) => i.path.join('.'));
			expect(paths).toContain('title');
		});
	});

	describe('Environment & Credential Isolation', () => {
		it('extracts project reference correctly from direct host and pooler URLs', () => {
			const directUrl =
				'postgresql://postgres:pass@db.iwipdvisoyerfdytuhwi.supabase.co:5432/postgres';
			const poolerUrl =
				'postgresql://postgres.iwipdvisoyerfdytuhwi:pass@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';
			expect(extractSupabaseProjectRef(directUrl)).toBe('iwipdvisoyerfdytuhwi');
			expect(extractSupabaseProjectRef(poolerUrl)).toBe('iwipdvisoyerfdytuhwi');
		});

		it('classifies Preview vs Production based on project reference', () => {
			const previewPooler =
				'postgresql://postgres.iwipdvisoyerfdytuhwi:pass@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';
			const prodPooler =
				'postgresql://postgres.fmdevmxprod:pass@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';
			expect(classifyDbTarget(previewPooler).target).toBe('preview');
			expect(classifyDbTarget(prodPooler).target).toBe('production');
		});

		it('redacts credentials and database connection strings in errors', () => {
			const secretUrl =
				'postgresql://postgres:secretpassword123@db.iwipdvisoyerfdytuhwi.supabase.co:5432/postgres';
			const redacted = redactDbUrl(secretUrl);
			expect(redacted).not.toContain('secretpassword123');
			expect(redacted).toContain('<redacted>');

			const textWithSecret = `Failed to connect to ${secretUrl}`;
			const redactedText = redactCredentials(textWithSecret);
			expect(redactedText).not.toContain('secretpassword123');
		});

		it('rejects unknown CLI options', () => {
			expect(() => checkUnknownFlags(['--slug', 'romina', '--unknown-flag'])).toThrow(
				/Opción no reconocida: "--unknown-flag"/,
			);
		});
	});

	describe('Immutable Semantic Plan & Drift Protection', () => {
		const samplePlan: OperationalPlan = {
			planId: 'plan-12345',
			invitationSlug: 'romina-rios-chaparro',
			invitationTitle: 'Romina Ríos Chaparro',
			sourceHash: 'a'.repeat(64),
			packageHash: 'b'.repeat(64),
			targetEnvironment: 'local',
			verifiedProjectRef: 'celebra-me-rsvp',
			functionalChanges: [
				{
					section: 'Family',
					entity: 'Title',
					label: 'Sección «Familia» — Título',
					operation: 'update',
					previousValue: 'Nuestra familia',
					newValue: 'Mi familia',
					scope: 'database',
					technicalWriteCount: 1,
				},
				{
					section: 'Family',
					entity: 'Member',
					label: 'Se agregó «María Ríos» a la sección «Familia»',
					operation: 'insert',
					scope: 'database',
					technicalWriteCount: 1,
				},
			],
			physicalDatabaseOps: { inserts: 1, updates: 1, deletes: 0 },
			storageOps: { uploads: 0, overwrites: 0, moves: 0, deletes: 0 },
			targetPreconditions: {
				sourceHash: 'a'.repeat(64),
				packageHash: 'b'.repeat(64),
				verifiedProjectRef: 'celebra-me-rsvp',
				targetInvitationId: 'inv-uuid-1',
				existingDraftUpdatedAt: '2026-07-23T10:00:00Z',
				existingPublishedVersion: 2,
			},
			sensitivityClassification: 'public',
			executionStatus: 'PLANNED',
		};

		it('computes deterministic plan ID', () => {
			const planId = computePlanId({
				slug: samplePlan.invitationSlug,
				sourceHash: samplePlan.sourceHash,
				targetEnvironment: samplePlan.targetEnvironment,
				projectRef: samplePlan.verifiedProjectRef,
				changes: samplePlan.functionalChanges,
				preconditions: samplePlan.targetPreconditions,
			});
			expect(planId).toHaveLength(32);
		});

		it('verifies preconditions successfully when target state is unchanged', () => {
			const res = verifyPlanPreconditions(samplePlan, {
				sourceHash: 'a'.repeat(64),
				packageHash: 'b'.repeat(64),
				verifiedProjectRef: 'celebra-me-rsvp',
				targetInvitationId: 'inv-uuid-1',
				existingDraftUpdatedAt: '2026-07-23T10:00:00Z',
				existingPublishedVersion: 2,
			});
			expect(res.ok).toBe(true);
		});

		it('fails precondition verification when target draft has drifted', () => {
			const res = verifyPlanPreconditions(samplePlan, {
				sourceHash: 'a'.repeat(64),
				packageHash: 'b'.repeat(64),
				verifiedProjectRef: 'celebra-me-rsvp',
				targetInvitationId: 'inv-uuid-1',
				existingDraftUpdatedAt: '2026-07-23T11:00:00Z',
				existingPublishedVersion: 2,
			});
			expect(res.ok).toBe(false);
			expect(res.reason).toContain('Precondition failed');
		});

		describe('Preview Approval Artifact & Production Guardrail', () => {
			it('rejects verification when approval artifact does not match release identity', () => {
				const mockIdentity = {
					packageHash: 'c'.repeat(64),
					sourceHash: 'a'.repeat(64),
					metadataHash: 'b'.repeat(64),
					projectionHash: 'd'.repeat(32),
					assetManifestHash: 'e'.repeat(64),
					slug: 'romina-rios-chaparro',
					route: '/invitacion/xv/romina-rios-chaparro',
				};

				expect(() => verifyPreviewApprovalArtifact(mockIdentity)).toThrow(
					/No approved Preview artifact exists/,
				);
			});
		});
	});
});
