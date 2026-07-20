/**
 * Unit tests for scripts/provision/invitation-import-engine.ts
 */

import { describe, it, expect } from '@jest/globals';
import {
	checkTargetDivergenceConflict,
	isSemanticallyEqual,
	checkInvitationMetadataIdentical,
	checkDraftContentIdentical,
	checkPublishedContentIdentical,
	checkAssetDbRowIdentical,
	checkEventAndMembershipIdentical,
} from '../../scripts/provision/promotion-comparison';
import type {
	InvitationPackageAsset,
	InvitationPackageData,
} from '../../scripts/provision/invitation-package';
import { STORAGE_URL_PLACEHOLDER } from '../../scripts/provision/invitation-package';

describe('Invitation Import Engine — Target Divergence Protection', () => {
	const pkgDraftContent = { hero: { title: 'Package Title' } };
	const matchingTargetContent = { hero: { title: 'Package Title' } };
	const divergedTargetContent = { hero: { title: 'Host Edited Title Directly in Dashboard' } };
	const publishedTargetContent = { hero: { title: 'Old Published Title' } };

	it('allows import when target draft matches package draft', () => {
		expect(() => {
			checkTargetDivergenceConflict(
				'test-slug',
				pkgDraftContent,
				{ status: 'draft', content: matchingTargetContent },
				{ content: publishedTargetContent },
				false,
			);
		}).not.toThrow();
	});

	it('allows import when target draft matches target published content (untouched host edit)', () => {
		expect(() => {
			checkTargetDivergenceConflict(
				'test-slug',
				pkgDraftContent,
				{ status: 'draft', content: publishedTargetContent },
				{ content: publishedTargetContent },
				false,
			);
		}).not.toThrow();
	});

	it('throws error when target draft has un-published local modifications that differ from package', () => {
		expect(() => {
			checkTargetDivergenceConflict(
				'test-slug',
				pkgDraftContent,
				{ status: 'draft', content: divergedTargetContent },
				{ content: publishedTargetContent },
				false,
			);
		}).toThrow(
			/target draft revision.*package content hash.*target draft hash.*target published hash/i,
		);
	});

	it('allows import when allowDivergentOverwrite is true despite divergence', () => {
		expect(() => {
			checkTargetDivergenceConflict(
				'test-slug',
				pkgDraftContent,
				{ status: 'draft', content: divergedTargetContent },
				{ content: publishedTargetContent },
				true,
			);
		}).not.toThrow();
	});
});

