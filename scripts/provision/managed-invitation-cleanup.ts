/**
 * managed-invitation-cleanup.ts — Safe Partial-Failure Cleanup Engine
 *
 * Reverts ONLY resources explicitly created during a failed managed invitation operation.
 * NEVER deletes, overwrites, or detaches pre-existing invitations, drafts, events, memberships, asset rows, or Storage binaries.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { runPsql } from '../db/db-workflow-lib.ts';

export interface TrackedResource {
	type:
		| 'invitation'
		| 'event'
		| 'event_membership'
		| 'invitation_asset'
		| 'storage_object'
		| 'invitation_content_draft'
		| 'managed_invitation_release_provenance';
	id: string;
	detail?: string;
	isPreExisting?: boolean;
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
	failures: Array<{ resource: TrackedResource; error: string }>;
	requiresManualReview: TrackedResource[];
}

export function planCleanup(input: CleanupPlan | TrackedResource[]): {
	toRemove: TrackedResource[];
	toSkip: TrackedResource[];
} {
	const resources = Array.isArray(input) ? input : input.trackedResources;
	const toRemove: TrackedResource[] = [];
	const toSkip: TrackedResource[] = [];

	for (const res of resources) {
		if (res.isPreExisting) {
			toSkip.push(res);
		} else {
			toRemove.push(res);
		}
	}

	return { toRemove, toSkip };
}

export async function executeCleanup(
	plan: CleanupPlan,
	deleteFn: (resource: TrackedResource) => Promise<boolean>,
): Promise<CleanupResult> {
	const { toRemove, toSkip } = planCleanup(plan);
	const removed: TrackedResource[] = [];
	const failures: Array<{ resource: TrackedResource; error: string }> = [];
	const requiresManualReview: TrackedResource[] = [];

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
			failures.push({ resource: res, error: err instanceof Error ? err.message : String(err) });
			requiresManualReview.push(res);
		}
	}

	return {
		invitationSlug: plan.invitationSlug,
		totalTracked: plan.trackedResources.length,
		removed,
		skippedPreExisting: toSkip,
		failures,
		requiresManualReview,
	};
}

export async function cleanupLocalResources(
	supabase: SupabaseClient,
	slug: string,
	trackedResources: TrackedResource[],
): Promise<CleanupResult> {
	return executeCleanup({ invitationSlug: slug, trackedResources }, async (res) => {
		switch (res.type) {
			case 'event_membership': {
				const parts = res.id.split(':');
				const eventId = parts[0]!;
				const userId = parts[1]!;
				await supabase.from('event_memberships').delete().eq('event_id', eventId).eq('user_id', userId);
				return true;
			}
			case 'event': {
				await supabase.from('events').delete().eq('id', res.id);
				return true;
			}
			case 'invitation_content_draft': {
				await supabase.from('invitation_content_drafts').delete().eq('id', res.id);
				return true;
			}
			case 'invitation_asset': {
				await supabase.from('invitation_assets').delete().eq('id', res.id);
				return true;
			}
			case 'storage_object': {
				await supabase.storage.from('invitation-assets').remove([res.id]);
				return true;
			}
			case 'managed_invitation_release_provenance': {
				await supabase.from('managed_invitation_release_provenance').delete().eq('invitation_id', res.id);
				return true;
			}
			case 'invitation': {
				await supabase.from('invitations').delete().eq('id', res.id);
				return true;
			}
		}
	});
}

export async function cleanupHostedPsqlResources(
	targetDbUrl: string,
	slug: string,
	trackedResources: TrackedResource[],
	runPsqlFn?: (sql: string, dbUrl: string, options?: { throwOnError?: boolean }) => { status: number },
): Promise<CleanupResult> {
	const execPsql = runPsqlFn ?? runPsql;

	return executeCleanup({ invitationSlug: slug, trackedResources }, async (res) => {
		switch (res.type) {
			case 'event_membership': {
				const parts = res.id.split(':');
				const eventId = parts[0]!;
				const userId = parts[1]!;
				execPsql(`delete from public.event_memberships where event_id = '${eventId}'::uuid and user_id = '${userId}'::uuid;`, targetDbUrl);
				return true;
			}
			case 'event': {
				execPsql(`delete from public.events where id = '${res.id}'::uuid;`, targetDbUrl);
				return true;
			}
			case 'invitation_content_draft': {
				execPsql(`delete from public.invitation_content_drafts where id = '${res.id}'::uuid;`, targetDbUrl);
				return true;
			}
			case 'invitation_asset': {
				execPsql(`delete from public.invitation_assets where id = '${res.id}'::uuid;`, targetDbUrl);
				return true;
			}
			case 'storage_object': {
				execPsql(`delete from storage.objects where bucket_id = 'invitation-assets' and name = '${res.id}';`, targetDbUrl);
				return true;
			}
			case 'managed_invitation_release_provenance': {
				execPsql(`delete from public.managed_invitation_release_provenance where invitation_id = '${res.id}'::uuid;`, targetDbUrl);
				return true;
			}
			case 'invitation': {
				execPsql(`delete from public.invitations where id = '${res.id}'::uuid;`, targetDbUrl);
				return true;
			}
		}
	});
}
