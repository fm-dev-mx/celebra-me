/**
 * managed-invitation-cleanup.ts — Safe Partial-Failure Cleanup Engine
 *
 * Reverts ONLY resources explicitly created during a failed managed invitation operation.
 * NEVER deletes, overwrites, or detaches pre-existing invitations, drafts, events, memberships, asset rows, or Storage binaries.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { runPsql } from '../db/db-workflow-lib.ts';
import { redactCredentials } from '../db/db-target-config.ts';

function sanitizeCleanupError(error: unknown): string {
	return redactCredentials(error instanceof Error ? error.message : String(error))
		.replace(/\b[a-f0-9]{64}\b/giu, (hash) => `${hash.slice(0, 8)}…`)
		.replace(/[A-Za-z]:\\[^\s"']+/gu, '[ruta interna]');
}

export interface TrackedResource {
	type:
		| 'invitation'
		| 'event'
		| 'event_membership'
		| 'invitation_asset'
		| 'storage_object'
		| 'invitation_content_draft'
		| 'published_invitation_content'
		| 'managed_invitation_release_provenance'
		| 'preview_identity';
	id: string;
	detail?: string;
	isPreExisting?: boolean;
	wasOverwritten?: boolean;
	restored?: boolean;
}

export interface CleanupPlan {
	invitationSlug: string;
	trackedResources: TrackedResource[];
}

export interface CleanupResult {
	invitationSlug: string;
	totalTracked: number;
	removed: TrackedResource[];
	skippedPreExisting: TrackedResource[];
	unrestoredOverwrites: TrackedResource[];
	failures: Array<{ resource: TrackedResource; error: string }>;
	requiresManualReview: TrackedResource[];
	classifications: Array<{
		resource: TrackedResource;
		classification:
			| 'NUEVO — REMOVIBLE'
			| 'PREEXISTENTE — SIN CAMBIOS'
			| 'PREEXISTENTE — RESTAURADO'
			| 'PREEXISTENTE — NO RESTAURABLE AUTOMÁTICAMENTE';
	}>;
	status: 'CAMBIOS_REVERTIDOS' | 'REQUIERE_REVISION';
}

export function classifyTrackedResource(
	resource: TrackedResource,
): CleanupResult['classifications'][number]['classification'] {
	if (!resource.isPreExisting) return 'NUEVO — REMOVIBLE';
	if (!resource.wasOverwritten) return 'PREEXISTENTE — SIN CAMBIOS';
	if (resource.restored) return 'PREEXISTENTE — RESTAURADO';
	return 'PREEXISTENTE — NO RESTAURABLE AUTOMÁTICAMENTE';
}

export function planCleanup(input: CleanupPlan | TrackedResource[]): {
	toRemove: TrackedResource[];
	toSkip: TrackedResource[];
	unrestoredOverwrites: TrackedResource[];
} {
	const resources = Array.isArray(input) ? input : input.trackedResources;
	const toRemove: TrackedResource[] = [];
	const toSkip: TrackedResource[] = [];
	const unrestoredOverwrites: TrackedResource[] = [];

	const contentOverwrittenUnrestored = resources.some(
		(r) =>
			r.isPreExisting &&
			r.wasOverwritten &&
			!r.restored &&
			(r.type === 'published_invitation_content' ||
				r.type === 'invitation_content_draft' ||
				r.type === 'invitation'),
	);

	for (const res of resources) {
		if (res.isPreExisting) {
			toSkip.push(res);
			if (res.wasOverwritten && !res.restored) {
				unrestoredOverwrites.push(res);
			}
		} else if (
			contentOverwrittenUnrestored &&
			(res.type === 'storage_object' || res.type === 'invitation_asset')
		) {
			// Protection against deleting uploaded assets when published or draft content remains committed
			toSkip.push(res);
			unrestoredOverwrites.push(res);
		} else {
			toRemove.push(res);
		}
	}

	return { toRemove, toSkip, unrestoredOverwrites };
}

export async function executeCleanup(
	plan: CleanupPlan,
	deleteFn: (resource: TrackedResource) => Promise<boolean>,
): Promise<CleanupResult> {
	const { toRemove, toSkip, unrestoredOverwrites } = planCleanup(plan);
	const removed: TrackedResource[] = [];
	const failures: Array<{ resource: TrackedResource; error: string }> = [];
	const requiresManualReview: TrackedResource[] = [...unrestoredOverwrites];

	const reverseOrderToRemove = [...toRemove].reverse();

	for (const res of reverseOrderToRemove) {
		try {
			const ok = await deleteFn(res);
			if (ok) {
				removed.push(res);
			} else {
				failures.push({ resource: res, error: 'Deleter returned false' });
				requiresManualReview.push(res);
			}
		} catch (err) {
			failures.push({
				resource: res,
				error: sanitizeCleanupError(err),
			});
			requiresManualReview.push(res);
		}
	}

	const status = requiresManualReview.length > 0 ? 'REQUIERE_REVISION' : 'CAMBIOS_REVERTIDOS';

	return {
		invitationSlug: plan.invitationSlug,
		totalTracked: plan.trackedResources.length,
		removed,
		skippedPreExisting: toSkip,
		unrestoredOverwrites,
		failures,
		requiresManualReview,
		classifications: plan.trackedResources.map((resource) => ({
			resource,
			classification: classifyTrackedResource(resource),
		})),
		status,
	};
}

export async function cleanupLocalResources(
	supabase: SupabaseClient,
	slug: string,
	trackedResources: TrackedResource[],
): Promise<CleanupResult> {
	return executeCleanup({ invitationSlug: slug, trackedResources }, async (res) => {
		const ensureDeleted = (error: { message: string } | null): boolean => {
			if (error) throw new Error(error.message);
			return true;
		};
		switch (res.type) {
			case 'event_membership': {
				const parts = res.id.split(':');
				const eventId = parts[0]!;
				const userId = parts[1]!;
				const { error } = await supabase
					.from('event_memberships')
					.delete()
					.eq('event_id', eventId)
					.eq('user_id', userId);
				return ensureDeleted(error);
			}
			case 'event': {
				const { error } = await supabase.from('events').delete().eq('id', res.id);
				return ensureDeleted(error);
			}
			case 'invitation_content_draft': {
				const { error } = await supabase
					.from('invitation_content_drafts')
					.delete()
					.eq('id', res.id);
				return ensureDeleted(error);
			}
			case 'published_invitation_content': {
				const { error } = await supabase
					.from('published_invitation_content')
					.delete()
					.eq('invitation_project_id', res.id);
				return ensureDeleted(error);
			}
			case 'invitation_asset': {
				const { error } = await supabase
					.from('invitation_assets')
					.delete()
					.eq('id', res.id);
				return ensureDeleted(error);
			}
			case 'storage_object': {
				const { error } = await supabase.storage.from('invitation-assets').remove([res.id]);
				return ensureDeleted(error);
			}
			case 'managed_invitation_release_provenance': {
				const { error } = await supabase
					.from('managed_invitation_release_provenance')
					.delete()
					.eq('invitation_id', res.id);
				return ensureDeleted(error);
			}
			case 'invitation': {
				const { error } = await supabase.from('invitations').delete().eq('id', res.id);
				return ensureDeleted(error);
			}
			case 'preview_identity':
				// Preview auth/profile rows are pre-existing prerequisites and never removable here.
				return false;
		}
	});
}

export async function cleanupHostedPsqlResources(
	targetDbUrl: string,
	slug: string,
	trackedResources: TrackedResource[],
	runPsqlFn?: (
		sql: string,
		dbUrl: string,
		options?: { throwOnError?: boolean },
	) => { status: number },
): Promise<CleanupResult> {
	const execPsql = runPsqlFn ?? runPsql;

	return executeCleanup({ invitationSlug: slug, trackedResources }, async (res) => {
		switch (res.type) {
			case 'event_membership': {
				const parts = res.id.split(':');
				const eventId = parts[0]!;
				const userId = parts[1]!;
				execPsql(
					`delete from public.event_memberships where event_id = '${eventId}'::uuid and user_id = '${userId}'::uuid;`,
					targetDbUrl,
				);
				return true;
			}
			case 'event': {
				execPsql(`delete from public.events where id = '${res.id}'::uuid;`, targetDbUrl);
				return true;
			}
			case 'invitation_content_draft': {
				execPsql(
					`delete from public.invitation_content_drafts where id = '${res.id}'::uuid;`,
					targetDbUrl,
				);
				return true;
			}
			case 'published_invitation_content': {
				execPsql(
					`delete from public.published_invitation_content where invitation_project_id = '${res.id}'::uuid;`,
					targetDbUrl,
				);
				return true;
			}
			case 'invitation_asset': {
				execPsql(
					`delete from public.invitation_assets where id = '${res.id}'::uuid;`,
					targetDbUrl,
				);
				return true;
			}
			case 'storage_object': {
				execPsql(
					`delete from storage.objects where bucket_id = 'invitation-assets' and name = '${res.id}';`,
					targetDbUrl,
				);
				return true;
			}
			case 'managed_invitation_release_provenance': {
				execPsql(
					`delete from public.managed_invitation_release_provenance where invitation_id = '${res.id}'::uuid;`,
					targetDbUrl,
				);
				return true;
			}
			case 'invitation': {
				execPsql(
					`delete from public.invitations where id = '${res.id}'::uuid;`,
					targetDbUrl,
				);
				return true;
			}
			case 'preview_identity':
				// Preview auth/profile rows are pre-existing prerequisites and never removable here.
				return false;
		}
	});
}
