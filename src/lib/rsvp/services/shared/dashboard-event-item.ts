import type { DashboardEventListItem } from '@/interfaces/dashboard/admin.interface';
import type { EventRecord } from '@/interfaces/rsvp/domain.interface';

/** Dashboard projection of an event; eligibility for add-ons is derived, never stored twice. */
export function toDashboardEventItem(event: EventRecord): DashboardEventListItem {
	return {
		id: event.id,
		title: event.title,
		slug: event.slug,
		eventType: event.eventType,
		status: event.status,
		brandingRemovalEnabled: event.brandingRemovalGuestLimit > 0,
	};
}
