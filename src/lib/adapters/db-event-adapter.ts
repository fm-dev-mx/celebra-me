import { adaptEvent } from '@/lib/adapters/event';
import type { EventContentEntry } from '@/lib/content/events';
import type { InvitationViewModel } from '@/lib/adapters/types';

export interface DbEventSource {
	slug: string;
	eventType: string;
	isDemo: boolean;
	content: Record<string, unknown>;
	assetSlug?: string;
}

export function adaptDbEvent(source: DbEventSource): InvitationViewModel {
	const pseudoEntry = {
		id: `events/${source.slug}`,
		data: source.content,
	};

	return adaptEvent(pseudoEntry as unknown as EventContentEntry, undefined, source.assetSlug);
}
