import { describe, expect, it, jest } from '@jest/globals';
import {
	planCleanup,
	executeCleanup,
	type TrackedResource,
	type CleanupPlan,
} from '../../scripts/provision/managed-invitation-cleanup.ts';

describe('managed invitation partial-failure cleanup safety', () => {
	it('planCleanup filters out pre-existing resources from removal', () => {
		const resources: TrackedResource[] = [
			{ type: 'invitation', id: 'inv-1', isPreExisting: true },
			{ type: 'event', id: 'evt-1', isPreExisting: true },
			{ type: 'storage_object', id: 'managed/test/hero.webp', isPreExisting: false },
			{ type: 'invitation_asset', id: 'asset-1', isPreExisting: false },
		];

		const { toRemove, toSkip } = planCleanup(resources);
		expect(toRemove).toHaveLength(2);
		expect(toRemove.map((r) => r.id)).toEqual(['managed/test/hero.webp', 'asset-1']);
		expect(toSkip).toHaveLength(2);
		expect(toSkip.map((r) => r.id)).toEqual(['inv-1', 'evt-1']);
	});

	it('handles partial failure after invitation creation (reverts invitation only)', async () => {
		const resources: TrackedResource[] = [
			{ type: 'invitation', id: 'inv-new', isPreExisting: false },
		];

		const deletedIds: string[] = [];
		const deleter = jest.fn(async (res: TrackedResource) => {
			deletedIds.push(res.id);
			return true;
		});

		const result = await executeCleanup({ invitationSlug: 'test-slug', trackedResources: resources }, deleter);

		expect(result.removed).toHaveLength(1);
		expect(deletedIds).toEqual(['inv-new']);
		expect(result.skippedPreExisting).toHaveLength(0);
	});

	it('handles failure after event and membership creation', async () => {
		const resources: TrackedResource[] = [
			{ type: 'invitation', id: 'inv-1', isPreExisting: false },
			{ type: 'event', id: 'evt-1', isPreExisting: false },
			{ type: 'event_membership', id: 'mem-1', isPreExisting: false },
		];

		const deletedIds: string[] = [];
		const deleter = jest.fn(async (res: TrackedResource) => {
			deletedIds.push(res.id);
			return true;
		});

		const result = await executeCleanup({ invitationSlug: 'test-slug', trackedResources: resources }, deleter);

		expect(result.removed).toHaveLength(3);
		// Verified reverse order of deletion (child membership -> event -> invitation container)
		expect(deletedIds).toEqual(['mem-1', 'evt-1', 'inv-1']);
	});

	it('handles failure after new asset row creation and storage upload', async () => {
		const resources: TrackedResource[] = [
			{ type: 'storage_object', id: 'path/hero.webp', isPreExisting: false },
			{ type: 'invitation_asset', id: 'asset-row-1', isPreExisting: false },
		];

		const deletedIds: string[] = [];
		const deleter = jest.fn(async (res: TrackedResource) => {
			deletedIds.push(res.id);
			return true;
		});

		const result = await executeCleanup({ invitationSlug: 'test-slug', trackedResources: resources }, deleter);

		expect(result.removed).toHaveLength(2);
		expect(deletedIds).toEqual(['asset-row-1', 'path/hero.webp']);
	});

	it('preserves all pre-existing resources when existing invitation, event, membership, and assets are reused', async () => {
		const resources: TrackedResource[] = [
			{ type: 'invitation', id: 'inv-exist', isPreExisting: true },
			{ type: 'event', id: 'evt-exist', isPreExisting: true },
			{ type: 'event_membership', id: 'mem-exist', isPreExisting: true },
			{ type: 'invitation_asset', id: 'asset-exist', isPreExisting: true },
			{ type: 'storage_object', id: 'storage-exist', isPreExisting: true },
			{ type: 'invitation_content_draft', id: 'draft-new', isPreExisting: false },
		];

		const deleter = jest.fn(async () => true);

		const result = await executeCleanup({ invitationSlug: 'test-slug', trackedResources: resources }, deleter);

		expect(result.skippedPreExisting).toHaveLength(5);
		expect(result.removed).toHaveLength(1);
		expect(result.removed[0]?.id).toBe('draft-new');
		expect(deleter).toHaveBeenCalledTimes(1);
	});

	it('handles mixed existing and newly created resources correctly', async () => {
		const resources: TrackedResource[] = [
			{ type: 'invitation', id: 'inv-exist', isPreExisting: true },
			{ type: 'event', id: 'evt-exist', isPreExisting: true },
			{ type: 'invitation_asset', id: 'asset-new', isPreExisting: false },
			{ type: 'storage_object', id: 'storage-new', isPreExisting: false },
		];

		const deletedIds: string[] = [];
		const deleter = jest.fn(async (res: TrackedResource) => {
			deletedIds.push(res.id);
			return true;
		});

		const result = await executeCleanup({ invitationSlug: 'test-slug', trackedResources: resources }, deleter);

		expect(result.skippedPreExisting.map((r) => r.id)).toEqual(['inv-exist', 'evt-exist']);
		expect(result.removed.map((r) => r.id)).toEqual(['storage-new', 'asset-new']);
	});

	it('is safe when executed twice (idempotent)', async () => {
		const resources: TrackedResource[] = [
			{ type: 'invitation', id: 'inv-new', isPreExisting: false },
		];

		const deleter = jest.fn(async () => true);
		const plan: CleanupPlan = { invitationSlug: 'test-slug', trackedResources: resources };

		const res1 = await executeCleanup(plan, deleter);
		expect(res1.removed).toHaveLength(1);

		// Second run on already-cleaned resources
		const deleter2 = jest.fn(async () => true);
		const res2 = await executeCleanup({ invitationSlug: 'test-slug', trackedResources: [] }, deleter2);
		expect(res2.removed).toHaveLength(0);
		expect(res2.failures).toHaveLength(0);
	});

	it('captures failures during cleanup itself and requires manual review', async () => {
		const resources: TrackedResource[] = [
			{ type: 'invitation_asset', id: 'asset-fail', isPreExisting: false },
			{ type: 'storage_object', id: 'storage-ok', isPreExisting: false },
		];

		const deleter = jest.fn(async (res: TrackedResource) => {
			if (res.id === 'asset-fail') throw new Error('DB connection drop');
			return true;
		});

		const result = await executeCleanup({ invitationSlug: 'test-slug', trackedResources: resources }, deleter);

		expect(result.removed).toHaveLength(1);
		expect(result.removed[0]?.id).toBe('storage-ok');
		expect(result.failures).toHaveLength(1);
		expect(result.failures[0]?.error).toContain('DB connection drop');
		expect(result.requiresManualReview).toHaveLength(1);
		expect(result.requiresManualReview[0]?.id).toBe('asset-fail');
	});
});
