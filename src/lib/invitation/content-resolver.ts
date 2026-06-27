import { getRoutableEventEntry } from '@/lib/content/events';
import { findPublishedBySlugAndEventType } from '@/lib/intake/repositories/published-invitation-content.repository';
import { findInvitationBySlug } from '@/lib/intake/repositories/invitation.repository';
import { adaptEvent } from '@/lib/adapters/event';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import type { InvitationViewModel } from '@/lib/adapters/types';

export type ContentResolution =
	| { source: 'static'; viewModel: InvitationViewModel }
	| { source: 'published'; viewModel: InvitationViewModel; rawContent: Record<string, unknown> };

export async function resolveInvitationContent(
	slug: string,
	eventType?: string,
): Promise<ContentResolution | null> {
	// DB-published content first — this is the source of truth for real invitations.
	// Skip DB for demos: static JSON files are the canonical source for demo content.
	if (eventType) {
		const publishedEntry = await findPublishedBySlugAndEventType(slug, eventType);
		if (publishedEntry && publishedEntry.isDemo !== true) {
			const rawContent = publishedEntry.content;
			const viewModel = adaptDbEvent({
				slug,
				eventType: publishedEntry.eventType,
				isDemo: publishedEntry.isDemo,
				content: rawContent,
			});
			return { source: 'published', viewModel, rawContent };
		}
	}

	try {
		const invitation = await findInvitationBySlug(slug, true);
		if (invitation?.archivedAt) return null;
	} catch (error) {
		// Keep static demos routable during the short app-before-migration rollout window.
		if (
			!(
				error instanceof Error &&
				error.message.includes("Could not find the table 'public.invitations'")
			)
		) {
			throw error;
		}
	}

	// Static fallback — only for demos and legacy entries (must have isDemo: true)
	const staticEntry = await getRoutableEventEntry(slug, eventType);
	if (staticEntry?.data && 'isDemo' in staticEntry.data) {
		if (staticEntry.data.isDemo === true) {
			const viewModel = adaptEvent(staticEntry);
			return { source: 'static', viewModel };
		}
		// Non-demo static entries are blocked — real client data must come from DB
		return null;
	}

	return null;
}
