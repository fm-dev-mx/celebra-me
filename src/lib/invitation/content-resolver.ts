import { getRoutableEventEntry } from '@/lib/content/events';
import { findPublishedBySlugAndEventType } from '@/lib/intake/repositories/published-invitation-content.repository';
import { adaptEvent } from '@/lib/adapters/event';
import { adaptDbEvent } from '@/lib/adapters/db-event-adapter';
import type { InvitationViewModel } from '@/lib/adapters/types';

export type ContentSource = 'static' | 'published';

export interface ContentResolution {
	source: ContentSource;
	viewModel: InvitationViewModel;
	rawContent?: Record<string, unknown>;
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

	if (eventType) {
		const publishedEntry = await findPublishedBySlugAndEventType(slug, eventType);
		if (publishedEntry) {
			const viewModel = adaptDbEvent({
				slug,
				eventType: publishedEntry.eventType,
				isDemo: publishedEntry.isDemo,
				content: publishedEntry.content,
			});
			return { source: 'published', viewModel, rawContent: publishedEntry.content };
		}
	}

	return null;
}
