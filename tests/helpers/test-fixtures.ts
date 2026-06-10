import type { ShareMessageDateContext } from '@/lib/rsvp/services/shared/share-message-date';
import type { ReminderSettings } from '@/lib/rsvp/services/shared/share-message-defaults';

export const DEFAULT_REMINDER_SETTINGS_FIXTURE: ReminderSettings = {
	enabled: true,
	showWhenDaysBeforeEvent: 7,
	audience: 'unconfirmed',
};

export function defaultShareDateContext(
	overrides?: Partial<ShareMessageDateContext>,
): ShareMessageDateContext {
	return {
		eventDate: '',
		daysUntilEvent: '',
		rawDaysUntilEvent: null,
		rsvpDeadline: '',
		eventTimingText: '',
		rsvpDeadlineText: 'Confirma tu asistencia lo antes posible.',
		...overrides,
	};
}
