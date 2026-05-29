import { getRoutableEventEntry } from '@/lib/content/events';
import { findPublishedBySlug } from '@/lib/intake/repositories/published-invitation-content.repository';
import { adaptEvent } from '@/lib/adapters/event';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import type { InvitationViewModel } from '@/lib/adapters/types';

export type ContentSource = 'static' | 'published';

export interface ContentResolution {
	source: ContentSource;
	viewModel: InvitationViewModel;
}

export async function resolveInvitationContent(
	slug: string,
	eventType?: string,
): Promise<ContentResolution | null> {
	const staticEntry = await getRoutableEventEntry(slug, eventType);
	if (staticEntry) {
		const viewModel = adaptEvent(staticEntry);
		return { source: 'static', viewModel };
	}

	const publishedEntry = await findPublishedBySlug(slug);
	if (publishedEntry) {
		const viewModel = adaptDbEvent({
			slug,
			eventType: publishedEntry.eventType,
			isDemo: publishedEntry.isDemo,
			content: publishedEntry.content,
		});
		return { source: 'published', viewModel };
	}

	return null;
}

export async function resolveInvitationContentBySource(
	slug: string,
	eventType?: string,
	preferSource?: ContentSource,
): Promise<ContentResolution | null> {
	if (preferSource === 'published') {
		const publishedEntry = await findPublishedBySlug(slug);
		if (publishedEntry) {
			const viewModel = adaptDbEvent({
				slug,
				eventType: publishedEntry.eventType,
				isDemo: publishedEntry.isDemo,
				content: publishedEntry.content,
			});
			return { source: 'published', viewModel };
		}
	}

	return resolveInvitationContent(slug, eventType);
}