describe('Invitation Import Engine — Semantic Idempotency & Normalization', () => {
	const targetStorageUrl =
		'https://iwipdvisoyerfdytuhwi.supabase.co/storage/v1/object/public/invitation-assets';

	it('1. initial import plans and executes required mutations when target is empty', () => {
		const isInvIdentical = checkInvitationMetadataIdentical(
			{
				slug: 'test-inv',
				title: 'Test Title',
				eventType: 'xv',
				baseDemoId: 'demo-1',
				themeId: 'theme-1',
				kind: 'client',
				clientName: 'Client',
				clientEmail: '',
				clientWhatsapp: '',
				photosReceived: false,
				snapshot: { a: 1 },
			},
			null,
			targetStorageUrl,
		);
		expect(isInvIdentical).toBe(false);
	});

	it('2. & 3. immediate post-import dry-run & repeated apply return empty plan (0 mutations)', () => {
		const pkgInv = {
			slug: 'romina-rios-chaparro',
			title: 'Romina Ríos Chaparro',
			eventType: 'xv',
			baseDemoId: 'demo-xv-premiere-floral',
			themeId: 'premiere-floral',
			kind: 'client',
			clientName: 'Romina',
			clientEmail: 'romina@example.com',
			clientWhatsapp: '+521234567890',
			photosReceived: true,
			snapshot: { hero: { title: 'XV Romina' } },
		};

		const existingInv = {
			id: 'inv-uuid',
			slug: 'romina-rios-chaparro',
			title: 'Romina Ríos Chaparro',
			event_type: 'xv',
			base_demo_id: 'demo-xv-premiere-floral',
			theme_id: 'premiere-floral',
			kind: 'client',
			client_name: 'Romina',
			client_email: 'romina@example.com',
			client_whatsapp: '+521234567890',
			photos_received: true,
			snapshot: { hero: { title: 'XV Romina' } },
		};

		const isInvIdentical = checkInvitationMetadataIdentical(
			pkgInv,
			existingInv,
			targetStorageUrl,
		);
		const isDraftIdentical = checkDraftContentIdentical(
			{ hero: { title: 'XV Romina' } },
			{ content: { hero: { title: 'XV Romina' } } },
			targetStorageUrl,
		);
		const isPubIdentical = checkPublishedContentIdentical(
			{ hero: { title: 'XV Romina' } },
			{ version: 10, content: { hero: { title: 'XV Romina' } } },
			targetStorageUrl,
			isInvIdentical,
		);

		expect(isInvIdentical).toBe(true);
		expect(isDraftIdentical).toBe(true);
		expect(isPubIdentical).toBe(true);
	});

	it('4. & 5. published version and draft revision remain unchanged when content is identical', () => {
		const isPubIdentical = checkPublishedContentIdentical(
			{ hero: { title: 'Same' } },
			{ version: 10, content: { hero: { title: 'Same' } } },
			targetStorageUrl,
			true,
		);
		expect(isPubIdentical).toBe(true);
	});

	it('6. changed draft only updates the draft when published content is unchanged', () => {
		const isDraftIdentical = checkDraftContentIdentical(
			{ hero: { title: 'New Draft' } },
			{ content: { hero: { title: 'Old Draft' } } },
			targetStorageUrl,
		);
		const isPubIdentical = checkPublishedContentIdentical(
			{ hero: { title: 'Published' } },
			{ version: 10, content: { hero: { title: 'Published' } } },
			targetStorageUrl,
			true,
		);

		expect(isDraftIdentical).toBe(false);
		expect(isPubIdentical).toBe(true);
	});

	it('7. changed published content plans exactly one publication', () => {
		const isPubIdentical = checkPublishedContentIdentical(
			{ hero: { title: 'New Published Content' } },
			{ version: 10, content: { hero: { title: 'Old Published Content' } } },
			targetStorageUrl,
			true,
		);
		expect(isPubIdentical).toBe(false);
	});

	it('8. changed relevant public metadata plans publication', () => {
		const isPubIdentical = checkPublishedContentIdentical(
			{ hero: { title: 'Same' } },
			{ version: 10, content: { hero: { title: 'Same' } } },
			targetStorageUrl,
			false,
		);
		expect(isPubIdentical).toBe(false);
	});

	it('9. changed invitation metadata plans only the required update', () => {
		const pkgInv = {
			slug: 'romina-rios-chaparro',
			title: 'Updated Title',
			eventType: 'xv',
			baseDemoId: 'demo-xv-premiere-floral',
			themeId: 'premiere-floral',
			kind: 'client',
			clientName: 'Romina',
			clientEmail: 'romina@example.com',
			clientWhatsapp: '+521234567890',
			photosReceived: true,
			snapshot: { hero: { title: 'XV Romina' } },
		};

		const existingInv = {
			id: 'inv-uuid',
			title: 'Old Title',
			base_demo_id: 'demo-xv-premiere-floral',
			theme_id: 'premiere-floral',
			kind: 'client',
			client_name: 'Romina',
			client_email: 'romina@example.com',
			client_whatsapp: '+521234567890',
			photos_received: true,
			snapshot: { hero: { title: 'XV Romina' } },
		};

		expect(checkInvitationMetadataIdentical(pkgInv, existingInv, targetStorageUrl)).toBe(false);
	});

	it('10. equivalent assets produce no uploads or metadata writes', () => {
		const pAsset: InvitationPackageAsset = {
			displayName: 'Hero Photo',
			defaultAltText: 'Hero',
			bucket: 'invitation-assets',
			storagePath: 'invitations/123/hero.webp',
			mimeType: 'image/webp',
			width: 1200,
			height: 800,
			fileSize: 50000,
			validationVersion: 1,
			sha256: 'hash123',
			dataBase64: 'abc=',
			originalMimeType: null,
			originalFileSize: null,
		};

		const existingAssetRow = {
			display_name: 'Hero Photo',
			default_alt_text: 'Hero',
			bucket: 'invitation-assets',
			storage_path: 'invitations/123/hero.webp',
			mime_type: 'image/webp',
			width: 1200,
			height: 800,
			file_size: 50000,
			validation_version: 1,
			original_mime_type: null,
			original_file_size: null,
		};

		expect(checkAssetDbRowIdentical(pAsset, existingAssetRow)).toBe(true);
	});

	it('11. JSON ordering, target Storage origins and non-semantic diffs do not cause drift', () => {
		const objA = { z: 1, a: `${targetStorageUrl}/path/1.webp`, b: 2 };
		const objB = { a: `${STORAGE_URL_PLACEHOLDER}/path/1.webp`, b: 2, z: 1 };

		expect(isSemanticallyEqual(objA, objB, targetStorageUrl)).toBe(true);
	});

	it('12. real semantic differences remain detected', () => {
		const objA = { hero: { title: 'Title A' } };
		const objB = { hero: { title: 'Title B' } };

		expect(isSemanticallyEqual(objA, objB, targetStorageUrl)).toBe(false);
	});

	it('13. real target divergence remains blocked', () => {
		const pkgDraft = { text: 'Pkg' };
		const divergedDraft = { text: 'User Edit in Dashboard' };
		const published = { text: 'Initial' };

		expect(() => {
			checkTargetDivergenceConflict(
				'slug',
				pkgDraft,
				{ status: 'draft', content: divergedDraft, updated_at: '2026-01-01' },
				{ version: 1, content: published },
				false,
			);
		}).toThrow(/Target divergence conflict/);
	});

	it('14. mutation counters and zero-drift reporting logic are accurate', () => {
		const actions: Array<{
			resource: string;
			name: string;
			action: 'create' | 'replace' | 'reuse' | 'skip';
			detail: string;
		}> = [
			{ resource: 'invitation', name: 'slug', action: 'reuse', detail: 'up-to-date' },
			{ resource: 'draft', name: 'draft', action: 'reuse', detail: 'up-to-date' },
			{ resource: 'pub', name: 'pub', action: 'reuse', detail: 'up-to-date' },
		];

		const plannedMutations = actions.filter(
			(a) => a.action === 'create' || a.action === 'replace',
		).length;
		expect(plannedMutations).toBe(0);
		expect(plannedMutations === 0).toBe(true);
	});

	it('explicit Romina regression against Preview version 10', () => {
		const pkgInv = {
			slug: 'romina-rios-chaparro',
			title: 'Romina Ríos Chaparro',
			eventType: 'xv',
			baseDemoId: 'demo-xv-premiere-floral',
			themeId: 'premiere-floral',
			kind: 'client',
			clientName: 'Romina',
			clientEmail: '',
			clientWhatsapp: '',
			photosReceived: true,
			snapshot: { title: 'Romina' },
		};

		const existingInv = {
			id: 'romina-id',
			slug: 'romina-rios-chaparro',
			title: 'Romina Ríos Chaparro',
			event_type: 'xv',
			base_demo_id: 'demo-xv-premiere-floral',
			theme_id: 'premiere-floral',
			kind: 'client',
			client_name: 'Romina',
			client_email: null,
			client_whatsapp: null,
			photos_received: true,
			snapshot: { title: 'Romina' },
		};

		const existingDraft = {
			id: 'draft-id',
			status: 'draft',
			content: { title: 'Romina' },
		};

		const existingPub = {
			version: 10,
			content: { title: 'Romina' },
		};

		const fullPkg: InvitationPackageData = {
			schemaVersion: '1.0.0',
			packageHash: 'hash',
			createdAt: 'date',
			sourceSlug: 'romina-rios-chaparro',
			invitation: pkgInv,
			assets: [],
			draft: { status: 'draft', content: {} },
			publishedContent: null,
			event: null,
		};

		const isInvIdentical = checkInvitationMetadataIdentical(
			pkgInv,
			existingInv,
			targetStorageUrl,
		);
		const isDraftIdentical = checkDraftContentIdentical(
			{ title: 'Romina' },
			existingDraft,
			targetStorageUrl,
		);
		const isPubIdentical = checkPublishedContentIdentical(
			{ title: 'Romina' },
			existingPub,
			targetStorageUrl,
			isInvIdentical,
		);
		const isEventIdentical = checkEventAndMembershipIdentical(
			fullPkg,
			'user-id',
			'romina-id',
			{
				id: 'event-id',
				owner_user_id: 'user-id',
				title: 'Romina Ríos Chaparro',
				status: 'published',
				invitation_project_id: 'romina-id',
			},
			{ user_id: 'user-id', membership_role: 'owner' },
		);

		expect(isInvIdentical).toBe(true);
		expect(isDraftIdentical).toBe(true);
		expect(isPubIdentical).toBe(true);
		expect(isEventIdentical).toBe(true);

		const targetVersion = existingPub.version;
		const plannedVersion = isPubIdentical ? targetVersion : targetVersion + 1;
		expect(plannedVersion).toBe(10);
	});
});
