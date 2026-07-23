import { describe, expect, it } from '@jest/globals';
import {
	classifyTrackedResource,
	executeCleanup,
	type TrackedResource,
} from '../../scripts/provision/managed-invitation-cleanup.ts';

function resource(
	type: TrackedResource['type'],
	id: string,
	overrides: Partial<TrackedResource> = {},
): TrackedResource {
	return { type, id, ...overrides };
}

async function cleanup(resources: TrackedResource[]) {
	return executeCleanup(
		{ invitationSlug: 'fixture', trackedResources: resources },
		async () => true,
	);
}

describe('managed recovery failure injection matrix', () => {
	it('classifies every recovery boundary explicitly', () => {
		expect(classifyTrackedResource(resource('storage_object', 'new'))).toBe(
			'NUEVO — REMOVIBLE',
		);
		expect(
			classifyTrackedResource(
				resource('invitation', 'same', { isPreExisting: true, wasOverwritten: false }),
			),
		).toBe('PREEXISTENTE — SIN CAMBIOS');
		expect(
			classifyTrackedResource(
				resource('invitation', 'restored', {
					isPreExisting: true,
					wasOverwritten: true,
					restored: true,
				}),
			),
		).toBe('PREEXISTENTE — RESTAURADO');
		expect(
			classifyTrackedResource(
				resource('invitation', 'manual', {
					isPreExisting: true,
					wasOverwritten: true,
				}),
			),
		).toBe('PREEXISTENTE — NO RESTAURABLE AUTOMÁTICAMENTE');
	});

	it('treats failure before mutation as an empty, verified compensation boundary', async () => {
		const result = await cleanup([]);
		expect(result.totalTracked).toBe(0);
		expect(result.requiresManualReview).toEqual([]);
		expect(result.status).toBe('CAMBIOS_REVERTIDOS');
	});

	it('removes a newly uploaded Storage object without deleting pre-existing resources', async () => {
		const existing = resource('invitation', 'existing', { isPreExisting: true });
		const created = resource('storage_object', 'managed/fixture/new.webp');
		const result = await cleanup([existing, created]);
		expect(result.removed).toEqual([created]);
		expect(result.skippedPreExisting).toEqual([existing]);
		expect(result.status).toBe('CAMBIOS_REVERTIDOS');
	});

	it.each([
		['Storage overwrite', resource('storage_object', 'managed/fixture/hero.webp')],
		['DB overwrite', resource('invitation_content_draft', 'draft-id')],
		['publication failure', resource('published_invitation_content', 'invitation-id')],
		['post-publication verification failure', resource('event', 'event-id')],
	])('requires manual review after a pre-existing %s', async (_name, item) => {
		const mutated = { ...item, isPreExisting: true, wasOverwritten: true };
		const result = await cleanup([mutated]);
		expect(result.status).toBe('REQUIERE_REVISION');
		expect(result.unrestoredOverwrites).toEqual([mutated]);
		expect(result.removed).toEqual([]);
	});

	it('requires manual review when compensation fails and sanitizes evidence', async () => {
		const created = resource('storage_object', 'managed/fixture/new.webp');
		const result = await executeCleanup(
			{ invitationSlug: 'fixture', trackedResources: [created] },
			async () => {
				throw new Error(
					`failed postgresql://user:secret@db.example.invalid/db ${'a'.repeat(64)} C:\\private\\fixture.json`,
				);
			},
		);
		expect(result.status).toBe('REQUIERE_REVISION');
		expect(result.failures[0]?.error).not.toContain('secret');
		expect(result.failures[0]?.error).not.toContain('a'.repeat(64));
		expect(result.failures[0]?.error).not.toContain('C:\\private');
	});

	it('keeps retry after verified rollback deterministic and idempotent', async () => {
		const existingObjects = new Set(['managed/fixture/new.webp']);
		const tracked = [resource('storage_object', 'managed/fixture/new.webp')];
		const deleteFn = async (item: TrackedResource) => {
			existingObjects.delete(item.id);
			return true;
		};
		const first = await executeCleanup(
			{ invitationSlug: 'fixture', trackedResources: tracked },
			deleteFn,
		);
		const retry = await executeCleanup(
			{ invitationSlug: 'fixture', trackedResources: tracked },
			deleteFn,
		);
		expect(first.status).toBe('CAMBIOS_REVERTIDOS');
		expect(retry.status).toBe('CAMBIOS_REVERTIDOS');
		expect(existingObjects.size).toBe(0);
	});

	it('keeps retry after manual-review state fail-closed', async () => {
		const overwritten = resource('invitation', 'existing', {
			isPreExisting: true,
			wasOverwritten: true,
		});
		const first = await cleanup([overwritten]);
		const retry = await cleanup([overwritten]);
		expect(first.status).toBe('REQUIERE_REVISION');
		expect(retry.status).toBe('REQUIERE_REVISION');
	});
});
